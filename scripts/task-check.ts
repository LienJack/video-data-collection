import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { internalParticipantEmail } from "@egocapture/core/domain/invitation";
import { createPublicId } from "@egocapture/core/domain/public-id";
import { defaultTaskInstructions } from "@egocapture/core/domain/task-template";
import { api, assert, CookieJar, integrationEnvironment } from "@/scripts/check-support";

async function main() {
  const env = integrationEnvironment();
  const db = postgres(env.databaseUrl, { max: 1, prepare: false, connect_timeout: 8, transform: postgres.camel });
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const suffix = randomUUID();
  const adminEmail = `task-check-${suffix}@demo.invalid`;
  const adminPassword = randomBytes(24).toString("base64url");
  const participantPassword = randomBytes(24).toString("base64url");
  const participantId = randomUUID();
  const participantPublicId = createPublicId("PT");
  const secondaryParticipantId = randomUUID();
  const secondaryParticipantPublicId = createPublicId("PT");
  const replacementParticipantId = randomUUID();
  const replacementParticipantPublicId = createPublicId("PT");
  const deviceId = randomUUID();
  const devicePublicId = createPublicId("DEV");
  const adminJar = new CookieJar();
  const participantJar = new CookieJar();
  let adminUserId: string | undefined;
  let participantUserId: string | undefined;
  let taskPublicId: string | undefined;
  let assignmentPublicId: string | undefined;
  let secondaryAssignmentPublicId: string | undefined;
  let replacementAssignmentPublicId: string | undefined;
  try {
    const { data: adminUser, error: adminError } = await supabase.auth.admin.createUser({
      email: adminEmail, password: adminPassword, email_confirm: true,
    });
    if (adminError || !adminUser.user) throw adminError || new Error("Task check Admin Auth creation failed");
    adminUserId = adminUser.user.id;
    const { data: participantUser, error: participantError } = await supabase.auth.admin.createUser({
      email: internalParticipantEmail(participantPublicId), password: participantPassword, email_confirm: true,
    });
    if (participantError || !participantUser.user) throw participantError || new Error("Task check Participant Auth creation failed");
    participantUserId = participantUser.user.id;
    const [adminProfile] = await db<{ id: string }[]>`
      insert into egocapture.profiles (auth_user_id, role, display_name)
      values (${adminUserId}::uuid, 'admin', 'Task Integration Fixture Admin') returning id
    `;
    const [participantProfile] = await db<{ id: string }[]>`
      insert into egocapture.profiles (auth_user_id, role, display_name)
      values (${participantUserId}::uuid, 'participant', 'Task Integration Fixture Participant') returning id
    `;
    await db`
      insert into egocapture.participants (
        id, public_id, auth_user_id, display_alias, status, consent_status,
        consent_version, is_fixture, created_by
      ) values (
        ${participantId}::uuid, ${participantPublicId}, ${participantUserId}::uuid,
        'Task Integration Participant', 'active', 'valid', 'task-check-v1', true, ${adminProfile.id}::uuid
      )
    `;
    await db`
      insert into egocapture.consent_records (participant_id, version, status, recorded_by, accepted_at)
      values (${participantId}::uuid, 'task-check-v1', 'accepted', ${participantProfile.id}::uuid, now())
    `;
    await db`
      insert into egocapture.participants (
        id, public_id, display_alias, status, consent_status,
        consent_version, is_fixture, created_by
      ) values
        (
          ${secondaryParticipantId}::uuid, ${secondaryParticipantPublicId},
          'Task Integration Secondary', 'active', 'valid', 'task-check-v1', true, ${adminProfile.id}::uuid
        ),
        (
          ${replacementParticipantId}::uuid, ${replacementParticipantPublicId},
          'Task Integration Replacement', 'active', 'valid', 'task-check-v1', true, ${adminProfile.id}::uuid
        )
    `;
    await db`
      insert into egocapture.consent_records (participant_id, version, status, recorded_by, accepted_at)
      values
        (${secondaryParticipantId}::uuid, 'task-check-v1', 'accepted', ${adminProfile.id}::uuid, now()),
        (${replacementParticipantId}::uuid, 'task-check-v1', 'accepted', ${adminProfile.id}::uuid, now())
    `;
    await db`
      insert into egocapture.devices (
        id, public_id, manufacturer, model, device_type, serial_hmac, status, is_fixture
      ) values (
        ${deviceId}::uuid, ${devicePublicId}, 'Synthetic', 'Task Check Cam',
        'action_camera', ${createHash("sha256").update(suffix).digest("hex")}, 'active', true
      )
    `;
    await db`
      insert into egocapture.device_assignments (device_id, participant_id, assigned_by)
      values (${deviceId}::uuid, ${participantId}::uuid, ${adminProfile.id}::uuid)
    `;
    await db`update egocapture.participants set default_device_id = ${deviceId}::uuid where id = ${participantId}::uuid`;

    const adminLogin = await api<{ data?: { redirectTo: string } }>(env.adminSiteUrl, "/api/auth/admin-login", {
      method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    assert(adminLogin.response.ok && adminLogin.payload.data?.redirectTo === "/dashboard", "Task check Admin login failed");

    const v1Instructions = structuredClone(defaultTaskInstructions);
    v1Instructions.title = "Task Version One Fixture";
    const taskKey = randomUUID();
    const created = await api<{ data?: { taskPublicId: string; updatedAt: string } }>(env.adminSiteUrl, "/api/admin/tasks", {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": taskKey },
      body: JSON.stringify({ instructions: v1Instructions }),
    });
    assert(created.response.status === 201 && created.payload.data?.taskPublicId, "Task creation failed");
    taskPublicId = created.payload.data.taskPublicId;
    const replay = await api<{ data?: { taskPublicId: string } }>(env.adminSiteUrl, "/api/admin/tasks", {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": taskKey },
      body: JSON.stringify({ instructions: v1Instructions }),
    });
    assert(replay.payload.data?.taskPublicId === taskPublicId, "Task idempotency replay diverged");
    await db`update egocapture.tasks set is_fixture = true where public_id = ${taskPublicId}`;

    const publishedV1 = await api<{ data?: { version: number; contentHash: string; updatedAt: string } }>(
      env.adminSiteUrl,
      `/api/admin/tasks/${taskPublicId}/publish`,
      { method: "POST", jar: adminJar, headers: { "idempotency-key": randomUUID() } },
    );
    assert(publishedV1.response.status === 201 && publishedV1.payload.data?.version === 1, "Task v1 publish failed");
    const v1Hash = publishedV1.payload.data.contentHash;

    const v2Instructions = structuredClone(v1Instructions);
    v2Instructions.title = "Task Version Two Fixture";
    const updated = await api<{ data?: { updatedAt: string } }>(env.adminSiteUrl, `/api/admin/tasks/${taskPublicId}`, {
      method: "PATCH", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ instructions: v2Instructions, expectedUpdatedAt: publishedV1.payload.data.updatedAt }),
    });
    assert(updated.response.ok && updated.payload.data?.updatedAt, "Task draft update failed");
    const stale = await api<{ error?: { code: string } }>(env.adminSiteUrl, `/api/admin/tasks/${taskPublicId}`, {
      method: "PATCH", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ instructions: v1Instructions, expectedUpdatedAt: publishedV1.payload.data.updatedAt }),
    });
    assert(stale.response.status === 409 && stale.payload.error?.code === "STALE_WRITE", "Task stale write was not rejected");
    const publishedV2 = await api<{ data?: { version: number; contentHash: string } }>(
      env.adminSiteUrl,
      `/api/admin/tasks/${taskPublicId}/publish`,
      { method: "POST", jar: adminJar, headers: { "idempotency-key": randomUUID() } },
    );
    assert(publishedV2.response.status === 201 && publishedV2.payload.data?.version === 2, "Task v2 publish failed");
    assert(publishedV2.payload.data.contentHash !== v1Hash, "Task versions did not freeze distinct content hashes");

    const batchDueAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const batchKey = randomUUID();
    const batchBody = {
      taskVersion: 1,
      dueAt: batchDueAt,
      note: "Synthetic Task integration roster",
      participants: [
        { participantPublicId, preferredDevicePublicId: devicePublicId },
        { participantPublicId: secondaryParticipantPublicId, preferredDevicePublicId: null },
      ],
    };
    const batch = await api<{ data?: {
      taskPublicId: string;
      created: Array<{ participantPublicId: string; assignmentPublicId: string }>;
      skipped: Array<{ participantPublicId: string; code: string }>;
    } }>(env.adminSiteUrl, `/api/admin/tasks/${taskPublicId}/participants`, {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": batchKey },
      body: JSON.stringify(batchBody),
    });
    assert(
      batch.response.status === 201 && batch.payload.data?.created.length === 2 && batch.payload.data.skipped.length === 0,
      "Task roster did not create both selected participants",
    );
    assignmentPublicId = batch.payload.data.created.find((item) => item.participantPublicId === participantPublicId)?.assignmentPublicId;
    secondaryAssignmentPublicId = batch.payload.data.created.find((item) => item.participantPublicId === secondaryParticipantPublicId)?.assignmentPublicId;
    assert(assignmentPublicId && secondaryAssignmentPublicId, "Task roster response did not preserve participant-to-Assignment mapping");

    const batchReplay = await api<typeof batch.payload>(env.adminSiteUrl, `/api/admin/tasks/${taskPublicId}/participants`, {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": batchKey },
      body: JSON.stringify(batchBody),
    });
    assert(
      batchReplay.response.status === 201 &&
        batchReplay.payload.data?.created.map((item) => item.assignmentPublicId).join(",") ===
          batch.payload.data.created.map((item) => item.assignmentPublicId).join(","),
      "Task roster idempotency replay diverged",
    );

    const duplicateBatch = await api<{ data?: {
      created: Array<{ participantPublicId: string; assignmentPublicId: string }>;
      skipped: Array<{ participantPublicId: string; code: string }>;
    } }>(env.adminSiteUrl, `/api/admin/tasks/${taskPublicId}/participants`, {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        taskVersion: 2,
        dueAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        participants: [{ participantPublicId, preferredDevicePublicId: devicePublicId }],
      }),
    });
    assert(
      duplicateBatch.response.status === 201 && duplicateBatch.payload.data?.created.length === 0 &&
        duplicateBatch.payload.data.skipped.length === 1 && duplicateBatch.payload.data.skipped[0]?.code === "CURRENT_ASSIGNMENT_EXISTS",
      "Task roster did not skip an existing participant across TaskVersions",
    );

    const duplicateLegacy = await api<{ error?: { code: string } }>(env.adminSiteUrl, "/api/admin/assignments", {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        participantPublicId, taskPublicId, taskVersion: 2,
        dueAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        preferredDevicePublicId: devicePublicId,
      }),
    });
    assert(
      duplicateLegacy.response.status === 409 && duplicateLegacy.payload.error?.code === "ACTIVE_ASSIGNMENT_EXISTS",
      "Legacy Assignment route bypassed the one-current-participant-per-task constraint",
    );
    const extendedDueAt = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString();
    const extended = await api<{ data?: { dueAt: string } }>(env.adminSiteUrl, `/api/admin/assignments/${assignmentPublicId}/extend`, {
      method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ dueAt: extendedDueAt, reason: "Integration check verifies explicit due date extension" }),
    });
    assert(extended.response.ok && extended.payload.data?.dueAt === extendedDueAt, "Assignment extension failed");

    const participantLogin = await api<{ data?: { redirectTo: string } }>(env.participantSiteUrl, "/api/auth/participant-login", {
      method: "POST", jar: participantJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantPublicId, password: participantPassword }),
    });
    assert(participantLogin.response.ok, "Task check Participant login failed");
    const participantAssignments = await api<{ data?: Array<{ publicId: string; taskTitle: string; contentHash: string }> }>(
      env.participantSiteUrl,
      "/api/participant/assignments",
      { jar: participantJar },
    );
    const frozen = participantAssignments.payload.data?.find((item) => item.publicId === assignmentPublicId);
    assert(frozen?.taskTitle === "Task Version One Fixture" && frozen.contentHash === v1Hash, "Assigned TaskVersion did not remain frozen at v1");
    const wrongHash = await api<{ error?: { code: string } }>(
      env.participantSiteUrl,
      `/api/participant/assignments/${assignmentPublicId}/acknowledge`,
      { method: "POST", jar: participantJar, headers: { "content-type": "application/json" }, body: JSON.stringify({ contentHash: "0".repeat(64) }) },
    );
    assert(wrongHash.response.status === 409 && wrongHash.payload.error?.code === "CONTENT_HASH_MISMATCH", "Wrong Task content hash was not rejected");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const acknowledged = await api<{ data?: { status: string } }>(
        env.participantSiteUrl,
        `/api/participant/assignments/${assignmentPublicId}/acknowledge`,
        { method: "POST", jar: participantJar, headers: { "content-type": "application/json" }, body: JSON.stringify({ contentHash: v1Hash }) },
      );
      assert(acknowledged.response.ok && acknowledged.payload.data?.status === "acknowledged", "Assignment acknowledgement failed or was not idempotent");
    }
    const session = await api<{ data?: { sessionPublicId: string } }>(env.participantSiteUrl, "/api/participant/sessions", {
      method: "POST", jar: participantJar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({ assignmentPublicId, devicePublicId }),
    });
    assert(session.response.status === 201 && session.payload.data?.sessionPublicId, "Task roster fixture Session creation failed");
    const originalSessionPublicId = session.payload.data.sessionPublicId;

    let immutableBlocked = false;
    try {
      await db`update egocapture.task_versions set content_hash = ${"f".repeat(64)} where task_id = (select id from egocapture.tasks where public_id = ${taskPublicId}) and version = 1`;
    } catch (error) {
      immutableBlocked = (error as { code?: string }).code === "55000";
    }
    assert(immutableBlocked, "TaskVersion database immutability trigger did not block UPDATE");

    const rejectedReplacement = await api<{ error?: { code: string } }>(
      env.adminSiteUrl,
      `/api/admin/assignments/${assignmentPublicId}/replace`,
      {
        method: "POST", jar: adminJar,
        headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
        body: JSON.stringify({
          participantPublicId: secondaryParticipantPublicId,
          dueAt: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString(),
          preferredDevicePublicId: null,
          reason: "Integration check verifies replacement rollback on an ineligible target",
        }),
      },
    );
    assert(
      rejectedReplacement.response.status === 409 && rejectedReplacement.payload.error?.code === "CURRENT_ASSIGNMENT_EXISTS",
      "Replacement did not reject a participant already current in the task",
    );
    const [rollbackEvidence] = await db<{ originalStatus: string; secondaryStatus: string; sessionStatus: string }[]>`
      select original.status as original_status, secondary.status as secondary_status, session.status as session_status
      from egocapture.assignments original
      join egocapture.assignments secondary on secondary.public_id = ${secondaryAssignmentPublicId}
      join egocapture.recording_sessions session on session.public_id = ${originalSessionPublicId}
      where original.public_id = ${assignmentPublicId}
    `;
    assert(
      rollbackEvidence.originalStatus !== "canceled" && rollbackEvidence.secondaryStatus !== "canceled" && rollbackEvidence.sessionStatus === "open",
      "Rejected replacement partially changed the original Assignment, target Assignment, or Session",
    );

    const canceledSecondary = await api<{ data?: { status: string } }>(
      env.adminSiteUrl,
      `/api/admin/assignments/${secondaryAssignmentPublicId}/cancel`,
      {
        method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Integration check removes the secondary roster participant" }),
      },
    );
    assert(canceledSecondary.response.ok && canceledSecondary.payload.data?.status === "canceled", "Non-final participant cancellation failed");

    const finalParticipantCancel = await api<{ error?: { code: string } }>(
      env.adminSiteUrl,
      `/api/admin/assignments/${assignmentPublicId}/cancel`,
      {
        method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Integration check verifies the final participant protection" }),
      },
    );
    assert(
      finalParticipantCancel.response.status === 409 && finalParticipantCancel.payload.error?.code === "TASK_REQUIRES_PARTICIPANT",
      "Task allowed its final current participant to be canceled",
    );

    const replacementDueAt = new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString();
    const replacement = await api<{ data?: {
      taskPublicId: string;
      previousAssignmentPublicId: string;
      assignmentPublicId: string;
    } }>(env.adminSiteUrl, `/api/admin/assignments/${assignmentPublicId}/replace`, {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        participantPublicId: replacementParticipantPublicId,
        dueAt: replacementDueAt,
        preferredDevicePublicId: null,
        reason: "Integration check atomically replaces the final current participant",
      }),
    });
    assert(
      replacement.response.status === 201 && replacement.payload.data?.previousAssignmentPublicId === assignmentPublicId &&
        replacement.payload.data.taskPublicId === taskPublicId && replacement.payload.data.assignmentPublicId,
      "Atomic participant replacement failed",
    );
    replacementAssignmentPublicId = replacement.payload.data.assignmentPublicId;

    const [evidence] = await db<{
      versionCount: number;
      acknowledgedHash: string;
      originalStatus: string;
      replacementParticipantPublicId: string;
      replacesAssignmentPublicId: string;
      originalSessionAssignmentPublicId: string;
      originalSessionStatus: string;
      currentCount: number;
      auditCount: number;
    }[]>`
      select
        (select count(*)::integer from egocapture.task_versions version where version.task_id = task.id) as version_count,
        assignment.acknowledged_content_hash as acknowledged_hash,
        assignment.status as original_status,
        replacement_participant.public_id as replacement_participant_public_id,
        replaced.public_id as replaces_assignment_public_id,
        session_assignment.public_id as original_session_assignment_public_id,
        session.status as original_session_status,
        (select count(*)::integer from egocapture.assignments current_assignment
          where current_assignment.task_id = task.id and current_assignment.status <> 'canceled') as current_count,
        (select count(*)::integer from egocapture.audit_events audit
          where audit.entity_public_id in (${taskPublicId}, ${assignmentPublicId}, ${replacementAssignmentPublicId})) as audit_count
      from egocapture.tasks task
      join egocapture.assignments assignment on assignment.task_id = task.id and assignment.public_id = ${assignmentPublicId}
      join egocapture.assignments replacement on replacement.replaces_assignment_id = assignment.id
      join egocapture.participants replacement_participant on replacement_participant.id = replacement.participant_id
      join egocapture.assignments replaced on replaced.id = replacement.replaces_assignment_id
      join egocapture.recording_sessions session on session.public_id = ${originalSessionPublicId}
      join egocapture.assignments session_assignment on session_assignment.id = session.assignment_id
      where task.public_id = ${taskPublicId} and replacement.public_id = ${replacementAssignmentPublicId}
    `;
    assert(
      evidence.versionCount === 2 && evidence.acknowledgedHash === v1Hash && evidence.originalStatus === "canceled" &&
        evidence.replacementParticipantPublicId === replacementParticipantPublicId &&
        evidence.replacesAssignmentPublicId === assignmentPublicId &&
        evidence.originalSessionAssignmentPublicId === assignmentPublicId && evidence.originalSessionStatus === "closed" &&
        evidence.currentCount === 1 && evidence.auditCount >= 9,
      "Task roster replacement did not preserve history, authority, or audit evidence",
    );

    const cancelReplacement = await api<{ error?: { code: string } }>(
      env.adminSiteUrl,
      `/api/admin/assignments/${replacementAssignmentPublicId}/cancel`,
      {
        method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Integration check keeps one current participant after replacement" }),
      },
    );
    assert(
      cancelReplacement.response.status === 409 && cancelReplacement.payload.error?.code === "TASK_REQUIRES_PARTICIPANT",
      "Replacement participant could be canceled even though it was the final current participant",
    );

    const operations = await api<{ data?: {
      summary: { participantCount: number; operationalStatus: string };
      participants: Array<{ assignmentPublicId: string; status: string; replacesAssignmentPublicId: string | null }>;
    } }>(env.adminSiteUrl, `/api/admin/tasks/${taskPublicId}/participants`, { jar: adminJar });
    assert(
      operations.response.ok && operations.payload.data?.summary.participantCount === 1 &&
        operations.payload.data.participants.some((item) => item.assignmentPublicId === assignmentPublicId && item.status === "canceled") &&
        operations.payload.data.participants.some((item) => item.assignmentPublicId === replacementAssignmentPublicId && item.replacesAssignmentPublicId === assignmentPublicId),
      "Task operations view did not expose current roster and replacement history",
    );
  } finally {
    try {
      const [evidence] = await db<{ retainFixture: boolean }[]>`
        select exists(select 1 from egocapture.participants where public_id = ${participantPublicId})
          or exists(select 1 from egocapture.tasks where public_id = ${taskPublicId ?? ""})
          or exists(
            select 1 from egocapture.profiles
            where auth_user_id in (${adminUserId ?? null}::uuid, ${participantUserId ?? null}::uuid)
          ) as retain_fixture
      `;
      if (evidence.retainFixture) {
        await db`
          update egocapture.participants set is_fixture = true
          where public_id in (${participantPublicId}, ${secondaryParticipantPublicId}, ${replacementParticipantPublicId})
        `;
        await db`update egocapture.devices set is_fixture = true where public_id = ${devicePublicId}`;
        await db`update egocapture.tasks set is_fixture = true where public_id = ${taskPublicId ?? ""}`;
      } else {
        if (participantUserId) await supabase.auth.admin.deleteUser(participantUserId);
        if (adminUserId) await supabase.auth.admin.deleteUser(adminUserId);
      }
    } finally {
      await db.end({ timeout: 2 });
    }
  }
  console.log(`Task draft, immutable v1/v2, multi-participant roster, duplicate skip, last-participant protection, atomic replacement, history and audit checks passed; retained Demo Fixture ${taskPublicId} / ${assignmentPublicId} -> ${replacementAssignmentPublicId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture Task: ${error.message}` : error);
  process.exitCode = 1;
});
