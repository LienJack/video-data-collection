import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { api, assert, integrationEnvironment } from "@/scripts/check-support";
import { createPublicId } from "@egocapture/core/domain/public-id";

async function main() {
  const env = integrationEnvironment();
  const db = postgres(env.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
    transform: postgres.camel,
  });
  const batchId = randomUUID();
  const expiredId = randomUUID();
  const reconcilingId = randomUUID();
  const attemptId = randomUUID();
  const batchPublicId = createPublicId("UB");
  const expiredPublicId = createPublicId("UP");
  const reconcilingPublicId = createPublicId("UP");
  try {
    await db.begin(async (transaction) => {
      await transaction`
        insert into egocapture.upload_batches (id, public_id, study_id, participant_id)
        values (
          ${batchId}::uuid, ${batchPublicId},
          '10000000-0000-4000-8000-000000000001'::uuid,
          '30000000-0000-4000-8000-000000000001'::uuid
        )
      `;
      await transaction`
        insert into egocapture.upload_intents (
          id, public_id, batch_id, study_id, participant_id, original_filename,
          size_bytes, content_type, extension, object_key, unable_to_determine,
          fingerprint_v1, transfer_status, metadata_status, expected_expires_at,
          created_at, updated_at
        ) values
        (
          ${expiredId}::uuid, ${expiredPublicId}, ${batchId}::uuid,
          '10000000-0000-4000-8000-000000000001'::uuid,
          '30000000-0000-4000-8000-000000000001'::uuid,
          'cron-expired.mp4', 1000, 'video/mp4', 'mp4',
          ${`study/10000000-0000-4000-8000-000000000001/participant/30000000-0000-4000-8000-000000000001/upload/${expiredId}/${randomUUID()}.mp4`},
          true, ${"c".repeat(64)}, 'created', 'pending', now() - interval '1 hour',
          now() - interval '2 hours', now() - interval '2 hours'
        ),
        (
          ${reconcilingId}::uuid, ${reconcilingPublicId}, ${batchId}::uuid,
          '10000000-0000-4000-8000-000000000001'::uuid,
          '30000000-0000-4000-8000-000000000001'::uuid,
          'cron-reconciling.mp4', 1000, 'video/mp4', 'mp4',
          ${`study/10000000-0000-4000-8000-000000000001/participant/30000000-0000-4000-8000-000000000001/upload/${reconcilingId}/${randomUUID()}.mp4`},
          true, ${"d".repeat(64)}, 'reconciling', 'pending', now() + interval '1 day',
          now() - interval '2 hours', now() - interval '2 hours'
        )
      `;
      await transaction`
        insert into egocapture.upload_attempts (
          id, public_id, upload_intent_id, attempt_number, status, started_at
        ) values (${attemptId}::uuid, ${createPublicId("UA")}, ${expiredId}::uuid, 1, 'uploading', now() - interval '2 hours')
      `;
      await transaction`
        update egocapture.assignments set status = 'session_created'
        where id = '60000000-0000-4000-8000-000000000001'::uuid
      `;
      await transaction`
        update egocapture.recording_sessions
        set status = 'closed', closed_at = now(), close_reason = 'Cron baseline test mutation'
        where id = '61000000-0000-4000-8000-000000000001'::uuid
      `;
      await transaction`
        update egocapture.review_cases
        set status = 'resolved', resolution_reason = 'Cron baseline test mutation', resolved_at = now()
        where public_id = 'RV-23456782' and is_fixture
      `;
    });

    const unauthorized = await api<{ error?: { code: string } }>(env.adminSiteUrl, "/api/cron/reconcile");
    assert(unauthorized.response.status === 401 && unauthorized.payload.error?.code === "CRON_UNAUTHORIZED", "Cron must reject a missing Bearer secret");

    const authorized = await api<{ data?: {
      expired: number;
      reconciliationFailures: number;
      demoBaselineRepaired: boolean;
    } }>(env.adminSiteUrl, "/api/cron/reconcile", {
      headers: { authorization: `Bearer ${env.cronSecret}` },
    });
    assert(authorized.response.ok, "Authorized Cron request failed");
    assert((authorized.payload.data?.expired ?? 0) >= 1, "Cron did not expire the stale UploadIntent");
    assert((authorized.payload.data?.reconciliationFailures ?? 0) >= 1, "Cron did not reconcile the missing Storage object");
    assert(authorized.payload.data?.demoBaselineRepaired === true, "Cron did not repair the Demo baseline");

    const [result] = await db<{
      expiredStatus: string;
      expiredAttemptStatus: string;
      reconcilingStatus: string;
      expiredReviewCount: number;
      reconcilingReviewCount: number;
      assignmentStatus: string;
      sessionStatus: string;
      reviewStatus: string;
    }[]>`
      select
        (select transfer_status from egocapture.upload_intents where id = ${expiredId}::uuid) as expired_status,
        (select status from egocapture.upload_attempts where id = ${attemptId}::uuid) as expired_attempt_status,
        (select transfer_status from egocapture.upload_intents where id = ${reconcilingId}::uuid) as reconciling_status,
        (select count(*)::int from egocapture.review_cases where upload_intent_id = ${expiredId}::uuid and case_type = 'upload_failed') as expired_review_count,
        (select count(*)::int from egocapture.review_cases where upload_intent_id = ${reconcilingId}::uuid and case_type = 'upload_failed') as reconciling_review_count,
        (select status from egocapture.assignments where id = '60000000-0000-4000-8000-000000000001'::uuid) as assignment_status,
        (select status from egocapture.recording_sessions where id = '61000000-0000-4000-8000-000000000001'::uuid) as session_status,
        (select status from egocapture.review_cases where public_id = 'RV-23456782') as review_status
    `;
    assert(result.expiredStatus === "expired" && result.expiredAttemptStatus === "expired", "Expired UploadIntent layers are inconsistent");
    assert(result.reconcilingStatus === "failed", "Missing object did not become transfer failed");
    assert(result.expiredReviewCount === 1 && result.reconcilingReviewCount === 1, "Cron must open one Upload Failed case per stale upload");
    assert(result.assignmentStatus === "assigned" && result.sessionStatus === "open" && result.reviewStatus === "open", "Demo baseline was not restored");

    console.log(`Cron 验证通过：unauthorized=401, expired=${expiredPublicId}, reconciled=${reconcilingPublicId}, Demo baseline restored`);
  } finally {
    await db.begin(async (transaction) => {
      await transaction`delete from egocapture.review_cases where upload_intent_id in (${expiredId}::uuid, ${reconcilingId}::uuid)`;
      await transaction`delete from egocapture.upload_attempts where upload_intent_id in (${expiredId}::uuid, ${reconcilingId}::uuid)`;
      await transaction`delete from egocapture.upload_intents where id in (${expiredId}::uuid, ${reconcilingId}::uuid)`;
      await transaction`delete from egocapture.upload_batches where id = ${batchId}::uuid`;
    }).catch(() => undefined);
    await db.end({ timeout: 2 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture cron check: ${error.message}` : error);
  process.exitCode = 1;
});
