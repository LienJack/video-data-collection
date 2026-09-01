import "server-only";

import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { z } from "zod";
import {
  MAX_ACTIVE_UPLOADS_PER_PARTICIPANT,
  MAX_FILES_PER_BATCH,
  MAX_UPLOAD_BYTES_PER_PARTICIPANT_PER_24H,
  STORAGE_BUCKET,
  TUS_CHUNK_SIZE_BYTES,
} from "@/src/domain/constants";
import { DomainError } from "@/src/domain/errors";
import { createPublicId } from "@/src/domain/public-id";
import {
  createUploadIntentInputSchema,
  createUploadObjectKey,
  sanitizeOriginalFilename,
} from "@/src/domain/upload";
import { writeAudit } from "@/src/server/audit";
import type { Viewer } from "@/src/server/auth";
import { database } from "@/src/server/database";
import { serverEnvironment } from "@/src/server/env";
import { withIdempotency } from "@/src/server/idempotency";
import { createSupabaseAdminClient } from "@/src/server/supabase/admin";

const uploadPublicIdSchema = z.string().regex(/^UP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);

export { createUploadIntentInputSchema };

export const createAttemptSchema = z.object({
  forceNew: z.boolean().default(false),
  reasonCode: z.enum(["resume", "tus_expired", "server_reconciliation_failed", "manual_retry"]).default("resume"),
});

type UploadAuthority = {
  id: string;
  publicId: string;
  batchId: string;
  studyId: string;
  participantId: string;
  participantStatus: string;
  participantIsFixture: boolean;
  consentStatus: string;
  objectKey: string;
  sizeBytes: number;
  contentType: string;
  extension: string;
  originalFilename: string;
  transferStatus: string;
  metadataStatus: string;
  claimedSessionId: string | null;
  unableToDetermine: boolean;
  fingerprintV1: string;
};

const SIGNED_UPLOAD_TTL_SECONDS = 2 * 60 * 60;
const TUS_RESOURCE_TTL_SECONDS = 24 * 60 * 60;

async function issueSignedUpload(input: {
  objectKey: string;
  uploadPublicId: string;
  attemptPublicId: string;
  attemptExpiresAt: Date;
  participantAuthUserId: string;
}) {
  const environment = serverEnvironment();
  let token: string;
  if (environment.STORAGE_UPLOAD_AUTH_MODE === "nas_scoped_jwt") {
    token = await new SignJWT({
      role: "authenticated",
      egocapture_object_key: input.objectKey,
      egocapture_upload_public_id: input.uploadPublicId,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(input.participantAuthUserId)
      .setAudience("authenticated")
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${SIGNED_UPLOAD_TTL_SECONDS}s`)
      .sign(new TextEncoder().encode(environment.SUPABASE_JWT_SECRET!));
  } else {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(input.objectKey, { upsert: false });
    if (error || !data?.token) {
      throw new DomainError("STORAGE_SIGNATURE_FAILED", "暂时无法创建单对象上传凭据", 503);
    }
    token = data.token;
  }
  return {
    uploadPublicId: input.uploadPublicId,
    attemptPublicId: input.attemptPublicId,
    objectKey: input.objectKey,
    tusEndpoint: serverEnvironment().NEXT_PUBLIC_STORAGE_TUS_ENDPOINT,
    signedUploadToken: token,
    authMode: environment.STORAGE_UPLOAD_AUTH_MODE,
    expiresAt: new Date(Date.now() + SIGNED_UPLOAD_TTL_SECONDS * 1000).toISOString(),
    attemptExpiresAt: input.attemptExpiresAt.toISOString(),
    chunkSizeBytes: TUS_CHUNK_SIZE_BYTES,
  };
}

async function ownUploadAuthority(
  viewer: Viewer,
  uploadPublicId: string,
): Promise<UploadAuthority> {
  const db = database();
  const [upload] = await db<UploadAuthority[]>`
    select
      intent.id,
      intent.public_id,
      intent.batch_id,
      intent.study_id,
      intent.participant_id,
      participant.status as participant_status,
      participant.is_fixture as participant_is_fixture,
      participant.consent_status,
      intent.object_key,
      intent.size_bytes::integer,
      intent.content_type,
      intent.extension,
      intent.original_filename,
      intent.transfer_status,
      intent.metadata_status,
      intent.claimed_session_id,
      intent.unable_to_determine,
      intent.fingerprint_v1
    from egocapture.upload_intents intent
    join egocapture.participants participant on participant.id = intent.participant_id
    where intent.public_id = ${uploadPublicId}
      and participant.auth_user_id = ${viewer.authUserId}::uuid
    limit 1
  `;
  if (!upload) throw new DomainError("NOT_FOUND", "Upload 或资源不存在", 404);
  return upload;
}

export async function createUploadBatch(
  viewer: Viewer,
  idempotencyKey: string,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "upload.batch.create",
    idempotencyKey,
    input: {},
    execute: async () => {
      const [participant] = await transaction<{
        id: string;
        studyId: string;
        status: string;
        consentStatus: string;
      }[]>`
        select id, study_id, status, consent_status
        from egocapture.participants
        where auth_user_id = ${viewer.authUserId}::uuid
        for update
      `;
      if (!participant) throw new DomainError("NOT_FOUND", "Participant 或资源不存在", 404);
      if (participant.status !== "active" || participant.consentStatus !== "valid") {
        throw new DomainError("PARTICIPANT_NOT_ELIGIBLE", "当前账号不能创建 Upload Batch", 403);
      }
      const publicId = createPublicId("UB");
      await transaction`
        insert into egocapture.upload_batches (public_id, study_id, participant_id)
        values (${publicId}, ${participant.studyId}::uuid, ${participant.id}::uuid)
      `;
      await writeAudit(transaction, {
        studyId: participant.studyId,
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "upload_batch.created",
        entityType: "upload_batch",
        entityPublicId: publicId,
        requestId,
        afterValues: { status: "open", maxFiles: MAX_FILES_PER_BATCH },
      });
      return { batchPublicId: publicId, maxFiles: MAX_FILES_PER_BATCH };
    },
  }));
}

export async function createUploadIntent(
  viewer: Viewer,
  input: z.infer<typeof createUploadIntentInputSchema>,
  idempotencyKey: string,
  requestId: string,
) {
  const db = database();
  const authority = await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "upload.intent.create",
    idempotencyKey,
    input,
    execute: async () => {
      const [batch] = await transaction<{
        id: string;
        studyId: string;
        participantId: string;
        participantStatus: string;
        consentStatus: string;
        status: string;
      }[]>`
        select
          batch.id,
          batch.study_id,
          batch.participant_id,
          participant.status as participant_status,
          participant.consent_status,
          batch.status
        from egocapture.upload_batches batch
        join egocapture.participants participant on participant.id = batch.participant_id
        where batch.public_id = ${input.batchPublicId}
          and participant.auth_user_id = ${viewer.authUserId}::uuid
        for update of batch, participant
      `;
      if (!batch) throw new DomainError("NOT_FOUND", "Upload Batch 或资源不存在", 404);
      if (batch.participantStatus !== "active" || batch.consentStatus !== "valid") {
        throw new DomainError("PARTICIPANT_NOT_ELIGIBLE", "当前账号不能创建 UploadIntent", 403);
      }
      if (batch.status !== "open") throw new DomainError("UPLOAD_BATCH_CLOSED", "Upload Batch 已关闭", 409);

      const [quota] = await transaction<{
        batchCount: number;
        activeCount: number;
        bytes24h: number;
      }[]>`
        select
          (select count(*)::integer from egocapture.upload_intents where batch_id = ${batch.id}::uuid) as batch_count,
          (select count(*)::integer from egocapture.upload_intents
            where participant_id = ${batch.participantId}::uuid
              and transfer_status in ('created', 'uploading', 'reconciling')) as active_count,
          (select coalesce(sum(size_bytes), 0)::integer from egocapture.upload_intents
            where participant_id = ${batch.participantId}::uuid
              and created_at >= now() - interval '24 hours') as bytes_24h
      `;
      if (quota.batchCount >= MAX_FILES_PER_BATCH) {
        throw new DomainError("UPLOAD_BATCH_LIMIT", `每批最多 ${MAX_FILES_PER_BATCH} 个文件`, 429);
      }
      if (quota.activeCount >= MAX_ACTIVE_UPLOADS_PER_PARTICIPANT) {
        throw new DomainError("ACTIVE_UPLOAD_LIMIT", `同时最多保留 ${MAX_ACTIVE_UPLOADS_PER_PARTICIPANT} 个活跃上传`, 429);
      }
      if (quota.bytes24h + input.sizeBytes > MAX_UPLOAD_BYTES_PER_PARTICIPANT_PER_24H) {
        throw new DomainError("UPLOAD_DAILY_QUOTA", "已达到最近 24 小时 Demo 上传量上限", 429);
      }

      let claimedSession: { id: string; assignmentId: string; assignmentStatus: string } | undefined;
      if (input.claimedSessionPublicId) {
        [claimedSession] = await transaction<{
          id: string;
          assignmentId: string;
          assignmentStatus: string;
        }[]>`
          select session.id, session.assignment_id, assignment.status as assignment_status
          from egocapture.recording_sessions session
          join egocapture.assignments assignment on assignment.id = session.assignment_id
          where session.public_id = ${input.claimedSessionPublicId}
            and session.participant_id = ${batch.participantId}::uuid
            and session.study_id = ${batch.studyId}::uuid
            and session.status = 'open'
          for update of session, assignment
        `;
        if (!claimedSession) throw new DomainError("SESSION_NOT_AVAILABLE", "Recording Session 不可用于此次上传", 422);
        if (["accepted", "canceled", "expired"].includes(claimedSession.assignmentStatus)) {
          throw new DomainError("INVALID_ASSIGNMENT_STATE", "Assignment 已终结", 409);
        }
      }

      const uploadId = randomUUID();
      const uploadPublicId = createPublicId("UP");
      const attemptPublicId = createPublicId("UA");
      const attemptExpiresAt = new Date(Date.now() + TUS_RESOURCE_TTL_SECONDS * 1000);
      const objectKey = createUploadObjectKey({
        studyId: batch.studyId,
        participantId: batch.participantId,
        uploadId,
        extension: input.extension,
      });
      await transaction`
        insert into egocapture.upload_intents (
          id, public_id, batch_id, study_id, participant_id, original_filename,
          size_bytes, content_type, extension, local_modified_at, object_key,
          claimed_session_id, unable_to_determine, participant_note, fingerprint_v1,
          transfer_status, expected_expires_at
        ) values (
          ${uploadId}::uuid, ${uploadPublicId}, ${batch.id}::uuid, ${batch.studyId}::uuid,
          ${batch.participantId}::uuid, ${sanitizeOriginalFilename(input.originalFilename)},
          ${input.sizeBytes}, ${input.contentType}, ${input.extension}, ${input.localModifiedAt},
          ${objectKey}, ${claimedSession?.id ?? null}::uuid, ${input.unableToDetermine},
          ${input.participantNote ?? null}, ${input.fingerprintV1}, 'uploading', ${attemptExpiresAt}
        )
      `;
      await transaction`
        insert into egocapture.upload_attempts (
          public_id, upload_intent_id, attempt_number, status, expires_at, started_at
        ) values (${attemptPublicId}, ${uploadId}::uuid, 1, 'uploading', ${attemptExpiresAt}, now())
      `;
      if (claimedSession) {
        await transaction`
          update egocapture.assignments set status = 'uploading'
          where id = ${claimedSession.assignmentId}::uuid
            and status in ('acknowledged', 'session_created', 'rework_required')
        `;
      }
      const [duplicate] = await transaction<{ exists: boolean }[]>`
        select exists (
          select 1 from egocapture.upload_intents existing
          where existing.study_id = ${batch.studyId}::uuid
            and existing.id <> ${uploadId}::uuid
            and existing.size_bytes = ${input.sizeBytes}
            and existing.fingerprint_v1 = ${input.fingerprintV1}
        ) as exists
      `;
      await writeAudit(transaction, {
        studyId: batch.studyId,
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "upload_intent.created",
        entityType: "upload_intent",
        entityPublicId: uploadPublicId,
        requestId,
        afterValues: {
          batchPublicId: input.batchPublicId,
          sizeBytes: input.sizeBytes,
          extension: input.extension,
          claimedSessionPublicId: input.claimedSessionPublicId,
          unableToDetermine: input.unableToDetermine,
          duplicateCandidate: duplicate.exists,
        },
      });
      return {
        objectKey,
        uploadPublicId,
        attemptPublicId,
        attemptExpiresAt: attemptExpiresAt.toISOString(),
        duplicateCandidate: duplicate.exists,
      };
    },
  }));
  return {
    ...await issueSignedUpload({
      objectKey: authority.objectKey,
      uploadPublicId: authority.uploadPublicId,
      attemptPublicId: authority.attemptPublicId,
      attemptExpiresAt: new Date(authority.attemptExpiresAt),
      participantAuthUserId: viewer.authUserId,
    }),
    duplicateCandidate: authority.duplicateCandidate,
  };
}

export async function createOrResumeAttempt(
  viewer: Viewer,
  uploadPublicId: string,
  input: z.infer<typeof createAttemptSchema>,
  requestId: string,
) {
  uploadPublicIdSchema.parse(uploadPublicId);
  const db = database();
  const authority = await db.begin(async (transaction) => {
    const rows = await transaction<{
      id: string;
      publicId: string;
      studyId: string;
      participantId: string;
      participantStatus: string;
      consentStatus: string;
      objectKey: string;
      transferStatus: string;
    }[]>`
      select intent.id, intent.public_id, intent.study_id, intent.participant_id,
        participant.status as participant_status, participant.consent_status,
        intent.object_key, intent.transfer_status
      from egocapture.upload_intents intent
      join egocapture.participants participant on participant.id = intent.participant_id
      where intent.public_id = ${uploadPublicId}
        and participant.auth_user_id = ${viewer.authUserId}::uuid
      for update of intent, participant
    `;
    const upload = rows[0];
    if (!upload) throw new DomainError("NOT_FOUND", "Upload 或资源不存在", 404);
    if (upload.participantStatus !== "active" || upload.consentStatus !== "valid") {
      throw new DomainError("PARTICIPANT_NOT_ELIGIBLE", "当前账号不能恢复上传", 403);
    }
    if (["verified", "aborted", "expired"].includes(upload.transferStatus)) {
      throw new DomainError("UPLOAD_TERMINAL", "该 Upload 已终结", 409);
    }
    const [latest] = await transaction<{
      id: string;
      publicId: string;
      attemptNumber: number;
      status: string;
      expiresAt: Date | null;
    }[]>`
      select id, public_id, attempt_number, status, expires_at
      from egocapture.upload_attempts
      where upload_intent_id = ${upload.id}::uuid
      order by attempt_number desc
      limit 1
      for update
    `;
    const stillUsable = latest
      && ["created", "uploading", "paused"].includes(latest.status)
      && latest.expiresAt
      && latest.expiresAt.getTime() > Date.now();
    if (stillUsable && !input.forceNew) {
      return {
        objectKey: upload.objectKey,
        uploadPublicId: upload.publicId,
        attemptPublicId: latest.publicId,
        attemptExpiresAt: latest.expiresAt!.toISOString(),
        resumedExistingAttempt: true,
      };
    }
    if (latest) {
      const expired = input.reasonCode === "tus_expired"
        || Boolean(latest.expiresAt && latest.expiresAt.getTime() <= Date.now());
      await transaction`
        update egocapture.upload_attempts
        set status = ${expired ? "expired" : "failed"},
          error_code = ${input.reasonCode}
        where id = ${latest.id}::uuid
      `;
    }
    const attemptNumber = (latest?.attemptNumber ?? 0) + 1;
    if (attemptNumber > 10) throw new DomainError("UPLOAD_ATTEMPT_LIMIT", "该文件已达到重试次数上限", 429);
    const attemptPublicId = createPublicId("UA");
    const attemptExpiresAt = new Date(Date.now() + TUS_RESOURCE_TTL_SECONDS * 1000);
    await transaction`
      insert into egocapture.upload_attempts (
        public_id, upload_intent_id, attempt_number, status, expires_at, started_at
      ) values (
        ${attemptPublicId}, ${upload.id}::uuid, ${attemptNumber}, 'uploading', ${attemptExpiresAt}, now()
      )
    `;
    await transaction`
      update egocapture.upload_intents
      set transfer_status = 'uploading', failure_code = null, expected_expires_at = ${attemptExpiresAt}
      where id = ${upload.id}::uuid
    `;
    await writeAudit(transaction, {
      studyId: upload.studyId,
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "upload_attempt.created",
      entityType: "upload_intent",
      entityPublicId: upload.publicId,
      requestId,
      afterValues: { attemptPublicId, attemptNumber, reasonCode: input.reasonCode },
    });
    return {
      objectKey: upload.objectKey,
      uploadPublicId: upload.publicId,
      attemptPublicId,
      attemptExpiresAt: attemptExpiresAt.toISOString(),
      resumedExistingAttempt: false,
    };
  });
  return {
    ...await issueSignedUpload({
      objectKey: authority.objectKey,
      uploadPublicId: authority.uploadPublicId,
      attemptPublicId: authority.attemptPublicId,
      attemptExpiresAt: new Date(authority.attemptExpiresAt),
      participantAuthUserId: viewer.authUserId,
    }),
    resumedExistingAttempt: authority.resumedExistingAttempt,
  };
}

async function recordUploadFailure(
  viewer: Viewer,
  upload: UploadAuthority,
  failureCode: "storage_missing" | "size_mismatch",
  requestId: string,
) {
  const db = database();
  await db.begin(async (transaction) => {
    await transaction`
      update egocapture.upload_intents
      set transfer_status = 'failed', failure_code = ${failureCode}
      where id = ${upload.id}::uuid and transfer_status <> 'verified'
    `;
    await transaction`
      update egocapture.upload_attempts
      set status = 'failed', error_code = ${failureCode}
      where upload_intent_id = ${upload.id}::uuid
        and attempt_number = (select max(attempt_number) from egocapture.upload_attempts where upload_intent_id = ${upload.id}::uuid)
        and status <> 'completed'
    `;
    await transaction`
      insert into egocapture.review_cases (
        public_id, study_id, upload_intent_id, case_type, reason, is_fixture
      )
      select ${createPublicId("RV")}, ${upload.studyId}::uuid, ${upload.id}::uuid,
        'upload_failed', ${failureCode}, ${upload.participantIsFixture}
      where not exists (
        select 1 from egocapture.review_cases
        where upload_intent_id = ${upload.id}::uuid and case_type = 'upload_failed' and status = 'open'
      )
    `;
    await writeAudit(transaction, {
      studyId: upload.studyId,
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "upload.reconciliation_failed",
      entityType: "upload_intent",
      entityPublicId: upload.publicId,
      requestId,
      afterValues: { failureCode, expectedSizeBytes: upload.sizeBytes },
    });
  });
}

export async function completeUpload(viewer: Viewer, uploadPublicId: string, requestId: string) {
  uploadPublicIdSchema.parse(uploadPublicId);
  let upload = await ownUploadAuthority(viewer, uploadPublicId);
  if (upload.transferStatus === "verified") {
    const completed = await getParticipantUpload(viewer, uploadPublicId);
    return {
      uploadPublicId,
      transferStatus: "verified",
      metadataStatus: completed.metadataStatus,
      videoAssetPublicId: completed.asset?.publicId,
    };
  }
  if (["aborted", "expired"].includes(upload.transferStatus)) {
    throw new DomainError("UPLOAD_TERMINAL", "该 Upload 已终结", 409);
  }
  const db = database();
  await db`update egocapture.upload_intents set transfer_status = 'reconciling' where id = ${upload.id}::uuid and transfer_status <> 'verified'`;
  upload = { ...upload, transferStatus: "reconciling" };

  const supabase = createSupabaseAdminClient();
  const { data: objectInfo, error } = await supabase.storage.from(STORAGE_BUCKET).info(upload.objectKey);
  if (error || !objectInfo) {
    await recordUploadFailure(viewer, upload, "storage_missing", requestId);
    throw new DomainError("STORAGE_MISSING", "Storage 中尚未找到完整对象", 409);
  }
  const info = objectInfo as unknown as {
    size?: number;
    etag?: string;
    metadata?: { size?: number; eTag?: string; etag?: string };
  };
  const actualSize = Number(info.size ?? info.metadata?.size ?? 0);
  if (!Number.isSafeInteger(actualSize) || actualSize !== upload.sizeBytes) {
    await recordUploadFailure(viewer, upload, "size_mismatch", requestId);
    throw new DomainError("SIZE_MISMATCH", "Storage 对象大小与声明不一致", 409);
  }

  const result = await db.begin(async (transaction) => {
    const [locked] = await transaction<{ transferStatus: string }[]>`
      select transfer_status from egocapture.upload_intents
      where id = ${upload.id}::uuid for update
    `;
    if (locked.transferStatus === "verified") {
      const [existing] = await transaction<{ videoAssetPublicId: string }[]>`
        select asset.public_id as video_asset_public_id
        from egocapture.video_assets asset where asset.upload_intent_id = ${upload.id}::uuid
      `;
      return { videoAssetPublicId: existing.videoAssetPublicId };
    }
    const [stored] = await transaction<{ id: string }[]>`
      insert into egocapture.stored_objects (
        upload_intent_id, provider, bucket, object_key, size_bytes, etag, verified_at
      ) values (
        ${upload.id}::uuid, 'supabase', ${STORAGE_BUCKET}, ${upload.objectKey}, ${actualSize},
        ${info.etag ?? info.metadata?.eTag ?? info.metadata?.etag ?? null}, now()
      ) returning id
    `;
    const assetPublicId = createPublicId("VA");
    const [asset] = await transaction<{ id: string }[]>`
      insert into egocapture.video_assets (
        public_id, upload_intent_id, study_id, participant_id, is_fixture
      ) values (
        ${assetPublicId}, ${upload.id}::uuid, ${upload.studyId}::uuid, ${upload.participantId}::uuid,
        ${upload.participantIsFixture}
      ) returning id
    `;
    await transaction`
      insert into egocapture.asset_files (video_asset_id, stored_object_id)
      values (${asset.id}::uuid, ${stored.id}::uuid)
    `;
    const [session] = upload.claimedSessionId
      ? await transaction<{ assignmentId: string; declaredDeviceId: string }[]>`
          select assignment_id, declared_device_id
          from egocapture.recording_sessions where id = ${upload.claimedSessionId}::uuid
        `
      : [];
    await transaction`
      insert into egocapture.match_decisions (
        video_asset_id, claimed_session_id, resolved_session_id, resolved_device_id,
        decision_type, decided_by
      ) values (
        ${asset.id}::uuid, ${upload.claimedSessionId}::uuid, ${upload.claimedSessionId}::uuid,
        ${session?.declaredDeviceId ?? null}::uuid,
        ${upload.unableToDetermine ? "unmatched" : "participant_claim"}, ${viewer.profileId}::uuid
      )
    `;
    if (upload.unableToDetermine) {
      await transaction`
        insert into egocapture.review_cases (
          public_id, study_id, video_asset_id, case_type, reason, is_fixture
        ) values (
          ${createPublicId("RV")}, ${upload.studyId}::uuid, ${asset.id}::uuid,
          'unmatched', 'participant_selected_unable_to_determine', ${upload.participantIsFixture}
        )
      `;
    }
    const [duplicate] = await transaction<{ exists: boolean }[]>`
      select exists (
        select 1
        from egocapture.upload_intents other_intent
        join egocapture.video_assets other_asset on other_asset.upload_intent_id = other_intent.id
        where other_intent.study_id = ${upload.studyId}::uuid
          and other_intent.id <> ${upload.id}::uuid
          and other_intent.size_bytes = ${upload.sizeBytes}
          and other_intent.fingerprint_v1 = ${upload.fingerprintV1}
      ) as exists
    `;
    if (duplicate.exists) {
      await transaction`
        insert into egocapture.review_cases (
          public_id, study_id, video_asset_id, case_type, reason, is_fixture
        ) values (
          ${createPublicId("RV")}, ${upload.studyId}::uuid, ${asset.id}::uuid,
          'duplicate_candidate', 'matching_size_and_fingerprint_v1', ${upload.participantIsFixture}
        )
      `;
    }
    await transaction`
      update egocapture.upload_intents
      set transfer_status = 'verified', failure_code = null, verified_at = now(), metadata_status = 'pending'
      where id = ${upload.id}::uuid
    `;
    await transaction`
      update egocapture.upload_attempts
      set status = 'completed', bytes_uploaded = ${actualSize}, completed_at = now(), error_code = null
      where upload_intent_id = ${upload.id}::uuid
        and attempt_number = (select max(attempt_number) from egocapture.upload_attempts where upload_intent_id = ${upload.id}::uuid)
    `;
    if (session) {
      await transaction`
        update egocapture.assignments set status = 'submitted'
        where id = ${session.assignmentId}::uuid
          and status in ('acknowledged', 'session_created', 'uploading', 'rework_required')
      `;
    }
    await transaction`
      update egocapture.upload_batches batch
      set status = 'completed', completed_at = now()
      where batch.id = ${upload.batchId}::uuid
        and not exists (
          select 1 from egocapture.upload_intents pending
          where pending.batch_id = batch.id
            and pending.transfer_status in ('created', 'uploading', 'reconciling')
        )
    `;
    await writeAudit(transaction, {
      studyId: upload.studyId,
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "upload.verified",
      entityType: "video_asset",
      entityPublicId: assetPublicId,
      requestId,
      afterValues: {
        uploadPublicId: upload.publicId,
        sizeBytes: actualSize,
        matchDecision: upload.unableToDetermine ? "unmatched" : "participant_claim",
        duplicateCandidate: duplicate.exists,
        metadataStatus: "pending",
      },
    });
    return { videoAssetPublicId: assetPublicId };
  });
  return {
    uploadPublicId: upload.publicId,
    transferStatus: "verified",
    metadataStatus: "pending",
    ...result,
  };
}

export async function abortUpload(viewer: Viewer, uploadPublicId: string, requestId: string) {
  uploadPublicIdSchema.parse(uploadPublicId);
  const upload = await ownUploadAuthority(viewer, uploadPublicId);
  if (upload.transferStatus === "verified") throw new DomainError("UPLOAD_TERMINAL", "已验证对象不能取消", 409);
  if (upload.transferStatus === "aborted") return { uploadPublicId, transferStatus: "aborted" };
  const db = database();
  await db.begin(async (transaction) => {
    await transaction`update egocapture.upload_intents set transfer_status = 'aborted', failure_code = null where id = ${upload.id}::uuid`;
    await transaction`
      update egocapture.upload_attempts set status = 'aborted', error_code = 'participant_canceled'
      where upload_intent_id = ${upload.id}::uuid and status <> 'completed'
    `;
    await writeAudit(transaction, {
      studyId: upload.studyId,
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "upload.aborted",
      entityType: "upload_intent",
      entityPublicId: upload.publicId,
      requestId,
      afterValues: { transferStatus: "aborted" },
    });
  });
  return { uploadPublicId, transferStatus: "aborted" };
}

export async function getParticipantUpload(viewer: Viewer, uploadPublicId: string) {
  uploadPublicIdSchema.parse(uploadPublicId);
  const upload = await ownUploadAuthority(viewer, uploadPublicId);
  const db = database();
  const attempts = await db<{
    publicId: string;
    attemptNumber: number;
    status: string;
    bytesUploaded: number;
    expiresAt: Date | null;
    errorCode: string | null;
  }[]>`
    select public_id, attempt_number, status, bytes_uploaded::integer, expires_at, error_code
    from egocapture.upload_attempts
    where upload_intent_id = ${upload.id}::uuid
    order by attempt_number desc
  `;
  const [asset] = await db<{
    publicId: string;
    decisionType: string;
    reviewCount: number;
    containerFormat: string | null;
    durationMs: number | null;
    videoCodec: string | null;
    width: number | null;
    height: number | null;
    frameRate: number | null;
    captureTimeSource: string | null;
    deviceConsistency: string | null;
  }[]>`
    select asset.public_id, decision.decision_type,
      (select count(*)::integer from egocapture.review_cases review where review.video_asset_id = asset.id and review.status = 'open') as review_count,
      metadata.container_format,
      metadata.duration_ms::integer,
      metadata.video_codec,
      metadata.width,
      metadata.height,
      metadata.frame_rate::float8,
      metadata.capture_time_source,
      metadata.device_consistency
    from egocapture.video_assets asset
    left join egocapture.current_match_decisions decision on decision.video_asset_id = asset.id
    left join egocapture.video_file_metadata metadata on metadata.video_asset_id = asset.id
    where asset.upload_intent_id = ${upload.id}::uuid
  `;
  const metadataAttempts = await db<{
    attemptNumber: number;
    status: string;
    rangeRequestCount: number;
    bytesRead: number;
    errorCode: string | null;
    completedAt: Date | null;
  }[]>`
    select attempt_number, status, range_request_count, bytes_read::integer, error_code, completed_at
    from egocapture.metadata_attempts
    where video_asset_id = (select id from egocapture.video_assets where upload_intent_id = ${upload.id}::uuid)
    order by attempt_number desc
  `;
  return {
    uploadPublicId: upload.publicId,
    originalFilename: upload.originalFilename,
    sizeBytes: upload.sizeBytes,
    contentType: upload.contentType,
    extension: upload.extension,
    transferStatus: upload.transferStatus,
    metadataStatus: upload.metadataStatus,
    failureCode: (await db<{ failureCode: string | null }[]>`
      select failure_code from egocapture.upload_intents where id = ${upload.id}::uuid
    `)[0]?.failureCode ?? null,
    unableToDetermine: upload.unableToDetermine,
    attempts,
    metadataAttempts,
    asset: asset ?? null,
  };
}

export async function listParticipantUploads(viewer: Viewer) {
  const db = database();
  return await db<{
    publicId: string;
    originalFilename: string;
    sizeBytes: number;
    transferStatus: string;
    metadataStatus: string;
    failureCode: string | null;
    claimedSessionPublicId: string | null;
    createdAt: Date;
  }[]>`
    select
      intent.public_id,
      intent.original_filename,
      intent.size_bytes::integer,
      intent.transfer_status,
      intent.metadata_status,
      intent.failure_code,
      session.public_id as claimed_session_public_id,
      intent.created_at
    from egocapture.upload_intents intent
    join egocapture.participants participant on participant.id = intent.participant_id
    left join egocapture.recording_sessions session on session.id = intent.claimed_session_id
    where participant.auth_user_id = ${viewer.authUserId}::uuid
    order by intent.created_at desc
    limit 50
  `;
}
