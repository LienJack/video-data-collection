import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { assert, integrationEnvironment } from "@/scripts/check-support";

const expectedReviewIds = [
  "RV-23456782",
  "RV-23456783",
  "RV-23456784",
  "RV-23456785",
  "RV-23456786",
  "RV-23456787",
  "RV-23456788",
];

async function main() {
  const env = integrationEnvironment();
  const db = postgres(env.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
    transform: postgres.camel,
  });
  try {
    const [baseline] = await db<{
      studyCount: number;
      participantCount: number;
      deviceCount: number;
      taskCount: number;
      versionCount: number;
      assignmentCount: number;
      reviewCount: number;
      openReviewCount: number;
      currentDecisionCount: number;
      currentUnmatchedCount: number;
    }[]>`
      select
        (select count(*)::int from egocapture.studies where public_id = 'ST-23456789' and is_demo) as study_count,
        (select count(*)::int from egocapture.participants where public_id = 'PT-23456789' and is_fixture) as participant_count,
        (select count(*)::int from egocapture.devices where public_id = 'DEV-23456789' and is_fixture) as device_count,
        (select count(*)::int from egocapture.tasks where id::text like '50000000-0000-4000-8000-00000000000%' and is_fixture) as task_count,
        (select count(*)::int from egocapture.task_versions where task_id::text like '50000000-0000-4000-8000-00000000000%') as version_count,
        (select count(*)::int from egocapture.assignments where id::text like '60000000-0000-4000-8000-00000000000%') as assignment_count,
        (select count(*)::int from egocapture.review_cases where public_id = any(${expectedReviewIds})) as review_count,
        (select count(*)::int from egocapture.review_cases where public_id = any(${expectedReviewIds}) and status = 'open' and is_fixture) as open_review_count,
        (select count(*)::int from egocapture.match_decisions where video_asset_id = '74000000-0000-4000-8000-000000000001'::uuid and superseded_by is null) as current_decision_count,
        (select count(*)::int from egocapture.match_decisions where video_asset_id = '74000000-0000-4000-8000-000000000001'::uuid and superseded_by is null and decision_type = 'unmatched' and resolved_session_id is null) as current_unmatched_count
    `;
    assert(baseline.studyCount === 1, "Demo Study 基线不唯一");
    assert(baseline.participantCount === 1, "Demo Participant 基线不唯一");
    assert(baseline.deviceCount === 1, "Demo Device 基线不唯一");
    assert(baseline.taskCount === 4, "Demo Task 基线应为 4 个");
    assert(baseline.versionCount === 4, "Demo TaskVersion 基线应为 4 个不可变快照");
    assert(baseline.assignmentCount === 4, "Demo Assignment 基线应为 4 个");
    assert(baseline.reviewCount === 7 && baseline.openReviewCount === 7, "7 个 Demo ReviewCase 必须全部恢复为 open");
    assert(baseline.currentDecisionCount === 1 && baseline.currentUnmatchedCount === 1, "Fixture 资产必须恰有一个 current unmatched MatchDecision");

    const [states] = await db<{
      participantStatus: string;
      consentStatus: string;
      sessionStatus: string;
      metadataStatus: string;
      assetStatus: string;
      failedTransferStatus: string;
      missingCount: number;
    }[]>`
      select
        (select status from egocapture.participants where id = '30000000-0000-4000-8000-000000000001'::uuid) as participant_status,
        (select consent_status from egocapture.participants where id = '30000000-0000-4000-8000-000000000001'::uuid) as consent_status,
        (select status from egocapture.recording_sessions where id = '61000000-0000-4000-8000-000000000001'::uuid) as session_status,
        (select metadata_status from egocapture.upload_intents where id = '71000000-0000-4000-8000-000000000001'::uuid) as metadata_status,
        (select status from egocapture.video_assets where id = '74000000-0000-4000-8000-000000000001'::uuid) as asset_status,
        (select transfer_status from egocapture.upload_intents where id = '71000000-0000-4000-8000-000000000002'::uuid) as failed_transfer_status,
        (select count(*)::int from egocapture.missing_assignments where id = '60000000-0000-4000-8000-000000000002'::uuid) as missing_count
    `;
    assert(states.participantStatus === "active" && states.consentStatus === "valid", "Demo Participant 未恢复 active/valid");
    assert(states.sessionStatus === "open", "Demo Recording Session 未恢复 open");
    assert(states.metadataStatus === "failed" && states.assetStatus === "active", "Metadata Failed Fixture 分层状态错误");
    assert(states.failedTransferStatus === "failed", "Upload Failed Fixture 状态错误");
    assert(states.missingCount === 1, "Missing Assignment 必须由实时视图判定");

    const rollbackMarker = new Error("ROLLBACK_ACCEPTED_ASSET_CHECK");
    try {
      await db.begin(async (transaction) => {
        const [current] = await transaction<{ id: string }[]>`
          select id from egocapture.match_decisions
          where video_asset_id = '74000000-0000-4000-8000-000000000001'::uuid
            and superseded_by is null
          for update
        `;
        const participantClaimId = randomUUID();
        await transaction`set constraints all deferred`;
        await transaction`
          update egocapture.match_decisions set superseded_by = ${participantClaimId}::uuid
          where id = ${current.id}::uuid
        `;
        await transaction`
          insert into egocapture.match_decisions (
            id, video_asset_id, claimed_session_id, resolved_session_id, resolved_device_id,
            decision_type, supersedes_decision_id, decided_by
          ) values (
            ${participantClaimId}::uuid, '74000000-0000-4000-8000-000000000001'::uuid,
            '61000000-0000-4000-8000-000000000001'::uuid,
            '61000000-0000-4000-8000-000000000001'::uuid,
            '40000000-0000-4000-8000-000000000001'::uuid,
            'participant_claim', ${current.id}::uuid,
            '20000000-0000-4000-8000-000000000002'::uuid
          )
        `;
        await transaction`
          update egocapture.assignments set due_at = now() - interval '1 minute'
          where id = '60000000-0000-4000-8000-000000000003'::uuid
        `;
        const [claimProgress] = await transaction<{ acceptedAssetCandidates: number; isMissing: boolean }[]>`
          select accepted_asset_candidates::integer, is_missing
          from egocapture.assignment_progress
          where id = '60000000-0000-4000-8000-000000000003'::uuid
        `;
        assert(claimProgress.acceptedAssetCandidates === 0 && claimProgress.isMissing, "Participant claim 不得冒充 accepted asset");

        const confirmedId = randomUUID();
        await transaction`
          update egocapture.match_decisions set superseded_by = ${confirmedId}::uuid
          where id = ${participantClaimId}::uuid
        `;
        await transaction`
          insert into egocapture.match_decisions (
            id, video_asset_id, claimed_session_id, resolved_session_id, resolved_device_id,
            decision_type, reason, supersedes_decision_id, decided_by
          ) values (
            ${confirmedId}::uuid, '74000000-0000-4000-8000-000000000001'::uuid,
            '61000000-0000-4000-8000-000000000001'::uuid,
            '61000000-0000-4000-8000-000000000001'::uuid,
            '40000000-0000-4000-8000-000000000001'::uuid,
            'admin_confirmed', 'Seed check confirms accepted asset semantics',
            ${participantClaimId}::uuid, '20000000-0000-4000-8000-000000000001'::uuid
          )
        `;
        const [confirmedProgress] = await transaction<{ acceptedAssetCandidates: number; isMissing: boolean }[]>`
          select accepted_asset_candidates::integer, is_missing
          from egocapture.assignment_progress
          where id = '60000000-0000-4000-8000-000000000003'::uuid
        `;
        assert(confirmedProgress.acceptedAssetCandidates === 1 && !confirmedProgress.isMissing, "Admin-confirmed asset 必须解除 Missing");
        throw rollbackMarker;
      });
    } catch (error) {
      if (error !== rollbackMarker) throw error;
    }

    const optionalSerialRollback = new Error("ROLLBACK_OPTIONAL_SERIAL_CHECK");
    try {
      await db.begin(async (transaction) => {
        await transaction`
          insert into egocapture.devices (
            id, public_id, study_id, manufacturer, model, device_type, serial_hmac
          ) values
            (${randomUUID()}::uuid, 'DEV-TESTAB', '10000000-0000-4000-8000-000000000001'::uuid, 'Test', 'No Serial A', 'camera', null),
            (${randomUUID()}::uuid, 'DEV-TESTAC', '10000000-0000-4000-8000-000000000001'::uuid, 'Test', 'No Serial B', 'camera', null)
        `;
        throw optionalSerialRollback;
      });
    } catch (error) {
      if (error !== optionalSerialRollback) throw error;
    }

    let duplicateSerialRejected = false;
    try {
      await db.begin(async (transaction) => {
        const duplicateSerial = "a".repeat(64);
        await transaction`
          insert into egocapture.devices (
            id, public_id, study_id, manufacturer, model, device_type, serial_hmac
          ) values
            (${randomUUID()}::uuid, 'DEV-TESTAD', '10000000-0000-4000-8000-000000000001'::uuid, 'Test', 'Duplicate Serial A', 'camera', ${duplicateSerial}),
            (${randomUUID()}::uuid, 'DEV-TESTAE', '10000000-0000-4000-8000-000000000001'::uuid, 'Test', 'Duplicate Serial B', 'camera', ${duplicateSerial})
        `;
      });
    } catch (error) {
      duplicateSerialRejected =
        typeof error === "object" && error !== null && "code" in error && error.code === "23505";
      if (!duplicateSerialRejected) throw error;
    }
    assert(duplicateSerialRejected, "相同 Study 的重复非空 serial_hmac 必须被拒绝");

    console.log("Demo Seed 验证通过：基线、Missing 语义、可选设备序列号与不可变 current MatchDecision");
  } finally {
    await db.end({ timeout: 2 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture seed check: ${error.message}` : error);
  process.exitCode = 1;
});
