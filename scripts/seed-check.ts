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
      participantCount: number;
      deviceCount: number;
      taskCount: number;
      versionCount: number;
      assignmentCount: number;
      reviewCount: number;
      openReviewCount: number;
      currentDecisionCount: number;
      currentUnmatchedCount: number;
      credentialCount: number;
    }[]>`
      select
        (select count(*)::int from egocapture.participants where public_id = 'PT-23456789' and is_fixture) as participant_count,
        (select count(*)::int from egocapture.devices where public_id = 'DEV-23456789' and is_fixture) as device_count,
        (select count(*)::int from egocapture.tasks where id::text like '50000000-0000-4000-8000-00000000000%' and is_fixture) as task_count,
        (select count(*)::int from egocapture.task_versions where task_id::text like '50000000-0000-4000-8000-00000000000%') as version_count,
        (select count(*)::int from egocapture.assignments where id::text like '60000000-0000-4000-8000-00000000000%') as assignment_count,
        (select count(*)::int from egocapture.review_cases where public_id = any(${expectedReviewIds})) as review_count,
        (select count(*)::int from egocapture.review_cases where public_id = any(${expectedReviewIds}) and status = 'open' and is_fixture) as open_review_count,
        (select count(*)::int from egocapture.match_decisions where video_asset_id = '74000000-0000-4000-8000-000000000001'::uuid and superseded_by is null) as current_decision_count,
        (select count(*)::int from egocapture.match_decisions where video_asset_id = '74000000-0000-4000-8000-000000000001'::uuid and superseded_by is null and decision_type = 'unmatched' and resolved_session_id is null) as current_unmatched_count,
        (select count(*)::int
         from egocapture.participant_login_credentials credential
         where credential.participant_id = '30000000-0000-4000-8000-000000000001'::uuid
           and credential.password = ${env.demoParticipantPassword}
           and credential.version > 0
           and credential.synced_at >= credential.updated_at) as credential_count
    `;
    assert(baseline.participantCount === 1, "Demo Participant 基线不唯一");
    assert(baseline.deviceCount === 1, "Demo Device 基线不唯一");
    assert(baseline.taskCount === 4, "Demo Task 基线应为 4 个");
    assert(baseline.versionCount === 4, "Demo TaskVersion 基线应为 4 个不可变快照");
    assert(baseline.assignmentCount === 4, "Demo Assignment 基线应为 4 个");
    assert(baseline.reviewCount === 7 && baseline.openReviewCount === 7, "7 个 Demo ReviewCase 必须全部恢复为 open");
    assert(baseline.currentDecisionCount === 1 && baseline.currentUnmatchedCount === 1, "Fixture 资产必须恰有一个 current unmatched MatchDecision");
    assert(baseline.credentialCount === 1, "Demo Participant 可查密码未与 Auth 同步");

    const [states] = await db<{
      participantStatus: string;
      consentStatus: string;
      sessionStatus: string;
      metadataStatus: string;
      assetStatus: string;
      failedTransferStatus: string;
      missingCount: number;
      authenticatedCanReadCredentials: boolean;
      anonCanReadCredentials: boolean;
    }[]>`
      select
        (select status from egocapture.participants where id = '30000000-0000-4000-8000-000000000001'::uuid) as participant_status,
        (select consent_status from egocapture.participants where id = '30000000-0000-4000-8000-000000000001'::uuid) as consent_status,
        (select status from egocapture.recording_sessions where id = '61000000-0000-4000-8000-000000000001'::uuid) as session_status,
        (select metadata_status from egocapture.upload_intents where id = '71000000-0000-4000-8000-000000000001'::uuid) as metadata_status,
        (select status from egocapture.video_assets where id = '74000000-0000-4000-8000-000000000001'::uuid) as asset_status,
        (select transfer_status from egocapture.upload_intents where id = '71000000-0000-4000-8000-000000000002'::uuid) as failed_transfer_status,
        (select count(*)::int from egocapture.missing_assignments where id = '60000000-0000-4000-8000-000000000002'::uuid) as missing_count,
        has_table_privilege('authenticated', 'egocapture.participant_login_credentials', 'select') as authenticated_can_read_credentials,
        has_table_privilege('anon', 'egocapture.participant_login_credentials', 'select') as anon_can_read_credentials
    `;
    assert(states.participantStatus === "active" && states.consentStatus === "valid", "Demo Participant 未恢复 active/valid");
    assert(states.sessionStatus === "open", "Demo Recording Session 未恢复 open");
    assert(states.metadataStatus === "failed" && states.assetStatus === "active", "Metadata Failed Fixture 分层状态错误");
    assert(states.failedTransferStatus === "failed", "Upload Failed Fixture 状态错误");
    assert(states.missingCount === 1, "Missing Assignment 必须由实时视图判定");
    assert(
      !states.authenticatedCanReadCredentials && !states.anonCanReadCredentials,
      "浏览器角色不得直接读取 Participant 凭据表",
    );

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
            id, public_id, manufacturer, model, device_type, serial_hmac
          ) values
            (${randomUUID()}::uuid, 'DEV-TESTAB', 'Test', 'No Serial A', 'camera', null),
            (${randomUUID()}::uuid, 'DEV-TESTAC', 'Test', 'No Serial B', 'camera', null)
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
            id, public_id, manufacturer, model, device_type, serial_hmac
          ) values
            (${randomUUID()}::uuid, 'DEV-TESTAD', 'Test', 'Duplicate Serial A', 'camera', ${duplicateSerial}),
            (${randomUUID()}::uuid, 'DEV-TESTAE', 'Test', 'Duplicate Serial B', 'camera', ${duplicateSerial})
        `;
      });
    } catch (error) {
      duplicateSerialRejected =
        typeof error === "object" && error !== null && "code" in error && error.code === "23505";
      if (!duplicateSerialRejected) throw error;
    }
    assert(duplicateSerialRejected, "重复的非空 serial_hmac 必须被拒绝");

    const [multipartReservation] = await db<{
      reservedColumns: number;
      partTableHasRls: boolean;
    }[]>`
      select
        (select count(*)::integer
          from information_schema.columns
          where table_schema = 'egocapture'
            and table_name = 'upload_attempts'
            and column_name in ('provider_upload_id', 'expires_at', 'storage_region', 'part_manifest', 'completion_receipt')) as reserved_columns,
        coalesce((select relation.relrowsecurity
          from pg_class relation
          join pg_namespace namespace on namespace.oid = relation.relnamespace
          where namespace.nspname = 'egocapture'
            and relation.relname = 'multipart_upload_parts'), false) as part_table_has_rls
    `;
    assert(
      multipartReservation.reservedColumns === 5 && multipartReservation.partTableHasRls,
      "Multipart 演进字段或 part 表 RLS 未完成预留",
    );

    console.log("Demo Seed 验证通过：基线、Missing 语义、可选设备序列号、Multipart 预留与不可变 current MatchDecision");
  } finally {
    await db.end({ timeout: 2 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture seed check: ${error.message}` : error);
  process.exitCode = 1;
});
