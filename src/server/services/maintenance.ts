import "server-only";

import { randomUUID } from "node:crypto";
import { STORAGE_BUCKET } from "@/src/domain/constants";
import { createPublicId } from "@/src/domain/public-id";
import { writeAudit } from "@/src/server/audit";
import type { Viewer } from "@/src/server/auth";
import { database } from "@/src/server/database";
import { extractUploadMetadata } from "@/src/server/services/metadata";
import { completeUpload } from "@/src/server/services/uploads";
import { createSupabaseAdminClient } from "@/src/server/supabase/admin";

const MAX_CRON_ITEMS = 10;
const FIXTURE_ASSET_ID = "74000000-0000-4000-8000-000000000001";
const FIXTURE_STORED_OBJECT_ID = "73000000-0000-4000-8000-000000000001";
const FIXTURE_REVIEW_IDS = [
  "RV-23456782",
  "RV-23456783",
  "RV-23456784",
  "RV-23456785",
  "RV-23456786",
  "RV-23456787",
  "RV-23456788",
];

type MaintenanceViewer = Viewer & { uploadPublicId: string };

async function expireUploadIntents(limit: number) {
  if (limit <= 0) return 0;
  const db = database();
  return await db.begin(async (transaction) => {
    const uploads = await transaction<{
      id: string;
      publicId: string;
      studyId: string;
      isFixture: boolean;
    }[]>`
      select intent.id, intent.public_id, intent.study_id, participant.is_fixture
      from egocapture.upload_intents intent
      join egocapture.participants participant on participant.id = intent.participant_id
      where intent.transfer_status in ('created', 'uploading')
        and intent.expected_expires_at < now()
      order by intent.expected_expires_at, intent.id
      for update of intent skip locked
      limit ${limit}
    `;
    for (const upload of uploads) {
      await transaction`
        update egocapture.upload_intents
        set transfer_status = 'expired', failure_code = 'upload_intent_expired'
        where id = ${upload.id}::uuid
      `;
      await transaction`
        update egocapture.upload_attempts
        set status = 'expired', error_code = 'upload_intent_expired'
        where upload_intent_id = ${upload.id}::uuid
          and status in ('created', 'uploading', 'paused')
      `;
      await transaction`
        insert into egocapture.review_cases (
          public_id, study_id, upload_intent_id, case_type, reason, is_fixture
        ) select ${createPublicId("RV")}, ${upload.studyId}::uuid, ${upload.id}::uuid,
          'upload_failed', 'upload_intent_expired', ${upload.isFixture}
        where not exists (
          select 1 from egocapture.review_cases
          where upload_intent_id = ${upload.id}::uuid
            and case_type = 'upload_failed' and status in ('open', 'in_review')
        )
      `;
      await writeAudit(transaction, {
        studyId: upload.studyId,
        actorProfileId: null,
        actorAuthUserId: null,
        action: "upload.expired",
        entityType: "upload_intent",
        entityPublicId: upload.publicId,
        requestId: randomUUID(),
        afterValues: { transferStatus: "expired", failureCode: "upload_intent_expired" },
        metadata: { source: "daily_cron" },
      });
    }
    return uploads.length;
  });
}

async function reconciliationViewers(limit: number): Promise<MaintenanceViewer[]> {
  if (limit <= 0) return [];
  const db = database();
  return await db<MaintenanceViewer[]>`
    select profile.id as profile_id, profile.auth_user_id, profile.role,
      profile.display_name, profile.is_demo_admin, intent.public_id as upload_public_id
    from egocapture.upload_intents intent
    join egocapture.participants participant on participant.id = intent.participant_id
    join egocapture.profiles profile on profile.auth_user_id = participant.auth_user_id
    where intent.transfer_status = 'reconciling'
      and intent.updated_at < now() - interval '10 minutes'
      and profile.role = 'participant'
    order by intent.updated_at, intent.id
    limit ${limit}
  `;
}

async function metadataViewers(limit: number): Promise<MaintenanceViewer[]> {
  if (limit <= 0) return [];
  const db = database();
  const viewers = await db<MaintenanceViewer[]>`
    select profile.id as profile_id, profile.auth_user_id, profile.role,
      profile.display_name, profile.is_demo_admin, intent.public_id as upload_public_id
    from egocapture.upload_intents intent
    join egocapture.participants participant on participant.id = intent.participant_id
    join egocapture.profiles profile on profile.auth_user_id = participant.auth_user_id
    where intent.transfer_status = 'verified'
      and (
        intent.metadata_status = 'pending'
        or (intent.metadata_status = 'processing' and intent.updated_at < now() - interval '30 minutes')
      )
      and profile.role = 'participant'
    order by (intent.metadata_status = 'processing') desc, intent.updated_at, intent.id
    limit ${limit}
  `;
  const stuckIds = viewers.map((viewer) => viewer.uploadPublicId);
  if (stuckIds.length > 0) {
    await db.begin(async (transaction) => {
      await transaction`
        update egocapture.metadata_attempts attempt
        set status = 'failed', completed_at = now(), error_code = 'cron_stuck_processing'
        from egocapture.video_assets asset
        join egocapture.upload_intents intent on intent.id = asset.upload_intent_id
        where attempt.video_asset_id = asset.id and attempt.status = 'processing'
          and intent.public_id = any(${stuckIds})
          and intent.metadata_status = 'processing'
          and intent.updated_at < now() - interval '30 minutes'
      `;
      await transaction`
        update egocapture.upload_intents
        set metadata_status = 'pending'
        where public_id = any(${stuckIds}) and metadata_status = 'processing'
          and updated_at < now() - interval '30 minutes'
      `;
    });
  }
  return viewers;
}

async function cleanExpiredDemoObjects() {
  const db = database();
  const objects = await db<{
    id: string;
    objectKey: string;
    studyId: string;
    assetId: string;
    assetPublicId: string;
  }[]>`
    select object.id, object.object_key, asset.study_id, asset.id as asset_id,
      asset.public_id as asset_public_id
    from egocapture.stored_objects object
    join egocapture.asset_files file on file.stored_object_id = object.id and file.file_role = 'source'
    join egocapture.video_assets asset on asset.id = file.video_asset_id
    join egocapture.participants participant on participant.id = asset.participant_id
    join egocapture.studies study on study.id = asset.study_id
    where object.deleted_at is null
      and object.created_at < now() - interval '7 days'
      and (participant.is_fixture or study.is_demo)
      and object.id <> ${FIXTURE_STORED_OBJECT_ID}::uuid
    order by object.created_at, object.id
    limit ${MAX_CRON_ITEMS}
  `;
  const supabase = createSupabaseAdminClient();
  let deleted = 0;
  for (const object of objects) {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([object.objectKey]);
    if (error) continue;
    await db.begin(async (transaction) => {
      const updated = await transaction`
        update egocapture.stored_objects
        set deleted_at = now(), delete_reason = 'demo_retention_7d'
        where id = ${object.id}::uuid and deleted_at is null
        returning id
      `;
      if (updated.length === 0) return;
      await transaction`
        update egocapture.video_assets set status = 'deleted'
        where id = ${object.assetId}::uuid
      `;
      await transaction`
        update egocapture.review_cases
        set status = 'dismissed', resolution_reason = 'Demo retention period elapsed', resolved_at = now()
        where video_asset_id = ${object.assetId}::uuid and status in ('open', 'in_review')
      `;
      await writeAudit(transaction, {
        studyId: object.studyId,
        actorProfileId: null,
        actorAuthUserId: null,
        action: "demo.retention_deleted",
        entityType: "video_asset",
        entityPublicId: object.assetPublicId,
        reason: "Demo retention period elapsed",
        requestId: randomUUID(),
        beforeValues: { storageStatus: "available" },
        afterValues: { storageStatus: "deleted", assetStatus: "deleted" },
        metadata: { source: "daily_cron", retentionDays: 7 },
      });
      deleted += 1;
    });
  }
  return deleted;
}

async function repairDemoBaseline() {
  const db = database();
  return await db.begin(async (transaction) => {
    const [study] = await transaction<{ id: string }[]>`
      select id from egocapture.studies
      where id = '10000000-0000-4000-8000-000000000001'::uuid
        and public_id = 'ST-23456789' and is_demo
      for update
    `;
    if (!study) return false;
    await transaction`
      update egocapture.participants
      set status = 'active', consent_status = 'valid', withdrawn_at = null
      where id = '30000000-0000-4000-8000-000000000001'::uuid and is_fixture
    `;
    await transaction`
      update egocapture.assignments assignment
      set status = expected.status, acknowledged_at = null,
        acknowledged_content_hash = null, canceled_at = null
      from (values
        ('60000000-0000-4000-8000-000000000001'::uuid, 'assigned'::text),
        ('60000000-0000-4000-8000-000000000002'::uuid, 'assigned'::text),
        ('60000000-0000-4000-8000-000000000003'::uuid, 'needs_review'::text),
        ('60000000-0000-4000-8000-000000000004'::uuid, 'assigned'::text)
      ) expected(id, status)
      where assignment.id = expected.id
    `;
    await transaction`
      update egocapture.recording_sessions
      set status = 'open', closed_at = null, close_reason = null
      where id = '61000000-0000-4000-8000-000000000001'::uuid
    `;
    await transaction`
      update egocapture.video_assets set status = 'active'
      where id = ${FIXTURE_ASSET_ID}::uuid and is_fixture
    `;
    await transaction`
      update egocapture.review_cases
      set status = 'open', resolution_reason = null, resolved_at = null
      where public_id = any(${FIXTURE_REVIEW_IDS}) and is_fixture
    `;
    const [current] = await transaction<{
      id: string;
      decisionType: string;
      resolvedSessionId: string | null;
    }[]>`
      select id, decision_type, resolved_session_id
      from egocapture.match_decisions
      where video_asset_id = ${FIXTURE_ASSET_ID}::uuid and superseded_by is null
      for update
    `;
    if (!current) {
      await transaction`
        insert into egocapture.match_decisions (video_asset_id, decision_type)
        values (${FIXTURE_ASSET_ID}::uuid, 'unmatched')
      `;
    } else if (current.decisionType !== 'unmatched' || current.resolvedSessionId) {
      const nextId = randomUUID();
      await transaction`set constraints all deferred`;
      await transaction`
        update egocapture.match_decisions set superseded_by = ${nextId}::uuid
        where id = ${current.id}::uuid
      `;
      await transaction`
        insert into egocapture.match_decisions (
          id, video_asset_id, decision_type, supersedes_decision_id
        ) values (${nextId}::uuid, ${FIXTURE_ASSET_ID}::uuid, 'unmatched', ${current.id}::uuid)
      `;
    }
    await writeAudit(transaction, {
      studyId: study.id,
      actorProfileId: null,
      actorAuthUserId: null,
      action: "demo.baseline_repaired",
      entityType: "study",
      entityPublicId: "ST-23456789",
      requestId: randomUUID(),
      afterValues: { fixtureReviewCases: 7, currentDecision: "unmatched" },
      metadata: { source: "daily_cron" },
    });
    return true;
  });
}

export async function runDailyReconciliation() {
  let remaining = MAX_CRON_ITEMS;
  const expired = await expireUploadIntents(remaining);
  remaining -= expired;

  let reconciled = 0;
  let reconciliationFailures = 0;
  for (const viewer of await reconciliationViewers(remaining)) {
    try {
      await completeUpload(viewer, viewer.uploadPublicId, randomUUID());
      reconciled += 1;
    } catch {
      reconciliationFailures += 1;
    }
    remaining -= 1;
  }

  let metadataProcessed = 0;
  let metadataFailures = 0;
  for (const viewer of await metadataViewers(remaining)) {
    try {
      await extractUploadMetadata(viewer, viewer.uploadPublicId, randomUUID());
      metadataProcessed += 1;
    } catch {
      metadataFailures += 1;
    }
    remaining -= 1;
  }

  const demoObjectsDeleted = await cleanExpiredDemoObjects();
  const demoBaselineRepaired = await repairDemoBaseline();
  return {
    limit: MAX_CRON_ITEMS,
    expired,
    reconciled,
    reconciliationFailures,
    metadataProcessed,
    metadataFailures,
    demoObjectsDeleted,
    demoBaselineRepaired,
  };
}
