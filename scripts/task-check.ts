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
  const studyId = randomUUID();
  const studyPublicId = createPublicId("ST");
  const participantId = randomUUID();
  const participantPublicId = createPublicId("PT");
  const deviceId = randomUUID();
  const devicePublicId = createPublicId("DEV");
  const adminJar = new CookieJar();
  const participantJar = new CookieJar();
  let adminUserId: string | undefined;
  let participantUserId: string | undefined;
  let taskPublicId: string | undefined;
  let assignmentPublicId: string | undefined;
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
      insert into egocapture.studies (id, public_id, slug, name, serial_hmac_salt, is_demo)
      values (${studyId}::uuid, ${studyPublicId}, ${`task-check-${suffix}`}, 'Task Integration Fixture', 'task-check-salt', true)
    `;
    await db`
      insert into egocapture.study_memberships (study_id, profile_id, role)
      values (${studyId}::uuid, ${adminProfile.id}::uuid, 'owner')
    `;
    await db`
      insert into egocapture.participants (
        id, public_id, study_id, auth_user_id, display_alias, status, consent_status,
        consent_version, is_fixture, created_by
      ) values (
        ${participantId}::uuid, ${participantPublicId}, ${studyId}::uuid, ${participantUserId}::uuid,
        'Task Integration Participant', 'active', 'valid', 'task-check-v1', true, ${adminProfile.id}::uuid
      )
    `;
    await db`
      insert into egocapture.consent_records (participant_id, version, status, recorded_by, accepted_at)
      values (${participantId}::uuid, 'task-check-v1', 'accepted', ${participantProfile.id}::uuid, now())
    `;
    await db`
      insert into egocapture.devices (
        id, public_id, study_id, manufacturer, model, device_type, serial_hmac, status, is_fixture
      ) values (
        ${deviceId}::uuid, ${devicePublicId}, ${studyId}::uuid, 'Synthetic', 'Task Check Cam',
        'action_camera', ${createHash("sha256").update(suffix).digest("hex")}, 'active', true
      )
    `;
    await db`
      insert into egocapture.device_assignments (device_id, participant_id, assigned_by)
      values (${deviceId}::uuid, ${participantId}::uuid, ${adminProfile.id}::uuid)
    `;
    await db`update egocapture.participants set default_device_id = ${deviceId}::uuid where id = ${participantId}::uuid`;

    const adminLogin = await api<{ data?: { redirectTo: string } }>(env.siteUrl, "/api/auth/admin-login", {
      method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    assert(adminLogin.response.ok && adminLogin.payload.data?.redirectTo === "/admin/dashboard", "Task check Admin login failed");

    const v1Instructions = structuredClone(defaultTaskInstructions);
    v1Instructions.title = "Task Version One Fixture";
    const taskKey = randomUUID();
    const created = await api<{ data?: { taskPublicId: string; updatedAt: string } }>(env.siteUrl, "/api/admin/tasks", {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": taskKey },
      body: JSON.stringify({ studyPublicId, instructions: v1Instructions }),
    });
    assert(created.response.status === 201 && created.payload.data?.taskPublicId, "Task creation failed");
    taskPublicId = created.payload.data.taskPublicId;
    const replay = await api<{ data?: { taskPublicId: string } }>(env.siteUrl, "/api/admin/tasks", {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": taskKey },
      body: JSON.stringify({ studyPublicId, instructions: v1Instructions }),
    });
    assert(replay.payload.data?.taskPublicId === taskPublicId, "Task idempotency replay diverged");
    await db`update egocapture.tasks set is_fixture = true where public_id = ${taskPublicId}`;

    const publishedV1 = await api<{ data?: { version: number; contentHash: string; updatedAt: string } }>(
      env.siteUrl,
      `/api/admin/tasks/${taskPublicId}/publish`,
      { method: "POST", jar: adminJar, headers: { "idempotency-key": randomUUID() } },
    );
    assert(publishedV1.response.status === 201 && publishedV1.payload.data?.version === 1, "Task v1 publish failed");
    const v1Hash = publishedV1.payload.data.contentHash;

    const v2Instructions = structuredClone(v1Instructions);
    v2Instructions.title = "Task Version Two Fixture";
    const updated = await api<{ data?: { updatedAt: string } }>(env.siteUrl, `/api/admin/tasks/${taskPublicId}`, {
      method: "PATCH", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ instructions: v2Instructions, expectedUpdatedAt: publishedV1.payload.data.updatedAt }),
    });
    assert(updated.response.ok && updated.payload.data?.updatedAt, "Task draft update failed");
    const stale = await api<{ error?: { code: string } }>(env.siteUrl, `/api/admin/tasks/${taskPublicId}`, {
      method: "PATCH", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ instructions: v1Instructions, expectedUpdatedAt: publishedV1.payload.data.updatedAt }),
    });
    assert(stale.response.status === 409 && stale.payload.error?.code === "STALE_WRITE", "Task stale write was not rejected");
    const publishedV2 = await api<{ data?: { version: number; contentHash: string } }>(
      env.siteUrl,
      `/api/admin/tasks/${taskPublicId}/publish`,
      { method: "POST", jar: adminJar, headers: { "idempotency-key": randomUUID() } },
    );
    assert(publishedV2.response.status === 201 && publishedV2.payload.data?.version === 2, "Task v2 publish failed");
    assert(publishedV2.payload.data.contentHash !== v1Hash, "Task versions did not freeze distinct content hashes");

    const assignment = await api<{ data?: { assignmentPublicId: string } }>(env.siteUrl, "/api/admin/assignments", {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        participantPublicId, taskPublicId, taskVersion: 1,
        dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        preferredDevicePublicId: devicePublicId, note: "Synthetic Task integration assignment",
      }),
    });
    assert(assignment.response.status === 201 && assignment.payload.data?.assignmentPublicId, "Assignment creation failed");
    assignmentPublicId = assignment.payload.data.assignmentPublicId;
    const duplicate = await api<{ error?: { code: string } }>(env.siteUrl, "/api/admin/assignments", {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        participantPublicId, taskPublicId, taskVersion: 1,
        dueAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        preferredDevicePublicId: devicePublicId,
      }),
    });
    assert(duplicate.response.status === 409 && duplicate.payload.error?.code === "ACTIVE_ASSIGNMENT_EXISTS", "Duplicate active Assignment was not rejected");
    const extendedDueAt = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString();
    const extended = await api<{ data?: { dueAt: string } }>(env.siteUrl, `/api/admin/assignments/${assignmentPublicId}/extend`, {
      method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ dueAt: extendedDueAt, reason: "Integration check verifies explicit due date extension" }),
    });
    assert(extended.response.ok && extended.payload.data?.dueAt === extendedDueAt, "Assignment extension failed");

    const participantLogin = await api<{ data?: { redirectTo: string } }>(env.siteUrl, "/api/auth/participant-login", {
      method: "POST", jar: participantJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantPublicId, password: participantPassword }),
    });
    assert(participantLogin.response.ok, "Task check Participant login failed");
    const participantAssignments = await api<{ data?: Array<{ publicId: string; taskTitle: string; contentHash: string }> }>(
      env.siteUrl,
      "/api/participant/assignments",
      { jar: participantJar },
    );
    const frozen = participantAssignments.payload.data?.find((item) => item.publicId === assignmentPublicId);
    assert(frozen?.taskTitle === "Task Version One Fixture" && frozen.contentHash === v1Hash, "Assigned TaskVersion did not remain frozen at v1");
    const wrongHash = await api<{ error?: { code: string } }>(
      env.siteUrl,
      `/api/participant/assignments/${assignmentPublicId}/acknowledge`,
      { method: "POST", jar: participantJar, headers: { "content-type": "application/json" }, body: JSON.stringify({ contentHash: "0".repeat(64) }) },
    );
    assert(wrongHash.response.status === 409 && wrongHash.payload.error?.code === "CONTENT_HASH_MISMATCH", "Wrong Task content hash was not rejected");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const acknowledged = await api<{ data?: { status: string } }>(
        env.siteUrl,
        `/api/participant/assignments/${assignmentPublicId}/acknowledge`,
        { method: "POST", jar: participantJar, headers: { "content-type": "application/json" }, body: JSON.stringify({ contentHash: v1Hash }) },
      );
      assert(acknowledged.response.ok && acknowledged.payload.data?.status === "acknowledged", "Assignment acknowledgement failed or was not idempotent");
    }

    let immutableBlocked = false;
    try {
      await db`update egocapture.task_versions set content_hash = ${"f".repeat(64)} where task_id = (select id from egocapture.tasks where public_id = ${taskPublicId}) and version = 1`;
    } catch (error) {
      immutableBlocked = (error as { code?: string }).code === "55000";
    }
    assert(immutableBlocked, "TaskVersion database immutability trigger did not block UPDATE");
    const [evidence] = await db<{ versionCount: number; acknowledgedHash: string; auditCount: number }[]>`
      select
        (select count(*)::integer from egocapture.task_versions version where version.task_id = task.id) as version_count,
        assignment.acknowledged_content_hash as acknowledged_hash,
        (select count(*)::integer from egocapture.audit_events audit where audit.study_id = ${studyId}::uuid) as audit_count
      from egocapture.tasks task
      join egocapture.task_versions version on version.task_id = task.id and version.version = 1
      join egocapture.assignments assignment on assignment.task_version_id = version.id
      where task.public_id = ${taskPublicId}
    `;
    assert(evidence.versionCount === 2 && evidence.acknowledgedHash === v1Hash && evidence.auditCount >= 7, "Task/Assignment database evidence mismatch");
    const canceled = await api<{ data?: { status: string } }>(env.siteUrl, `/api/admin/assignments/${assignmentPublicId}/cancel`, {
      method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Integration check closes the synthetic Assignment after acceptance" }),
    });
    assert(canceled.response.ok && canceled.payload.data?.status === "canceled", "Assignment cancellation failed");
  } finally {
    try {
      const [evidence] = await db<{ retainFixture: boolean }[]>`
        select exists(select 1 from egocapture.participants where study_id = ${studyId}::uuid)
          or exists(select 1 from egocapture.tasks where study_id = ${studyId}::uuid)
          or exists(select 1 from egocapture.audit_events where study_id = ${studyId}::uuid)
          or exists(select 1 from egocapture.studies where id = ${studyId}::uuid)
          or exists(
            select 1 from egocapture.profiles
            where auth_user_id in (${adminUserId ?? null}::uuid, ${participantUserId ?? null}::uuid)
          ) as retain_fixture
      `;
      if (evidence.retainFixture) {
        await db`update egocapture.studies set is_demo = true where id = ${studyId}::uuid`;
        await db`update egocapture.participants set is_fixture = true where study_id = ${studyId}::uuid`;
        await db`update egocapture.devices set is_fixture = true where study_id = ${studyId}::uuid`;
        await db`update egocapture.tasks set is_fixture = true where study_id = ${studyId}::uuid`;
      } else {
        if (participantUserId) await supabase.auth.admin.deleteUser(participantUserId);
        if (adminUserId) await supabase.auth.admin.deleteUser(adminUserId);
      }
    } finally {
      await db.end({ timeout: 2 });
    }
  }
  console.log(`Task draft, immutable v1/v2, Assignment authority, acknowledge, extend, cancel and audit checks passed; retained Demo Fixture ${taskPublicId} / ${assignmentPublicId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture Task: ${error.message}` : error);
  process.exitCode = 1;
});
