import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { JWK } from "jose";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { internalParticipantEmail } from "@egocapture/core/domain/invitation";
import { verifyMarkerJws } from "@egocapture/core/domain/marker";
import { createPublicId } from "@egocapture/core/domain/public-id";
import { taskContentHash } from "@egocapture/core/domain/task-instructions";
import { defaultTaskInstructions } from "@egocapture/core/domain/task-template";
import { api, assert, CookieJar, integrationEnvironment } from "@/scripts/check-support";

async function main() {
  const env = integrationEnvironment();
  const db = postgres(env.databaseUrl, { max: 1, prepare: false, connect_timeout: 8, transform: postgres.camel });
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const suffix = randomUUID();
  const adminPassword = randomBytes(24).toString("base64url");
  const participantPassword = randomBytes(24).toString("base64url");
  const adminEmail = `session-check-${suffix}@demo.invalid`;
  const participantId = randomUUID();
  const participantPublicId = createPublicId("PT");
  const backupParticipantId = randomUUID();
  const backupParticipantPublicId = createPublicId("PT");
  const deviceId = randomUUID();
  const devicePublicId = createPublicId("DEV");
  const taskId = randomUUID();
  const taskPublicId = createPublicId("TSK");
  const taskVersionId = randomUUID();
  const assignmentId = randomUUID();
  const assignmentPublicId = createPublicId("AS");
  const instructions = structuredClone(defaultTaskInstructions);
  instructions.title = "Session Marker Integration Fixture";
  const contentHash = taskContentHash(instructions);
  const adminJar = new CookieJar();
  const participantJar = new CookieJar();
  let adminUserId: string | undefined;
  let participantUserId: string | undefined;
  let sessionPublicId: string | undefined;
  try {
    const { data: admin, error: adminError } = await supabase.auth.admin.createUser({
      email: adminEmail, password: adminPassword, email_confirm: true,
    });
    if (adminError || !admin.user) throw adminError || new Error("Session check Admin Auth creation failed");
    adminUserId = admin.user.id;
    const { data: participant, error: participantError } = await supabase.auth.admin.createUser({
      email: internalParticipantEmail(participantPublicId), password: participantPassword, email_confirm: true,
    });
    if (participantError || !participant.user) throw participantError || new Error("Session check Participant Auth creation failed");
    participantUserId = participant.user.id;
    const [adminProfile] = await db<{ id: string }[]>`
      insert into egocapture.profiles (auth_user_id, role, display_name)
      values (${adminUserId}::uuid, 'admin', 'Session Integration Fixture Admin') returning id
    `;
    const [participantProfile] = await db<{ id: string }[]>`
      insert into egocapture.profiles (auth_user_id, role, display_name)
      values (${participantUserId}::uuid, 'participant', 'Session Integration Fixture Participant') returning id
    `;
    await db`
      insert into egocapture.participants (
        id, public_id, auth_user_id, display_alias, status, consent_status,
        is_fixture, created_by
      ) values (
        ${participantId}::uuid, ${participantPublicId}, ${participantUserId}::uuid,
        'Session Integration Participant', 'active', 'valid', true, ${adminProfile.id}::uuid
      )
    `;
    await db`
      insert into egocapture.consent_records (participant_id, status, recorded_by, accepted_at)
      values (${participantId}::uuid, 'accepted', ${participantProfile.id}::uuid, now())
    `;
    await db`
      insert into egocapture.participants (
        id, public_id, display_alias, status, consent_status,
        is_fixture, created_by
      ) values (
        ${backupParticipantId}::uuid, ${backupParticipantPublicId},
        'Session Integration Backup Participant', 'active', 'valid',
        true, ${adminProfile.id}::uuid
      )
    `;
    await db`
      insert into egocapture.consent_records (participant_id, status, recorded_by, accepted_at)
      values (${backupParticipantId}::uuid, 'accepted', ${adminProfile.id}::uuid, now())
    `;
    await db`
      insert into egocapture.devices (
        id, public_id, manufacturer, model, device_type, serial_hmac, status, is_fixture
      ) values (
        ${deviceId}::uuid, ${devicePublicId}, 'Synthetic', 'Marker Check Cam',
        'action_camera', ${createHash("sha256").update(suffix).digest("hex")}, 'active', true
      )
    `;
    await db`insert into egocapture.device_assignments (device_id, participant_id, assigned_by) values (${deviceId}::uuid, ${participantId}::uuid, ${adminProfile.id}::uuid)`;
    await db`update egocapture.participants set default_device_id = ${deviceId}::uuid where id = ${participantId}::uuid`;
    await db`
      insert into egocapture.tasks (
        id, public_id, title, lifecycle, draft_instructions, is_fixture, created_by
      ) values (
        ${taskId}::uuid, ${taskPublicId}, ${instructions.title}, 'active',
        ${db.json(instructions)}, true, ${adminProfile.id}::uuid
      )
    `;
    await db`
      insert into egocapture.task_versions (
        id, task_id, version, instructions, content_hash, published_by
      ) values (
        ${taskVersionId}::uuid, ${taskId}::uuid, 1,
        ${db.json(instructions)}, ${contentHash}, ${adminProfile.id}::uuid
      )
    `;
    await db`
      insert into egocapture.assignments (
        id, public_id, participant_id, task_version_id, preferred_device_id,
        due_at, locale, status, acknowledged_at, acknowledged_content_hash, created_by
      ) values (
        ${assignmentId}::uuid, ${assignmentPublicId}, ${participantId}::uuid,
        ${taskVersionId}::uuid, ${deviceId}::uuid, now() + interval '2 days', 'zh-CN',
        'acknowledged', now(), ${contentHash}, ${adminProfile.id}::uuid
      )
    `;
    await db`
      insert into egocapture.assignments (
        public_id, participant_id, task_version_id,
        due_at, locale, status, created_by
      ) values (
        ${createPublicId("AS")}, ${backupParticipantId}::uuid,
        ${taskVersionId}::uuid, now() + interval '2 days', 'zh-CN',
        'assigned', ${adminProfile.id}::uuid
      )
    `;

    const participantLogin = await api<{ data?: { redirectTo: string } }>(env.participantSiteUrl, "/api/auth/participant-login", {
      method: "POST", jar: participantJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantPublicId, password: participantPassword }),
    });
    assert(participantLogin.response.ok, "Session check Participant login failed");
    const invalidDevice = await api<{ error?: { code: string } }>(env.participantSiteUrl, "/api/participant/sessions", {
      method: "POST", jar: participantJar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({ assignmentPublicId, devicePublicId: createPublicId("DEV") }),
    });
    assert(invalidDevice.response.status === 422 && invalidDevice.payload.error?.code === "DEVICE_NOT_AVAILABLE", "Unassigned Device was not rejected");
    const createKey = randomUUID();
    const created = await api<{ data?: { sessionPublicId: string; markerExpiresAt: string } }>(env.participantSiteUrl, "/api/participant/sessions", {
      method: "POST", jar: participantJar,
      headers: { "content-type": "application/json", "idempotency-key": createKey },
      body: JSON.stringify({ assignmentPublicId, devicePublicId }),
    });
    assert(created.response.status === 201 && created.payload.data?.sessionPublicId, "Recording Session creation failed");
    sessionPublicId = created.payload.data.sessionPublicId;
    const replay = await api<{ data?: { sessionPublicId: string } }>(env.participantSiteUrl, "/api/participant/sessions", {
      method: "POST", jar: participantJar,
      headers: { "content-type": "application/json", "idempotency-key": createKey },
      body: JSON.stringify({ assignmentPublicId, devicePublicId }),
    });
    assert(replay.payload.data?.sessionPublicId === sessionPublicId, "Session create idempotency replay diverged");

    const firstMarker = await api<{ data?: {
      markerUri: string;
      qrDataUrl: string;
      shortCode: string;
      keyId: string;
    } }>(env.participantSiteUrl, `/api/participant/sessions/${sessionPublicId}/marker`, { jar: participantJar });
    const firstMarkerData = firstMarker.payload.data;
    assert(firstMarker.response.ok, "Marker retrieval failed");
    assert(firstMarkerData, "Marker response did not include data");
    assert(firstMarkerData.markerUri.startsWith("egocapture://marker/"), "Marker URI contract mismatch");
    assert(firstMarkerData.qrDataUrl.startsWith("data:image/png;base64,"), "Marker QR was not rendered as PNG");
    const firstJws = firstMarkerData.markerUri.slice("egocapture://marker/".length);
    const firstPayload = await verifyMarkerJws(firstJws, env.markerPublicKeyJwk as JWK, env.markerKeyId);
    assert(
      firstPayload.session_public_id === sessionPublicId &&
        firstPayload.assignment_public_id === assignmentPublicId &&
        firstPayload.device_public_id === devicePublicId,
      "Signed Marker payload authority mismatch",
    );
    assert(!JSON.stringify(firstPayload).match(/email|display|name/i), "Marker payload contains PII-like fields");

    let firstAcknowledgedAt = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const acknowledged = await api<{ data?: { acknowledgedAt: string } }>(
        env.participantSiteUrl,
        `/api/participant/sessions/${sessionPublicId}/marker-acknowledgement`,
        { method: "POST", jar: participantJar },
      );
      assert(acknowledged.response.ok && acknowledged.payload.data?.acknowledgedAt, "Marker acknowledgement failed");
      if (!firstAcknowledgedAt) firstAcknowledgedAt = acknowledged.payload.data.acknowledgedAt;
      else assert(acknowledged.payload.data.acknowledgedAt === firstAcknowledgedAt, "Marker acknowledgement was not idempotent");
    }
    const regenerateKey = randomUUID();
    const regenerated = await api<{ data?: { expiresAt: string } }>(env.participantSiteUrl, `/api/participant/sessions/${sessionPublicId}/marker`, {
      method: "POST", jar: participantJar, headers: { "idempotency-key": regenerateKey },
    });
    assert(regenerated.response.status === 201 && regenerated.payload.data?.expiresAt, "Marker regeneration failed");
    const regeneratedReplay = await api<{ data?: { expiresAt: string } }>(env.participantSiteUrl, `/api/participant/sessions/${sessionPublicId}/marker`, {
      method: "POST", jar: participantJar, headers: { "idempotency-key": regenerateKey },
    });
    assert(regeneratedReplay.payload.data?.expiresAt === regenerated.payload.data.expiresAt, "Marker regeneration replay diverged");
    const secondMarker = await api<{ data?: { markerUri: string } }>(env.participantSiteUrl, `/api/participant/sessions/${sessionPublicId}/marker`, { jar: participantJar });
    assert(secondMarker.payload.data?.markerUri && secondMarker.payload.data.markerUri !== firstMarkerData.markerUri, "Regenerated Marker overwrote or reused the old JWS");
    await verifyMarkerJws(secondMarker.payload.data.markerUri.slice("egocapture://marker/".length), env.markerPublicKeyJwk as JWK, env.markerKeyId);

    const adminLogin = await api<{ data?: { redirectTo: string } }>(env.adminSiteUrl, "/api/auth/admin-login", {
      method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    assert(adminLogin.response.ok, "Session check Admin login failed");
    const closed = await api<{ data?: { status: string } }>(env.adminSiteUrl, `/api/admin/sessions/${sessionPublicId}/close`, {
      method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Integration check explicitly closes the synthetic Recording Session" }),
    });
    assert(closed.response.ok && closed.payload.data?.status === "closed", "Admin Session close failed");
    const secondSession = await api<{ data?: { sessionPublicId: string } }>(env.participantSiteUrl, "/api/participant/sessions", {
      method: "POST", jar: participantJar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({ assignmentPublicId, devicePublicId }),
    });
    assert(secondSession.response.status === 201 && secondSession.payload.data?.sessionPublicId, "Second open Session creation failed");
    const secondSessionPublicId = secondSession.payload.data.sessionPublicId;
    const canceled = await api<{ data?: { status: string } }>(env.adminSiteUrl, `/api/admin/assignments/${assignmentPublicId}/cancel`, {
      method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Integration check cancels Assignment and closes its remaining open Session" }),
    });
    assert(canceled.response.ok && canceled.payload.data?.status === "canceled", "Assignment cancellation failed");
    const closedRegenerate = await api<{ error?: { code: string } }>(env.participantSiteUrl, `/api/participant/sessions/${secondSessionPublicId}/marker`, {
      method: "POST", jar: participantJar, headers: { "idempotency-key": randomUUID() },
    });
    assert(closedRegenerate.response.status === 409 && closedRegenerate.payload.error?.code === "SESSION_CLOSED", "Assignment-canceled Session allowed Marker regeneration");

    let immutableBlocked = false;
    try {
      await db`update egocapture.session_markers set key_id = 'tampered-key' where session_id = (select id from egocapture.recording_sessions where public_id = ${sessionPublicId})`;
    } catch (error) {
      immutableBlocked = (error as { code?: string }).code === "55000";
    }
    assert(immutableBlocked, "Session Marker immutability trigger did not block UPDATE");
    const [evidence] = await db<{
      assignmentStatus: string;
      sessionStatus: string;
      markerCount: number;
      markerAcknowledgedAt: Date | null;
      closedSessionCount: number;
      currentParticipantCount: number;
      backupParticipantStatus: string;
      auditCount: number;
    }[]>`
      select
        assignment.status as assignment_status,
        session.status as session_status,
        (select count(*)::integer from egocapture.session_markers marker where marker.session_id = session.id) as marker_count,
        session.marker_acknowledged_at,
        (select count(*)::integer from egocapture.recording_sessions related
          where related.assignment_id = assignment.id and related.status = 'closed') as closed_session_count,
        (select count(*)::integer from egocapture.assignments current_assignment
          where current_assignment.task_id = assignment.task_id and current_assignment.status <> 'canceled') as current_participant_count,
        (select backup.status from egocapture.assignments backup
          where backup.task_id = assignment.task_id
            and backup.participant_id = ${backupParticipantId}::uuid
          limit 1) as backup_participant_status,
        (select count(*)::integer from egocapture.audit_events audit
          where audit.entity_public_id in (${sessionPublicId}, ${assignmentPublicId})) as audit_count
      from egocapture.recording_sessions session
      join egocapture.assignments assignment on assignment.id = session.assignment_id
      where session.public_id = ${sessionPublicId}
    `;
    assert(
      evidence.assignmentStatus === "canceled" && evidence.sessionStatus === "closed" &&
        evidence.markerCount === 2 && evidence.markerAcknowledgedAt &&
        evidence.closedSessionCount === 2 && evidence.currentParticipantCount === 1 &&
        evidence.backupParticipantStatus === "assigned" && evidence.auditCount >= 5,
      "Session/Marker database or audit evidence mismatch",
    );
  } finally {
    try {
      await db`update egocapture.participants set is_fixture = true where id = ${participantId}::uuid`;
      await db`update egocapture.participants set is_fixture = true where id = ${backupParticipantId}::uuid`;
      await db`update egocapture.devices set is_fixture = true where id = ${deviceId}::uuid`;
      await db`update egocapture.tasks set is_fixture = true where id = ${taskId}::uuid`;
    } finally {
      await db.end({ timeout: 2 });
    }
  }
  console.log(`Recording Session, Ed25519 Marker, QR, acknowledgement, regeneration, immutability, close and audit checks passed; retained Demo Fixture ${sessionPublicId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture Session: ${error.message}` : error);
  process.exitCode = 1;
});
