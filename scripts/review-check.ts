import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { api, assert, CookieJar, integrationEnvironment } from "@/scripts/check-support";
import { createPublicId } from "@egocapture/core/domain/public-id";

async function main() {
  const env = integrationEnvironment();
  const db = postgres(env.databaseUrl, { max: 1, prepare: false, connect_timeout: 8, transform: postgres.camel });
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const jar = new CookieJar();
  const suffix = randomUUID();
  const email = `egocapture-review-${suffix}@demo.invalid`;
  const password = randomBytes(24).toString("base64url");
  let adminUserId: string | undefined;
  let reviewPublicId = "";
  let uploadPublicId = "";
  let oldDecisionId = "";
  let correctedSessionPublicId = "";
  try {
    const [fixture] = await db<{
      studyId: string;
      participantId: string;
      participantPublicId: string;
      assignmentId: string;
      assignmentPublicId: string;
      taskVersionId: string;
      deviceId: string;
      devicePublicId: string;
      videoAssetId: string;
      videoAssetPublicId: string;
      uploadPublicId: string;
      currentDecisionId: string;
      currentSessionPublicId: string;
    }[]>`
      select intent.study_id, intent.participant_id, participant.public_id as participant_public_id,
        session.assignment_id, assignment.public_id as assignment_public_id,
        session.task_version_id, session.declared_device_id as device_id,
        device.public_id as device_public_id, asset.id as video_asset_id,
        asset.public_id as video_asset_public_id, intent.public_id as upload_public_id,
        decision.id as current_decision_id, session.public_id as current_session_public_id
      from egocapture.upload_intents intent
      join egocapture.participants participant on participant.id = intent.participant_id
      join egocapture.video_assets asset on asset.upload_intent_id = intent.id
      join egocapture.current_match_decisions decision on decision.video_asset_id = asset.id
      join egocapture.recording_sessions session on session.id = decision.resolved_session_id
      join egocapture.assignments assignment on assignment.id = session.assignment_id
      join egocapture.devices device on device.id = session.declared_device_id
      where intent.transfer_status = 'verified'
        and intent.metadata_status = 'extracted'
        and decision.decision_type = 'participant_claim'
        and participant.is_fixture
      order by intent.created_at desc
      limit 1
    `;
    assert(fixture, "Review check needs a retained successful upload fixture; run pnpm upload:test first");
    uploadPublicId = fixture.uploadPublicId;
    oldDecisionId = fixture.currentDecisionId;

    const { data: admin, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !admin.user) throw error || new Error("Review Admin Auth creation failed");
    adminUserId = admin.user.id;
    const [profile] = await db<{ id: string }[]>`
      insert into egocapture.profiles (auth_user_id, role, display_name)
      values (${adminUserId}::uuid, 'admin', 'Review Integration Admin') returning id
    `;
    await db`
      insert into egocapture.study_memberships (study_id, profile_id, role, status)
      values (${fixture.studyId}::uuid, ${profile.id}::uuid, 'admin', 'active')
    `;
    correctedSessionPublicId = createPublicId("RS");
    const correctedSessionId = randomUUID();
    await db`
      insert into egocapture.recording_sessions (
        id, public_id, assignment_id, participant_id, study_id, task_version_id,
        declared_device_id, timezone, status, marker_acknowledged_at
      ) values (
        ${correctedSessionId}::uuid, ${correctedSessionPublicId}, ${fixture.assignmentId}::uuid,
        ${fixture.participantId}::uuid, ${fixture.studyId}::uuid, ${fixture.taskVersionId}::uuid,
        ${fixture.deviceId}::uuid, 'Asia/Shanghai', 'open', now()
      )
    `;
    reviewPublicId = createPublicId("RV");
    await db`
      insert into egocapture.review_cases (
        public_id, study_id, video_asset_id, assignment_id, case_type, reason, is_fixture
      ) values (
        ${reviewPublicId}, ${fixture.studyId}::uuid, ${fixture.videoAssetId}::uuid,
        ${fixture.assignmentId}::uuid, 'needs_review', 'integration_fixture_requires_session_correction', true
      )
    `;

    const login = await api(env.siteUrl, "/api/auth/admin-login", {
      method: "POST", jar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert(login.response.ok, "Review Admin login failed");
    const listed = await api<{ data?: { items: Array<{ publicId: string }> } }>(env.siteUrl, "/api/admin/review-cases?status=open", { jar });
    assert(listed.response.ok && listed.payload.data?.items.some((item) => item.publicId === reviewPublicId), "Open ReviewCase was not listed");

    const idempotencyKey = randomUUID();
    const decision = await api<{ data?: { status: string; matchDecisionId: string } }>(
      env.siteUrl,
      `/api/admin/review-cases/${reviewPublicId}/decision`,
      {
        method: "POST", jar,
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({
          action: "correct_match",
          reason: "Physical integration correction to the second declared recording session.",
          sessionPublicId: correctedSessionPublicId,
          devicePublicId: fixture.devicePublicId,
        }),
      },
    );
    assert(decision.response.ok && decision.payload.data?.status === "resolved" && decision.payload.data.matchDecisionId, "Admin Correct Session failed");
    const replay = await api<{ data?: { matchDecisionId: string } }>(
      env.siteUrl,
      `/api/admin/review-cases/${reviewPublicId}/decision`,
      {
        method: "POST", jar,
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({
          action: "correct_match",
          reason: "Physical integration correction to the second declared recording session.",
          sessionPublicId: correctedSessionPublicId,
          devicePublicId: fixture.devicePublicId,
        }),
      },
    );
    assert(replay.response.ok && replay.payload.data?.matchDecisionId === decision.payload.data.matchDecisionId, "Review decision replay was not idempotent");

    const signed = await api<{ data?: { signedUrl: string } }>(env.siteUrl, `/api/admin/uploads/${uploadPublicId}/signed-url`, { jar });
    assert(signed.response.ok && signed.payload.data?.signedUrl, "Admin private signed URL failed");
    const range = await fetch(signed.payload.data.signedUrl, { headers: { range: "bytes=0-31" } });
    assert(range.status === 206 && (await range.arrayBuffer()).byteLength === 32, "Signed preview URL did not return a private Range response");

    const [evidence] = await db<{
      reviewStatus: string;
      resolutionReason: string;
      decisionCount: number;
      currentDecisionId: string;
      currentDecisionType: string;
      currentSessionPublicId: string;
      oldSupersededBy: string | null;
      newSupersedes: string | null;
      assignmentStatus: string;
      openSessionCount: number;
      auditCount: number;
    }[]>`
      select review.status as review_status, review.resolution_reason,
        (select count(*)::integer from egocapture.match_decisions where video_asset_id = ${fixture.videoAssetId}::uuid) as decision_count,
        current.id as current_decision_id, current.decision_type as current_decision_type,
        session.public_id as current_session_public_id,
        old.superseded_by as old_superseded_by,
        current.supersedes_decision_id as new_supersedes,
        assignment.status as assignment_status,
        (select count(*)::integer from egocapture.recording_sessions candidate
          where candidate.assignment_id = assignment.id and candidate.status = 'open') as open_session_count,
        (select count(*)::integer from egocapture.audit_events audit
          where audit.entity_public_id = ${reviewPublicId} and audit.action = 'review_case.correct_match') as audit_count
      from egocapture.review_cases review
      join egocapture.video_assets asset on asset.id = review.video_asset_id
      join egocapture.current_match_decisions current on current.video_asset_id = asset.id
      join egocapture.match_decisions old on old.id = ${oldDecisionId}::uuid
      join egocapture.recording_sessions session on session.id = current.resolved_session_id
      join egocapture.assignments assignment on assignment.id = session.assignment_id
      where review.public_id = ${reviewPublicId}
    `;
    assert(
      evidence.reviewStatus === "resolved" && evidence.resolutionReason?.length >= 10
        && evidence.decisionCount === 2 && evidence.currentDecisionType === "admin_corrected"
        && evidence.currentSessionPublicId === correctedSessionPublicId
        && evidence.oldSupersededBy === evidence.currentDecisionId
        && evidence.newSupersedes === oldDecisionId && evidence.assignmentStatus === "accepted"
        && evidence.openSessionCount === 0
        && evidence.auditCount === 1,
      "Immutable MatchDecision chain, ReviewCase, Assignment or Audit evidence mismatch",
    );

    let updateRejected = false;
    let deleteRejected = false;
    try { await db`update egocapture.match_decisions set reason = 'illegal historical rewrite' where id = ${evidence.currentDecisionId}::uuid`; } catch { updateRejected = true; }
    try { await db`delete from egocapture.match_decisions where id = ${oldDecisionId}::uuid`; } catch { deleteRejected = true; }
    assert(updateRejected && deleteRejected, "Database allowed MatchDecision UPDATE or DELETE");
  } finally {
    await db.end({ timeout: 2 });
  }
  console.log(`Admin Review correction, immutable decision chain, idempotency, signed Range preview and Audit passed; retained Demo Fixture ${reviewPublicId} / ${uploadPublicId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture Review: ${error.message}` : error);
  process.exitCode = 1;
});
