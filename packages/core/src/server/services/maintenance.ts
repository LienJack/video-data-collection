import "server-only";

import { randomUUID } from "node:crypto";
import { STORAGE_BUCKET } from "@egocapture/core/domain/constants";
import {
  metadataAttemptMachine,
  reviewCaseMachine,
  uploadAttemptMachine,
  uploadMetadataMachine,
  uploadTransferMachine,
  videoAssetMachine,
} from "@egocapture/core/domain/lifecycle-machines";
import { createPublicId } from "@egocapture/core/domain/public-id";
import { writeAudit } from "@egocapture/core/server/audit";
import type { Viewer } from "@egocapture/core/server/auth";
import { database } from "@egocapture/core/server/database";
import { extractUploadMetadata } from "@egocapture/core/server/services/metadata";
import { completeUpload } from "@egocapture/core/server/services/uploads";
import {
  assertServiceTransitionSet,
  resolveServiceTransition,
} from "@egocapture/core/server/state-transition";
import { createSupabaseAdminClient } from "@egocapture/core/server/supabase/admin";

const MAX_CRON_ITEMS = 10;
type MaintenanceViewer = Viewer & { uploadPublicId: string };

async function expireUploadIntents(limit: number) {
  if (limit <= 0) return 0;
  const db = database();
  return await db.begin(async (transaction) => {
    const uploads = await transaction<{
      id: string;
      publicId: string;
      isFixture: boolean;
      transferStatus: "created" | "uploading";
    }[]>`
      select intent.id, intent.public_id, participant.is_fixture, intent.transfer_status
      from egocapture.upload_intents intent
      join egocapture.participants participant on participant.id = intent.participant_id
      where intent.transfer_status in ('created', 'uploading')
        and intent.expected_expires_at < now()
      order by intent.expected_expires_at, intent.id
      for update of intent skip locked
      limit ${limit}
    `;
    const expiredAttemptStatus = resolveServiceTransition(
      uploadAttemptMachine,
      "created",
      "expire",
      "INVALID_UPLOAD_ATTEMPT_STATE",
    );
    assertServiceTransitionSet(
      uploadAttemptMachine,
      ["created", "uploading", "paused"],
      "expire",
      "INVALID_UPLOAD_ATTEMPT_STATE",
    );
    for (const upload of uploads) {
      const expiredTransferStatus = resolveServiceTransition(
        uploadTransferMachine,
        upload.transferStatus,
        "expire",
        "INVALID_UPLOAD_STATE",
      );
      await transaction`
        update egocapture.upload_intents
        set transfer_status = ${expiredTransferStatus}, failure_code = 'upload_intent_expired'
        where id = ${upload.id}::uuid and transfer_status = ${upload.transferStatus}
      `;
      await transaction`
        update egocapture.upload_attempts
        set status = ${expiredAttemptStatus}, error_code = 'upload_intent_expired'
        where upload_intent_id = ${upload.id}::uuid
          and status in ('created', 'uploading', 'paused')
      `;
      await transaction`
        insert into egocapture.review_cases (
          public_id, upload_intent_id, case_type, reason, is_fixture
        ) select ${createPublicId("RV")}, ${upload.id}::uuid,
          'upload_failed', 'upload_intent_expired', ${upload.isFixture}
        where not exists (
          select 1 from egocapture.review_cases
          where upload_intent_id = ${upload.id}::uuid
            and case_type = 'upload_failed' and status in ('open', 'in_review')
        )
      `;
      await writeAudit(transaction, {
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
      const failedAttemptStatus = resolveServiceTransition(
        metadataAttemptMachine,
        "processing",
        "fail",
        "INVALID_METADATA_ATTEMPT_STATE",
      );
      const pendingMetadataStatus = resolveServiceTransition(
        uploadMetadataMachine,
        "processing",
        "retry",
        "INVALID_METADATA_STATE",
      );
      await transaction`
        update egocapture.metadata_attempts attempt
        set status = ${failedAttemptStatus}, completed_at = now(), error_code = 'cron_stuck_processing'
        from egocapture.video_assets asset
        join egocapture.upload_intents intent on intent.id = asset.upload_intent_id
        where attempt.video_asset_id = asset.id and attempt.status = 'processing'
          and intent.public_id = any(${stuckIds})
          and intent.metadata_status = 'processing'
          and intent.updated_at < now() - interval '30 minutes'
      `;
      await transaction`
        update egocapture.upload_intents
        set metadata_status = ${pendingMetadataStatus}
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
    assetId: string;
    assetPublicId: string;
  }[]>`
    select object.id, object.object_key, asset.id as asset_id,
      asset.public_id as asset_public_id
    from egocapture.stored_objects object
    join egocapture.asset_files file on file.stored_object_id = object.id and file.file_role = 'source'
    join egocapture.video_assets asset on asset.id = file.video_asset_id
    join egocapture.participants participant on participant.id = asset.participant_id
    where object.deleted_at is null
      and object.created_at < now() - interval '7 days'
      and (participant.is_fixture or asset.is_fixture)
    order by object.created_at, object.id
    limit ${MAX_CRON_ITEMS}
  `;
  const supabase = createSupabaseAdminClient();
  let deleted = 0;
  for (const object of objects) {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([object.objectKey]);
    if (error) continue;
    await db.begin(async (transaction) => {
      const [asset] = await transaction<{
        status: "active" | "rejected" | "deleted";
      }[]>`
        select status from egocapture.video_assets
        where id = ${object.assetId}::uuid
        for update
      `;
      if (!asset) return;
      const deletedAssetStatus = asset.status === "deleted"
        ? asset.status
        : resolveServiceTransition(
            videoAssetMachine,
            asset.status,
            "delete",
            "INVALID_VIDEO_ASSET_STATE",
          );
      assertServiceTransitionSet(
        reviewCaseMachine,
        ["open", "in_review"],
        "dismiss",
        "INVALID_REVIEW_CASE_STATE",
      );
      const dismissedReviewStatus = resolveServiceTransition(
        reviewCaseMachine,
        "open",
        "dismiss",
        "INVALID_REVIEW_CASE_STATE",
      );
      const updated = await transaction`
        update egocapture.stored_objects
        set deleted_at = now(), delete_reason = 'demo_retention_7d'
        where id = ${object.id}::uuid and deleted_at is null
        returning id
      `;
      if (updated.length === 0) return;
      if (asset.status !== "deleted") {
        const deletedAssets = await transaction`
          update egocapture.video_assets set status = ${deletedAssetStatus}
          where id = ${object.assetId}::uuid and status = ${asset.status}
          returning id
        `;
        if (deletedAssets.length === 0) {
          throw new Error("STALE_VIDEO_ASSET_STATE");
        }
      }
      await transaction`
        update egocapture.review_cases
        set status = ${dismissedReviewStatus}, resolution_reason = 'Demo retention period elapsed', resolved_at = now()
        where video_asset_id = ${object.assetId}::uuid and status in ('open', 'in_review')
      `;
      await writeAudit(transaction, {
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
  return {
    limit: MAX_CRON_ITEMS,
    expired,
    reconciled,
    reconciliationFailures,
    metadataProcessed,
    metadataFailures,
    demoObjectsDeleted,
  };
}
