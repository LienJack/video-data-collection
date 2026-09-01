import "server-only";

import { z } from "zod";
import { STORAGE_BUCKET } from "@/src/domain/constants";
import { DomainError } from "@/src/domain/errors";
import { compareDeviceConsistency } from "@/src/metadata/device-consistency";
import { parseMetadata } from "@/src/metadata/parser";
import { BudgetedRangeReader, MetadataRangeError } from "@/src/metadata/range-reader";
import type { MetadataEvidence, NormalizedMetadata } from "@/src/metadata/types";
import { writeAudit } from "@/src/server/audit";
import type { Viewer } from "@/src/server/auth";
import { database } from "@/src/server/database";
import { serverEnvironment } from "@/src/server/env";
import { createPublicId } from "@/src/domain/public-id";
import { createSupabaseAdminClient } from "@/src/server/supabase/admin";

const uploadPublicIdSchema = z.string().regex(/^UP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
const EXTRACTION_TIMEOUT_MS = 25_000;
const SIGNED_READ_TTL_SECONDS = 5 * 60;
const MAX_EXTRACTION_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 30_000;

type MetadataAuthority = {
  uploadIntentId: string;
  uploadPublicId: string;
  studyId: string;
  studySerialHmacSalt: string;
  participantId: string;
  videoAssetId: string;
  videoAssetPublicId: string;
  objectKey: string;
  objectSize: number;
  extension: "mp4" | "mov" | "insv";
  localModifiedAt: Date | null;
  transferStatus: string;
  metadataStatus: string;
  declaredManufacturer: string | null;
  declaredModel: string | null;
  declaredSerialHmac: string | null;
};

type MetadataSummary = {
  status: string;
  parserName: string | null;
  parserVersion: string | null;
  containerFormat: string | null;
  durationMs: number | null;
  videoCodec: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  captureTimeSource: string | null;
  deviceConsistency: string | null;
  rangeRequestCount: number;
  bytesRead: number;
  attemptNumber: number;
};

function snakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);
}

async function metadataAuthority(viewer: Viewer, uploadPublicId: string): Promise<MetadataAuthority> {
  const db = database();
  const [authority] = await db<MetadataAuthority[]>`
    select
      intent.id as upload_intent_id,
      intent.public_id as upload_public_id,
      intent.study_id,
      study.serial_hmac_salt as study_serial_hmac_salt,
      intent.participant_id,
      intent.transfer_status,
      intent.metadata_status,
      intent.extension,
      intent.local_modified_at,
      asset.id as video_asset_id,
      asset.public_id as video_asset_public_id,
      object.object_key,
      object.size_bytes::integer as object_size,
      expected_device.manufacturer as declared_manufacturer,
      expected_device.model as declared_model,
      expected_device.serial_hmac as declared_serial_hmac
    from egocapture.upload_intents intent
    join egocapture.participants participant on participant.id = intent.participant_id
    join egocapture.studies study on study.id = intent.study_id
    join egocapture.video_assets asset on asset.upload_intent_id = intent.id
    join egocapture.asset_files asset_file on asset_file.video_asset_id = asset.id and asset_file.file_role = 'source'
    join egocapture.stored_objects object on object.id = asset_file.stored_object_id
    left join egocapture.current_match_decisions decision on decision.video_asset_id = asset.id
    left join egocapture.recording_sessions session on session.id = decision.resolved_session_id
    left join egocapture.devices expected_device on expected_device.id = coalesce(decision.resolved_device_id, session.declared_device_id)
    where intent.public_id = ${uploadPublicId}
      and (
        (${viewer.role} = 'participant' and participant.auth_user_id = ${viewer.authUserId}::uuid)
        or
        (${viewer.role} = 'admin' and exists (
          select 1 from egocapture.study_memberships membership
          where membership.study_id = intent.study_id
            and membership.profile_id = ${viewer.profileId}::uuid
            and membership.status = 'active'
        ))
      )
    limit 1
  `;
  if (!authority) throw new DomainError("NOT_FOUND", "Upload 或资源不存在", 404);
  return authority;
}

async function summary(videoAssetId: string, status: string): Promise<MetadataSummary> {
  const db = database();
  const [row] = await db<MetadataSummary[]>`
    select
      ${status}::text as status,
      metadata.parser_name,
      metadata.parser_version,
      metadata.container_format,
      metadata.duration_ms::integer,
      metadata.video_codec,
      metadata.width,
      metadata.height,
      metadata.frame_rate::float8,
      metadata.capture_time_source,
      metadata.device_consistency,
      coalesce(attempt.range_request_count, 0)::integer as range_request_count,
      coalesce(attempt.bytes_read, 0)::integer as bytes_read,
      coalesce(attempt.attempt_number, 0)::integer as attempt_number
    from egocapture.video_assets asset
    left join egocapture.video_file_metadata metadata on metadata.video_asset_id = asset.id
    left join lateral (
      select * from egocapture.metadata_attempts candidate
      where candidate.video_asset_id = asset.id
      order by candidate.attempt_number desc limit 1
    ) attempt on true
    where asset.id = ${videoAssetId}::uuid
  `;
  return row;
}

async function beginAttempt(authority: MetadataAuthority): Promise<{ attemptId: string; attemptNumber: number } | null> {
  const db = database();
  return await db.begin(async (transaction) => {
    const [locked] = await transaction<{ metadataStatus: string }[]>`
      select metadata_status from egocapture.upload_intents
      where id = ${authority.uploadIntentId}::uuid
      for update
    `;
    if (locked.metadataStatus === "extracted") return null;
    const [latest] = await transaction<{
      id: string;
      attemptNumber: number;
      status: string;
      startedAt: Date;
      completedAt: Date | null;
    }[]>`
      select id, attempt_number, status, started_at, completed_at
      from egocapture.metadata_attempts
      where video_asset_id = ${authority.videoAssetId}::uuid
      order by attempt_number desc
      limit 1
      for update
    `;
    if (latest?.status === "processing" && Date.now() - latest.startedAt.getTime() < EXTRACTION_TIMEOUT_MS + 5_000) {
      throw new DomainError("METADATA_ALREADY_PROCESSING", "Metadata 正在解析", 409);
    }
    if (latest?.completedAt && Date.now() - latest.completedAt.getTime() < RETRY_COOLDOWN_MS) {
      throw new DomainError("METADATA_RETRY_COOLDOWN", "请稍后再重试 Metadata", 429);
    }
    const attemptNumber = (latest?.attemptNumber ?? 0) + 1;
    if (attemptNumber > MAX_EXTRACTION_ATTEMPTS) {
      throw new DomainError("METADATA_ATTEMPT_LIMIT", "Metadata 已达到最多 3 次解析尝试", 429);
    }
    if (latest?.status === "processing") {
      await transaction`
        update egocapture.metadata_attempts
        set status = 'failed', completed_at = now(), error_code = 'processing_timeout'
        where id = ${latest.id}::uuid
      `;
    }
    const [attempt] = await transaction<{ id: string }[]>`
      insert into egocapture.metadata_attempts (
        video_asset_id, attempt_number, parser_name, parser_version, status, started_at
      ) values (
        ${authority.videoAssetId}::uuid, ${attemptNumber}, 'mediainfo.js+mp4box',
        'mediainfo.js@0.3.7+mp4box@2.4.1', 'processing', now()
      ) returning id
    `;
    await transaction`
      update egocapture.upload_intents set metadata_status = 'processing'
      where id = ${authority.uploadIntentId}::uuid
    `;
    return { attemptId: attempt.id, attemptNumber };
  });
}

async function saveEvidence(
  transaction: ReturnType<typeof database>,
  videoAssetId: string,
  parserName: string,
  evidence: MetadataEvidence[],
) {
  for (const item of evidence) {
    await transaction`
      insert into egocapture.metadata_evidence (
        video_asset_id, field_name, normalized_value, parser_name, source
      ) values (
        ${videoAssetId}::uuid, ${snakeCase(item.fieldName)},
        ${transaction.json(item.normalizedValue as never)}, ${parserName}, ${item.source}
      )
    `;
  }
}

async function finishSuccess(input: {
  viewer: Viewer;
  authority: MetadataAuthority;
  attemptId: string;
  attemptNumber: number;
  requestId: string;
  reader: BudgetedRangeReader;
  parserName: string;
  parserVersion: string;
  status: "extracted" | "partial";
  warningCode: string | null;
  metadata: NormalizedMetadata;
  evidence: MetadataEvidence[];
}): Promise<MetadataSummary> {
  const consistency = compareDeviceConsistency(
    input.authority.declaredManufacturer || input.authority.declaredModel || input.authority.declaredSerialHmac
      ? {
          manufacturer: input.authority.declaredManufacturer,
          model: input.authority.declaredModel,
          serialHmac: input.authority.declaredSerialHmac,
        }
      : null,
    {
      manufacturer: input.metadata.cameraManufacturer,
      model: input.metadata.cameraModel,
      serialHash: input.metadata.cameraSerialHash,
    },
  );
  const db = database();
  await db.begin(async (transaction) => {
    await transaction`
      insert into egocapture.video_file_metadata (
        video_asset_id, parser_name, parser_version, container_format, duration_ms,
        file_size_bytes, video_codec, width, height, frame_rate, bitrate,
        audio_codec, audio_channels, normalized_capture_time, capture_time_source,
        capture_time_confidence, timezone_offset, camera_manufacturer, camera_model,
        camera_serial_hash, gps_metadata_present, projection_type, is_360,
        device_consistency, extracted_at
      ) values (
        ${input.authority.videoAssetId}::uuid, ${input.parserName}, ${input.parserVersion},
        ${input.metadata.containerFormat}, ${input.metadata.durationMs}, ${input.metadata.fileSizeBytes},
        ${input.metadata.videoCodec}, ${input.metadata.width}, ${input.metadata.height},
        ${input.metadata.frameRate}, ${input.metadata.bitrate}, ${input.metadata.audioCodec},
        ${input.metadata.audioChannels}, ${input.metadata.normalizedCaptureTime},
        ${input.metadata.captureTimeSource}, ${input.metadata.captureTimeConfidence},
        ${input.metadata.timezoneOffset}, ${input.metadata.cameraManufacturer},
        ${input.metadata.cameraModel}, ${input.metadata.cameraSerialHash},
        ${input.metadata.gpsMetadataPresent}, ${input.metadata.projectionType}, ${input.metadata.is360},
        ${consistency}, now()
      )
      on conflict (video_asset_id) do update set
        parser_name = excluded.parser_name,
        parser_version = excluded.parser_version,
        container_format = excluded.container_format,
        duration_ms = excluded.duration_ms,
        file_size_bytes = excluded.file_size_bytes,
        video_codec = excluded.video_codec,
        width = excluded.width,
        height = excluded.height,
        frame_rate = excluded.frame_rate,
        bitrate = excluded.bitrate,
        audio_codec = excluded.audio_codec,
        audio_channels = excluded.audio_channels,
        normalized_capture_time = excluded.normalized_capture_time,
        capture_time_source = excluded.capture_time_source,
        capture_time_confidence = excluded.capture_time_confidence,
        timezone_offset = excluded.timezone_offset,
        camera_manufacturer = excluded.camera_manufacturer,
        camera_model = excluded.camera_model,
        camera_serial_hash = excluded.camera_serial_hash,
        gps_metadata_present = excluded.gps_metadata_present,
        projection_type = excluded.projection_type,
        is_360 = excluded.is_360,
        device_consistency = excluded.device_consistency,
        extracted_at = now()
    `;
    await saveEvidence(transaction as ReturnType<typeof database>, input.authority.videoAssetId, input.parserName, input.evidence);
    await transaction`
      update egocapture.metadata_attempts
      set parser_version = ${input.parserVersion}, status = ${input.status},
        range_request_count = ${input.reader.rangeRequestCount}, bytes_read = ${input.reader.bytesRead},
        completed_at = now(), error_code = ${input.warningCode}
      where id = ${input.attemptId}::uuid and status = 'processing'
    `;
    await transaction`
      update egocapture.upload_intents set metadata_status = ${input.status}
      where id = ${input.authority.uploadIntentId}::uuid
    `;
    const mismatch = ["model_mismatch", "serial_mismatch", "metadata_conflict"].includes(consistency);
    if (mismatch) {
      await transaction`
        insert into egocapture.review_cases (
          public_id, study_id, video_asset_id, case_type, reason
        ) select
          ${createPublicId("RV")}, ${input.authority.studyId}::uuid,
          ${input.authority.videoAssetId}::uuid, 'device_mismatch', ${consistency}
        where not exists (
          select 1 from egocapture.review_cases
          where video_asset_id = ${input.authority.videoAssetId}::uuid
            and case_type = 'device_mismatch' and status in ('open', 'in_review')
        )
      `;
    } else {
      await transaction`
        update egocapture.review_cases
        set status = 'resolved', resolution_reason = 'metadata_reextraction_removed_mismatch', resolved_at = now()
        where video_asset_id = ${input.authority.videoAssetId}::uuid
          and case_type = 'device_mismatch' and status in ('open', 'in_review')
      `;
    }
    await transaction`
      update egocapture.review_cases
      set status = 'resolved', resolution_reason = 'metadata_retry_completed_successfully', resolved_at = now()
      where video_asset_id = ${input.authority.videoAssetId}::uuid
        and case_type = 'metadata_failed' and status in ('open', 'in_review')
    `;
    await writeAudit(transaction, {
      studyId: input.authority.studyId,
      actorProfileId: input.viewer.profileId,
      actorAuthUserId: input.viewer.authUserId,
      action: "metadata.extracted",
      entityType: "video_asset",
      entityPublicId: input.authority.videoAssetPublicId,
      requestId: input.requestId,
      afterValues: {
        status: input.status,
        attemptNumber: input.attemptNumber,
        parserName: input.parserName,
        parserVersion: input.parserVersion,
        rangeRequestCount: input.reader.rangeRequestCount,
        bytesRead: input.reader.bytesRead,
        deviceConsistency: consistency,
        warningCode: input.warningCode,
      },
    });
  });
  return await summary(input.authority.videoAssetId, input.status);
}

function safeFailure(error: unknown, extension: MetadataAuthority["extension"]): { status: "unsupported" | "failed"; code: string } {
  if (error instanceof MetadataRangeError) return { status: "failed", code: error.code };
  if (error instanceof Error && error.name === "AbortError") return { status: "failed", code: "metadata_timeout" };
  if (error instanceof Error && error.message === "parser_no_recognized_container") {
    return extension === "insv"
      ? { status: "unsupported", code: "insv_metadata_unsupported" }
      : { status: "failed", code: "parser_no_recognized_container" };
  }
  return { status: "failed", code: "metadata_parser_failed" };
}

async function finishFailure(input: {
  viewer: Viewer;
  authority: MetadataAuthority;
  attemptId: string;
  attemptNumber: number;
  requestId: string;
  reader: BudgetedRangeReader | null;
  error: unknown;
}): Promise<never> {
  const failure = safeFailure(input.error, input.authority.extension);
  const db = database();
  await db.begin(async (transaction) => {
    await transaction`
      update egocapture.metadata_attempts
      set status = ${failure.status}, range_request_count = ${input.reader?.rangeRequestCount ?? 0},
        bytes_read = ${input.reader?.bytesRead ?? 0}, completed_at = now(), error_code = ${failure.code}
      where id = ${input.attemptId}::uuid and status = 'processing'
    `;
    await transaction`
      update egocapture.upload_intents set metadata_status = ${failure.status}
      where id = ${input.authority.uploadIntentId}::uuid
    `;
    if (failure.status === "failed") {
      await transaction`
        insert into egocapture.review_cases (
          public_id, study_id, video_asset_id, case_type, reason
        ) select
          ${createPublicId("RV")}, ${input.authority.studyId}::uuid,
          ${input.authority.videoAssetId}::uuid, 'metadata_failed', ${failure.code}
        where not exists (
          select 1 from egocapture.review_cases
          where video_asset_id = ${input.authority.videoAssetId}::uuid
            and case_type = 'metadata_failed' and status in ('open', 'in_review')
        )
      `;
    }
    await writeAudit(transaction, {
      studyId: input.authority.studyId,
      actorProfileId: input.viewer.profileId,
      actorAuthUserId: input.viewer.authUserId,
      action: "metadata.extraction_failed",
      entityType: "video_asset",
      entityPublicId: input.authority.videoAssetPublicId,
      requestId: input.requestId,
      afterValues: {
        status: failure.status,
        attemptNumber: input.attemptNumber,
        rangeRequestCount: input.reader?.rangeRequestCount ?? 0,
        bytesRead: input.reader?.bytesRead ?? 0,
        errorCode: failure.code,
      },
    });
  });
  throw new DomainError(
    failure.status === "unsupported" ? "METADATA_UNSUPPORTED" : "METADATA_EXTRACTION_FAILED",
    failure.status === "unsupported" ? "该文件的 Metadata 暂不支持" : "Metadata 解析失败，文件传输仍保持已验证",
    422,
  );
}

export async function extractUploadMetadata(viewer: Viewer, uploadPublicId: string, requestId: string) {
  uploadPublicIdSchema.parse(uploadPublicId);
  const authority = await metadataAuthority(viewer, uploadPublicId);
  if (authority.transferStatus !== "verified") {
    throw new DomainError("UPLOAD_NOT_VERIFIED", "必须先完成 Storage 对账", 409);
  }
  const attempt = await beginAttempt(authority);
  if (!attempt) return await summary(authority.videoAssetId, "extracted");

  let reader: BudgetedRangeReader | null = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(authority.objectKey, SIGNED_READ_TTL_SECONDS);
    if (error || !data?.signedUrl) throw new Error("signed_read_url_failed");
    reader = new BudgetedRangeReader(data.signedUrl, authority.objectSize, controller.signal);
    const parsed = await parseMetadata({
      reader,
      extension: authority.extension,
      localModifiedAt: authority.localModifiedAt?.toISOString() ?? null,
      serialHmacKey: `${serverEnvironment().STUDY_SERIAL_HMAC_KEY}:${authority.studySerialHmacSalt}`,
    });
    return await finishSuccess({
      viewer,
      authority,
      attemptId: attempt.attemptId,
      attemptNumber: attempt.attemptNumber,
      requestId,
      reader,
      ...parsed,
    });
  } catch (error) {
    return await finishFailure({
      viewer,
      authority,
      attemptId: attempt.attemptId,
      attemptNumber: attempt.attemptNumber,
      requestId,
      reader,
      error,
    });
  } finally {
    clearTimeout(timeout);
  }
}
