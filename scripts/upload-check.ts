import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { Upload, type HttpRequest } from "tus-js-client";
import { internalParticipantEmail } from "@egocapture/core/domain/invitation";
import { createPublicId } from "@egocapture/core/domain/public-id";
import { taskContentHash } from "@egocapture/core/domain/task-instructions";
import { defaultTaskInstructions } from "@egocapture/core/domain/task-template";
import { fingerprintV1 } from "@egocapture/core/domain/upload";
import { api, assert, CookieJar, integrationEnvironment } from "@/scripts/check-support";

type PreviousUpload = {
  size: number | null;
  metadata: Record<string, string>;
  creationTime: string;
  urlStorageKey: string;
  uploadUrl: string | null;
  parallelUploadUrls: string[] | null;
};

class MemoryUrlStorage {
  private readonly uploads = new Map<string, { fingerprint: string; upload: PreviousUpload }>();
  async findAllUploads() { return [...this.uploads.values()].map(({ upload }) => upload); }
  async findUploadsByFingerprint(fingerprint: string) {
    return [...this.uploads.values()].filter((value) => value.fingerprint === fingerprint).map(({ upload }) => upload);
  }
  async removeUpload(key: string) { this.uploads.delete(key); }
  async addUpload(fingerprint: string, upload: PreviousUpload) {
    const key = `memory://${randomUUID()}`;
    this.uploads.set(key, { fingerprint, upload: { ...upload, urlStorageKey: key } });
    return key;
  }
}

function generateSyntheticMp4() {
  const directory = mkdtempSync(path.join(tmpdir(), "egocapture-upload-check-"));
  const file = path.join(directory, "synthetic-mobile.mp4");
  const sphericalFile = path.join(directory, "synthetic-equirectangular-360.mp4");
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30",
    "-t", "5", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10",
    "-pix_fmt", "yuv420p",
    "-metadata", "com.apple.quicktime.make=Synthetic",
    "-metadata", "com.apple.quicktime.model=TUS Check Cam",
    "-metadata", "com.apple.quicktime.creationdate=2026-09-01T12:34:56+08:00",
    "-movflags", "+faststart+use_metadata_tags", file,
  ]);
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=1024x512:rate=24",
    "-t", "2", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-metadata", "projection=equirectangular",
    "-metadata", "com.apple.quicktime.make=Synthetic",
    "-metadata", "com.apple.quicktime.model=TUS Check Cam",
    "-movflags", "+faststart+use_metadata_tags", sphericalFile,
  ]);
  return { directory, file, sphericalFile };
}

type UploadCredential = {
  uploadPublicId: string;
  objectKey: string;
  tusEndpoint: string;
  signedUploadToken: string;
  chunkSizeBytes: number;
  authMode: "official_signed" | "nas_scoped_jwt";
};

async function uploadDirect(bytes: Buffer, credential: UploadCredential, fingerprint: string) {
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(bytes, {
      endpoint: credential.tusEndpoint,
      retryDelays: [0, 500, 1_000],
      headers: {
        ...(credential.authMode === "official_signed"
          ? { "x-signature": credential.signedUploadToken }
          : { authorization: `Bearer ${credential.signedUploadToken}` }),
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      chunkSize: credential.chunkSizeBytes,
      metadata: {
        bucketName: "egocapture-raw",
        objectName: credential.objectKey,
        contentType: "video/mp4",
        cacheControl: "3600",
      },
      fingerprint: async () => `egocapture:${credential.uploadPublicId}:${fingerprint}`,
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

function errorStatus(error: Error) {
  return (error as Error & { originalResponse?: { getStatus(): number } }).originalResponse?.getStatus();
}

async function main() {
  const env = integrationEnvironment();
  const tusEndpoint = env.tusEndpoint;
  assert(new URL(tusEndpoint).port !== new URL(env.siteUrl).port, "TUS endpoint points at the Next.js control plane");
  const generated = generateSyntheticMp4();
  const bytes = readFileSync(generated.file);
  const sphericalBytes = readFileSync(generated.sphericalFile);
  const fileSize = statSync(generated.file).size;
  const sphericalFileSize = statSync(generated.sphericalFile).size;
  assert(fileSize > 6 * 1024 * 1024 && fileSize < 50_000_000, "Synthetic MP4 does not exercise multiple TUS chunks");
  const first = new Uint8Array(bytes.subarray(0, Math.min(bytes.length, 1024 * 1024)));
  const last = new Uint8Array(bytes.subarray(Math.max(0, bytes.length - 1024 * 1024)));
  const fingerprint = fingerprintV1(fileSize, first, last);
  const sphericalFingerprint = fingerprintV1(
    sphericalFileSize,
    new Uint8Array(sphericalBytes.subarray(0, Math.min(sphericalBytes.length, 1024 * 1024))),
    new Uint8Array(sphericalBytes.subarray(Math.max(0, sphericalBytes.length - 1024 * 1024))),
  );
  const db = postgres(env.databaseUrl, { max: 1, prepare: false, connect_timeout: 8, transform: postgres.camel });
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const suffix = randomUUID();
  const participantPassword = randomBytes(24).toString("base64url");
  const studyId = randomUUID();
  const studyPublicId = createPublicId("ST");
  const participantId = randomUUID();
  const participantPublicId = createPublicId("PT");
  const deviceId = randomUUID();
  const devicePublicId = createPublicId("DEV");
  const taskId = randomUUID();
  const taskPublicId = createPublicId("TSK");
  const taskVersionId = randomUUID();
  const assignmentId = randomUUID();
  const assignmentPublicId = createPublicId("AS");
  const instructions = structuredClone(defaultTaskInstructions);
  instructions.title = "TUS Upload Integration Fixture";
  const contentHash = taskContentHash(instructions);
  const jar = new CookieJar();
  let participantUserId: string | undefined;
  let uploadPublicId = "";
  let damagedUploadPublicId = "";
  let sphericalUploadPublicId = "";
  let duplicateUploadPublicId = "";
  let sessionPublicId = "";
  try {
    const { data: participant, error } = await supabase.auth.admin.createUser({
      email: internalParticipantEmail(participantPublicId),
      password: participantPassword,
      email_confirm: true,
    });
    if (error || !participant.user) throw error || new Error("Upload check Participant Auth creation failed");
    participantUserId = participant.user.id;
    const [participantProfile] = await db<{ id: string }[]>`
      insert into egocapture.profiles (auth_user_id, role, display_name)
      values (${participantUserId}::uuid, 'participant', 'TUS Upload Fixture Participant') returning id
    `;
    await db`
      insert into egocapture.studies (id, public_id, slug, name, serial_hmac_salt, is_demo)
      values (${studyId}::uuid, ${studyPublicId}, ${`upload-check-${suffix}`}, 'TUS Upload Integration Fixture', 'upload-check-salt', true)
    `;
    await db`
      insert into egocapture.participants (
        id, public_id, study_id, auth_user_id, display_alias, status, consent_status,
        consent_version, is_fixture
      ) values (
        ${participantId}::uuid, ${participantPublicId}, ${studyId}::uuid, ${participantUserId}::uuid,
        'TUS Upload Fixture', 'active', 'valid', 'upload-check-v1', true
      )
    `;
    await db`
      insert into egocapture.consent_records (participant_id, version, status, recorded_by, accepted_at)
      values (${participantId}::uuid, 'upload-check-v1', 'accepted', ${participantProfile.id}::uuid, now())
    `;
    await db`
      insert into egocapture.devices (
        id, public_id, study_id, manufacturer, model, device_type, serial_hmac, status, is_fixture
      ) values (
        ${deviceId}::uuid, ${devicePublicId}, ${studyId}::uuid, 'Synthetic', 'TUS Check Cam',
        'phone', null, 'active', true
      )
    `;
    await db`
      insert into egocapture.device_assignments (device_id, participant_id, assigned_by)
      values (${deviceId}::uuid, ${participantId}::uuid, ${participantProfile.id}::uuid)
    `;
    await db`
      insert into egocapture.tasks (
        id, public_id, study_id, title, lifecycle, draft_instructions, is_fixture, created_by
      ) values (
        ${taskId}::uuid, ${taskPublicId}, ${studyId}::uuid, ${instructions.title}, 'active', ${db.json(instructions)}, true,
        ${participantProfile.id}::uuid
      )
    `;
    await db`
      insert into egocapture.task_versions (
        id, task_id, study_id, version, instructions, content_hash, published_by
      ) values (
        ${taskVersionId}::uuid, ${taskId}::uuid, ${studyId}::uuid, 1, ${db.json(instructions)}, ${contentHash},
        ${participantProfile.id}::uuid
      )
    `;
    await db`
      insert into egocapture.assignments (
        id, public_id, study_id, participant_id, task_version_id, preferred_device_id,
        due_at, locale, status, acknowledged_at, acknowledged_content_hash, created_by
      ) values (
        ${assignmentId}::uuid, ${assignmentPublicId}, ${studyId}::uuid, ${participantId}::uuid,
        ${taskVersionId}::uuid, ${deviceId}::uuid, now() + interval '2 days', 'zh-CN',
        'acknowledged', now(), ${contentHash}, ${participantProfile.id}::uuid
      )
    `;

    const login = await api(env.siteUrl, "/api/auth/participant-login", {
      method: "POST", jar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantPublicId, password: participantPassword }),
    });
    assert(login.response.ok, "Upload check Participant login failed");
    const session = await api<{ data?: { sessionPublicId: string } }>(env.siteUrl, "/api/participant/sessions", {
      method: "POST", jar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({ assignmentPublicId, devicePublicId }),
    });
    assert(session.response.status === 201 && session.payload.data?.sessionPublicId, "Upload check Session creation failed");
    sessionPublicId = session.payload.data.sessionPublicId;
    const batch = await api<{ data?: { batchPublicId: string } }>(env.siteUrl, "/api/upload-batches", {
      method: "POST", jar, headers: { "idempotency-key": randomUUID() },
    });
    assert(batch.response.status === 201 && batch.payload.data?.batchPublicId, "Upload Batch creation failed");
    const oversized = await api<{ error?: { code: string } }>(env.siteUrl, "/api/upload-intents", {
      method: "POST", jar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        batchPublicId: batch.payload.data.batchPublicId,
        originalFilename: "too-large.mp4",
        sizeBytes: 50_000_001,
        contentType: "video/mp4",
        extension: "mp4",
        localModifiedAt: null,
        claimedSessionPublicId: sessionPublicId,
        unableToDetermine: false,
        fingerprintV1: "f".repeat(64),
      }),
    });
    assert(oversized.response.status === 413 && oversized.payload.error?.code === "FILE_TOO_LARGE", "50,000,001-byte server rejection is not 413");
    const intent = await api<{ data?: {
      uploadPublicId: string;
      attemptPublicId: string;
      objectKey: string;
      tusEndpoint: string;
      signedUploadToken: string;
      chunkSizeBytes: number;
      authMode: "official_signed" | "nas_scoped_jwt";
    } }>(env.siteUrl, "/api/upload-intents", {
      method: "POST", jar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        batchPublicId: batch.payload.data.batchPublicId,
        originalFilename: "device/path/synthetic-mobile.mp4",
        sizeBytes: fileSize,
        contentType: "video/mp4",
        extension: "mp4",
        localModifiedAt: new Date().toISOString(),
        claimedSessionPublicId: sessionPublicId,
        unableToDetermine: false,
        fingerprintV1: fingerprint,
      }),
    });
    let credential = intent.payload.data;
    assert(intent.response.status === 201 && credential?.uploadPublicId, "UploadIntent creation failed");
    uploadPublicId = credential.uploadPublicId;
    assert(credential.chunkSizeBytes === 6 * 1024 * 1024, "TUS chunk contract is not 6 MiB");
    assert(credential.tusEndpoint === tusEndpoint, "Server returned a non-authoritative TUS endpoint");
    assert(!credential.objectKey.includes("synthetic-mobile") && !credential.objectKey.includes(participantPublicId), "Object key contains display identifiers");
    const resumedAttempt = await api<{ data?: typeof credential & { resumedExistingAttempt: boolean } }>(
      env.siteUrl,
      `/api/uploads/${uploadPublicId}/attempts`,
      {
        method: "POST", jar, headers: { "content-type": "application/json" },
        body: JSON.stringify({ forceNew: false, reasonCode: "resume" }),
      },
    );
    assert(resumedAttempt.response.ok && resumedAttempt.payload.data?.attemptPublicId === credential.attemptPublicId, "Resume did not retain the same UploadAttempt");
    const replacementAttempt = await api<{ data?: typeof credential & { resumedExistingAttempt: boolean } }>(
      env.siteUrl,
      `/api/uploads/${uploadPublicId}/attempts`,
      {
        method: "POST", jar, headers: { "content-type": "application/json" },
        body: JSON.stringify({ forceNew: true, reasonCode: "tus_expired" }),
      },
    );
    assert(
      replacementAttempt.response.status === 201 && replacementAttempt.payload.data
        && replacementAttempt.payload.data.attemptPublicId !== credential.attemptPublicId,
      "Expired TUS replacement did not append a new UploadAttempt",
    );
    credential = replacementAttempt.payload.data;

    const deniedStatus = await new Promise<number>((resolve, reject) => {
      const denied = new Upload(Buffer.from("must-not-be-stored"), {
        endpoint: credential.tusEndpoint,
        retryDelays: null,
        headers: {
          ...(credential.authMode === "official_signed"
            ? { "x-signature": credential.signedUploadToken }
            : { authorization: `Bearer ${credential.signedUploadToken}` }),
          "x-upsert": "false",
        },
        uploadDataDuringCreation: true,
        chunkSize: credential.chunkSizeBytes,
        metadata: {
          bucketName: "egocapture-raw",
          objectName: `${credential.objectKey}.unauthorized`,
          contentType: "video/mp4",
          cacheControl: "3600",
        },
        fingerprint: async () => `egocapture:denied:${randomUUID()}`,
        onError: (error) => resolve(errorStatus(error) ?? 0),
        onSuccess: () => reject(new Error("Object-scoped upload credential accepted a different object key")),
      });
      denied.start();
    });
    assert([400, 401, 403].includes(deniedStatus), "Storage did not reject a credential used for another object key");

    const requests: string[] = [];
    const storage = new MemoryUrlStorage();
    const options = {
      endpoint: credential.tusEndpoint,
      retryDelays: [0, 500, 1_000],
      headers: {
        ...(credential.authMode === "official_signed"
          ? { "x-signature": credential.signedUploadToken }
          : { authorization: `Bearer ${credential.signedUploadToken}` }),
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: credential.chunkSizeBytes,
      metadata: {
        bucketName: "egocapture-raw",
        objectName: credential.objectKey,
        contentType: "video/mp4",
        cacheControl: "3600",
      },
      fingerprint: async () => `egocapture:${uploadPublicId}:${fingerprint}`,
      urlStorage: storage,
      onBeforeRequest: (request: HttpRequest) => { requests.push(request.getURL()); },
    };
    let firstUpload!: Upload;
    const pausedAt = await new Promise<number>((resolve, reject) => {
      let pausing = false;
      let uploadUrlAvailable = false;
      firstUpload = new Upload(bytes, {
        ...options,
        onUploadUrlAvailable: () => { uploadUrlAvailable = true; },
        onProgress: (uploaded) => {
          if (uploadUrlAvailable && !pausing && uploaded > 0 && uploaded < fileSize) {
            pausing = true;
            firstUpload.abort(false).then(() => resolve(uploaded), reject);
          }
        },
        onError: reject,
        onSuccess: () => reject(new Error("Initial TUS upload completed before pause")),
      });
      firstUpload.start();
    });
    assert(pausedAt > 0 && pausedAt < fileSize, "TUS pause did not retain a partial offset");
    const resumedUpload = new Upload(bytes, {
      ...options,
      onError: (error) => { throw new Error(`Resumed TUS failed (${errorStatus(error)}): ${error.message}`); },
    });
    const previous = await resumedUpload.findPreviousUploads();
    assert(previous.length === 1 && previous[0].uploadUrl, "findPreviousUploads did not find the paused TUS resource");
    resumedUpload.resumeFromPreviousUpload(previous[0]);
    await new Promise<void>((resolve, reject) => {
      resumedUpload.options.onError = reject;
      resumedUpload.options.onSuccess = () => resolve();
      resumedUpload.start();
    });
    assert(requests.length >= 2, "TUS did not issue resumable Storage requests");
    assert(requests.every((url) => new URL(url).port === new URL(tusEndpoint).port), "Video bytes were sent outside the Storage data plane");
    assert(requests.every((url) => new URL(url).port !== new URL(env.siteUrl).port), "Video bytes traversed the Next.js host");

    const completed = await api<{ data?: { transferStatus: string; videoAssetPublicId: string } }>(
      env.siteUrl,
      `/api/uploads/${uploadPublicId}/complete`,
      { method: "POST", jar },
    );
    assert(completed.response.ok && completed.payload.data?.transferStatus === "verified", "Upload Complete reconciliation failed");
    const replay = await api<{ data?: { transferStatus: string; videoAssetPublicId: string } }>(env.siteUrl, `/api/uploads/${uploadPublicId}/complete`, { method: "POST", jar });
    assert(
      replay.response.ok && replay.payload.data?.transferStatus === "verified"
        && replay.payload.data.videoAssetPublicId === completed.payload.data.videoAssetPublicId,
      "Upload Complete was not idempotent",
    );
    const metadata = await api<{ data?: {
      status: string;
      containerFormat: string | null;
      durationMs: number | null;
      videoCodec: string | null;
      width: number | null;
      height: number | null;
      rangeRequestCount: number;
      bytesRead: number;
      deviceConsistency: string;
    } }>(env.siteUrl, `/api/uploads/${uploadPublicId}/extract-metadata`, { method: "POST", jar });
    assert(metadata.response.ok && metadata.payload.data?.status === "extracted", "Metadata extraction did not complete");
    assert(metadata.payload.data.containerFormat === "MPEG-4", "MediaInfo did not identify the MP4 container");
    assert(metadata.payload.data.videoCodec === "AVC", "MediaInfo did not identify the H.264/AVC track");
    assert(metadata.payload.data.width === 1280 && metadata.payload.data.height === 720, "MediaInfo resolution mismatch");
    assert(metadata.payload.data.durationMs && metadata.payload.data.durationMs >= 4_900 && metadata.payload.data.durationMs <= 5_100, "MediaInfo duration mismatch");
    assert(metadata.payload.data.rangeRequestCount > 0 && metadata.payload.data.rangeRequestCount <= 24, "Metadata Range request budget mismatch");
    assert(metadata.payload.data.bytesRead > 0 && metadata.payload.data.bytesRead <= 16 * 1024 * 1024, "Metadata byte budget mismatch");
    assert(metadata.payload.data.deviceConsistency === "matched", "Declared and extracted synthetic device did not match");
    const metadataReplay = await api<{ data?: { status: string; attemptNumber: number } }>(
      env.siteUrl,
      `/api/uploads/${uploadPublicId}/extract-metadata`,
      { method: "POST", jar },
    );
    assert(
      metadataReplay.response.ok && metadataReplay.payload.data?.status === "extracted"
        && metadataReplay.payload.data.attemptNumber === 1,
      "Extract Metadata replay was not idempotent",
    );
    const [evidence] = await db<{
      storedSize: number;
      assetCount: number;
      attemptStatus: string;
      attemptCount: number;
      expiredAttemptCount: number;
      decisionType: string;
      assignmentStatus: string;
      auditCount: number;
      metadataStatus: string;
      metadataAttemptStatus: string;
      evidenceCount: number;
      metadataReviewCount: number;
    }[]>`
      select
        stored.size_bytes::integer as stored_size,
        (select count(*)::integer from egocapture.video_assets where upload_intent_id = intent.id) as asset_count,
        attempt.status as attempt_status,
        (select count(*)::integer from egocapture.upload_attempts where upload_intent_id = intent.id) as attempt_count,
        (select count(*)::integer from egocapture.upload_attempts where upload_intent_id = intent.id and status = 'expired') as expired_attempt_count,
        decision.decision_type,
        assignment.status as assignment_status,
        (select count(*)::integer from egocapture.audit_events where study_id = ${studyId}::uuid) as audit_count,
        intent.metadata_status,
        (select status from egocapture.metadata_attempts where video_asset_id = asset.id order by attempt_number desc limit 1) as metadata_attempt_status,
        (select count(*)::integer from egocapture.metadata_evidence where video_asset_id = asset.id) as evidence_count,
        (select count(*)::integer from egocapture.review_cases where video_asset_id = asset.id and case_type = 'metadata_failed') as metadata_review_count
      from egocapture.upload_intents intent
      join egocapture.stored_objects stored on stored.upload_intent_id = intent.id
      join egocapture.video_assets asset on asset.upload_intent_id = intent.id
      join egocapture.current_match_decisions decision on decision.video_asset_id = asset.id
      join egocapture.recording_sessions session on session.id = intent.claimed_session_id
      join egocapture.assignments assignment on assignment.id = session.assignment_id
      join lateral (
        select status from egocapture.upload_attempts where upload_intent_id = intent.id order by attempt_number desc limit 1
      ) attempt on true
      where intent.public_id = ${uploadPublicId}
    `;
    assert(
      evidence.storedSize === fileSize && evidence.assetCount === 1 &&
      evidence.attemptStatus === "completed" && evidence.attemptCount === 2 && evidence.expiredAttemptCount === 1 &&
      evidence.decisionType === "participant_claim" && evidence.assignmentStatus === "submitted" &&
      evidence.auditCount >= 5 && evidence.metadataStatus === "extracted" &&
      evidence.metadataAttemptStatus === "extracted" && evidence.evidenceCount >= 8 &&
      evidence.metadataReviewCount === 0,
      "TUS Upload database, match or audit evidence mismatch",
    );

    const sphericalBatch = await api<{ data?: { batchPublicId: string } }>(env.siteUrl, "/api/upload-batches", {
      method: "POST", jar, headers: { "idempotency-key": randomUUID() },
    });
    const sphericalIntent = await api<{ data?: UploadCredential }>(env.siteUrl, "/api/upload-intents", {
      method: "POST", jar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        batchPublicId: sphericalBatch.payload.data?.batchPublicId,
        originalFilename: "synthetic-equirectangular-360.mp4",
        sizeBytes: sphericalFileSize,
        contentType: "video/mp4",
        extension: "mp4",
        localModifiedAt: null,
        claimedSessionPublicId: sessionPublicId,
        unableToDetermine: false,
        fingerprintV1: sphericalFingerprint,
      }),
    });
    assert(sphericalIntent.response.status === 201 && sphericalIntent.payload.data, "360 UploadIntent creation failed");
    sphericalUploadPublicId = sphericalIntent.payload.data.uploadPublicId;
    await uploadDirect(sphericalBytes, sphericalIntent.payload.data, sphericalFingerprint);
    const sphericalComplete = await api<{ data?: { transferStatus: string } }>(
      env.siteUrl, `/api/uploads/${sphericalUploadPublicId}/complete`, { method: "POST", jar },
    );
    assert(sphericalComplete.response.ok && sphericalComplete.payload.data?.transferStatus === "verified", "360 object reconciliation failed");
    const sphericalMetadata = await api<{ data?: {
      status: string;
      containerFormat: string | null;
      projectionType: string | null;
      is360: boolean | null;
    } }>(env.siteUrl, `/api/uploads/${sphericalUploadPublicId}/extract-metadata`, { method: "POST", jar });
    assert(sphericalMetadata.response.ok && sphericalMetadata.payload.data?.containerFormat === "MPEG-4", "360 container parsing failed");
    assert(sphericalMetadata.payload.data.projectionType === "equirectangular" && sphericalMetadata.payload.data.is360 === true, "360 projection normalization failed");
    const [sphericalEvidence] = await db<{ projectionType: string | null; is360: boolean | null; evidenceCount: number }[]>`
      select metadata.projection_type, metadata.is_360,
        (select count(*)::integer from egocapture.metadata_evidence evidence
          where evidence.video_asset_id = asset.id and evidence.field_name in ('projection_type', 'is360')) as evidence_count
      from egocapture.upload_intents intent
      join egocapture.video_assets asset on asset.upload_intent_id = intent.id
      join egocapture.video_file_metadata metadata on metadata.video_asset_id = asset.id
      where intent.public_id = ${sphericalUploadPublicId}
    `;
    assert(sphericalEvidence.projectionType === "equirectangular" && sphericalEvidence.is360 === true && sphericalEvidence.evidenceCount === 2, "360 normalized evidence was not persisted");

    const duplicateBatch = await api<{ data?: { batchPublicId: string } }>(env.siteUrl, "/api/upload-batches", {
      method: "POST", jar, headers: { "idempotency-key": randomUUID() },
    });
    const duplicateIntent = await api<{ data?: UploadCredential & { duplicateCandidate: boolean } }>(env.siteUrl, "/api/upload-intents", {
      method: "POST", jar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        batchPublicId: duplicateBatch.payload.data?.batchPublicId,
        originalFilename: "same-bytes-copy.mp4",
        sizeBytes: fileSize,
        contentType: "video/mp4",
        extension: "mp4",
        localModifiedAt: null,
        claimedSessionPublicId: sessionPublicId,
        unableToDetermine: false,
        fingerprintV1: fingerprint,
      }),
    });
    assert(duplicateIntent.response.status === 201 && duplicateIntent.payload.data?.duplicateCandidate, "Duplicate candidate was not reported at intent creation");
    duplicateUploadPublicId = duplicateIntent.payload.data.uploadPublicId;
    await uploadDirect(bytes, duplicateIntent.payload.data, fingerprint);
    const duplicateComplete = await api<{ data?: { transferStatus: string } }>(
      env.siteUrl, `/api/uploads/${duplicateUploadPublicId}/complete`, { method: "POST", jar },
    );
    assert(duplicateComplete.response.ok && duplicateComplete.payload.data?.transferStatus === "verified", "Duplicate candidate transfer was incorrectly rejected");
    const [duplicateEvidence] = await db<{ reviewCount: number; activeAssetCount: number }[]>`
      select
        (select count(*)::integer from egocapture.review_cases review
          join egocapture.video_assets asset on asset.id = review.video_asset_id
          join egocapture.upload_intents intent on intent.id = asset.upload_intent_id
          where intent.public_id = ${duplicateUploadPublicId}
            and review.case_type = 'duplicate_candidate' and review.status = 'open') as review_count,
        (select count(*)::integer from egocapture.video_assets asset
          join egocapture.upload_intents intent on intent.id = asset.upload_intent_id
          where intent.study_id = ${studyId}::uuid and intent.size_bytes = ${fileSize}
            and intent.fingerprint_v1 = ${fingerprint} and asset.status = 'active') as active_asset_count
    `;
    assert(duplicateEvidence.reviewCount === 1 && duplicateEvidence.activeAssetCount >= 2, "Duplicate candidate did not preserve both assets for review");

    const missingBatch = await api<{ data?: { batchPublicId: string } }>(env.siteUrl, "/api/upload-batches", {
      method: "POST", jar, headers: { "idempotency-key": randomUUID() },
    });
    const missingIntent = await api<{ data?: UploadCredential }>(env.siteUrl, "/api/upload-intents", {
      method: "POST", jar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        batchPublicId: missingBatch.payload.data?.batchPublicId,
        originalFilename: "storage-missing.mp4",
        sizeBytes: 64,
        contentType: "video/mp4",
        extension: "mp4",
        localModifiedAt: null,
        claimedSessionPublicId: sessionPublicId,
        unableToDetermine: false,
        fingerprintV1: "b".repeat(64),
      }),
    });
    assert(missingIntent.response.status === 201 && missingIntent.payload.data, "Storage-missing intent creation failed");
    const missingComplete = await api<{ error?: { code: string } }>(
      env.siteUrl, `/api/uploads/${missingIntent.payload.data.uploadPublicId}/complete`, { method: "POST", jar },
    );
    assert(missingComplete.response.status === 409 && missingComplete.payload.error?.code === "STORAGE_MISSING", "Missing object reconciliation did not fail safely");

    const mismatchBytes = Buffer.from("object smaller than declared intent");
    const mismatchBatch = await api<{ data?: { batchPublicId: string } }>(env.siteUrl, "/api/upload-batches", {
      method: "POST", jar, headers: { "idempotency-key": randomUUID() },
    });
    const mismatchIntent = await api<{ data?: UploadCredential }>(env.siteUrl, "/api/upload-intents", {
      method: "POST", jar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        batchPublicId: mismatchBatch.payload.data?.batchPublicId,
        originalFilename: "size-mismatch.mp4",
        sizeBytes: mismatchBytes.byteLength + 10,
        contentType: "video/mp4",
        extension: "mp4",
        localModifiedAt: null,
        claimedSessionPublicId: sessionPublicId,
        unableToDetermine: false,
        fingerprintV1: "c".repeat(64),
      }),
    });
    assert(mismatchIntent.response.status === 201 && mismatchIntent.payload.data, "Size-mismatch intent creation failed");
    await uploadDirect(mismatchBytes, mismatchIntent.payload.data, "c".repeat(64));
    const mismatchComplete = await api<{ error?: { code: string } }>(
      env.siteUrl, `/api/uploads/${mismatchIntent.payload.data.uploadPublicId}/complete`, { method: "POST", jar },
    );
    assert(mismatchComplete.response.status === 409 && mismatchComplete.payload.error?.code === "SIZE_MISMATCH", "Size mismatch reconciliation did not fail safely");
    const [reconciliationEvidence] = await db<{ missingFailures: number; sizeFailures: number; reviewCount: number }[]>`
      select
        count(*) filter (where intent.failure_code = 'storage_missing')::integer as missing_failures,
        count(*) filter (where intent.failure_code = 'size_mismatch')::integer as size_failures,
        (select count(*)::integer from egocapture.review_cases review
          where review.study_id = ${studyId}::uuid and review.case_type = 'upload_failed'
            and review.status = 'open') as review_count
      from egocapture.upload_intents intent
      where intent.study_id = ${studyId}::uuid
    `;
    assert(reconciliationEvidence.missingFailures >= 1 && reconciliationEvidence.sizeFailures >= 1 && reconciliationEvidence.reviewCount >= 2, "Reconciliation failure evidence is incomplete");

    const damagedBytes = Buffer.from("This is intentionally not an MP4 container.");
    const damagedFingerprint = fingerprintV1(
      damagedBytes.byteLength,
      new Uint8Array(damagedBytes),
      new Uint8Array(damagedBytes),
    );
    const damagedBatch = await api<{ data?: { batchPublicId: string } }>(env.siteUrl, "/api/upload-batches", {
      method: "POST", jar, headers: { "idempotency-key": randomUUID() },
    });
    assert(damagedBatch.response.status === 201 && damagedBatch.payload.data, "Damaged fixture batch creation failed");
    const damagedIntent = await api<{ data?: typeof credential }>(env.siteUrl, "/api/upload-intents", {
      method: "POST", jar,
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        batchPublicId: damagedBatch.payload.data.batchPublicId,
        originalFilename: "damaged.mp4",
        sizeBytes: damagedBytes.byteLength,
        contentType: "video/mp4",
        extension: "mp4",
        localModifiedAt: null,
        claimedSessionPublicId: sessionPublicId,
        unableToDetermine: false,
        fingerprintV1: damagedFingerprint,
      }),
    });
    const damagedCredential = damagedIntent.payload.data;
    assert(damagedIntent.response.status === 201 && damagedCredential, "Damaged fixture UploadIntent failed");
    damagedUploadPublicId = damagedCredential.uploadPublicId;
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(damagedBytes, {
        endpoint: damagedCredential.tusEndpoint,
        retryDelays: [0, 500],
        headers: {
          ...(damagedCredential.authMode === "official_signed"
            ? { "x-signature": damagedCredential.signedUploadToken }
            : { authorization: `Bearer ${damagedCredential.signedUploadToken}` }),
          "x-upsert": "false",
        },
        uploadDataDuringCreation: true,
        chunkSize: damagedCredential.chunkSizeBytes,
        metadata: {
          bucketName: "egocapture-raw",
          objectName: damagedCredential.objectKey,
          contentType: "video/mp4",
          cacheControl: "3600",
        },
        fingerprint: async () => `egocapture:${damagedUploadPublicId}:${damagedFingerprint}`,
        onError: reject,
        onSuccess: () => resolve(),
      });
      upload.start();
    });
    const damagedComplete = await api<{ data?: { transferStatus: string } }>(
      env.siteUrl,
      `/api/uploads/${damagedUploadPublicId}/complete`,
      { method: "POST", jar },
    );
    assert(damagedComplete.response.ok && damagedComplete.payload.data?.transferStatus === "verified", "Damaged fixture did not preserve transfer verification");
    const damagedMetadata = await api<{ error?: { code: string } }>(
      env.siteUrl,
      `/api/uploads/${damagedUploadPublicId}/extract-metadata`,
      { method: "POST", jar },
    );
    assert(
      damagedMetadata.response.status === 422 && damagedMetadata.payload.error?.code === "METADATA_EXTRACTION_FAILED",
      "Damaged MP4 did not produce a safe metadata failure",
    );
    const [damagedEvidence] = await db<{
      transferStatus: string;
      metadataStatus: string;
      metadataAttemptStatus: string;
      reviewCount: number;
    }[]>`
      select intent.transfer_status, intent.metadata_status,
        attempt.status as metadata_attempt_status,
        (select count(*)::integer from egocapture.review_cases review
          where review.video_asset_id = asset.id and review.case_type = 'metadata_failed' and review.status = 'open') as review_count
      from egocapture.upload_intents intent
      join egocapture.video_assets asset on asset.upload_intent_id = intent.id
      join egocapture.metadata_attempts attempt on attempt.video_asset_id = asset.id
      where intent.public_id = ${damagedUploadPublicId}
    `;
    assert(
      damagedEvidence.transferStatus === "verified" && damagedEvidence.metadataStatus === "failed"
        && damagedEvidence.metadataAttemptStatus === "failed" && damagedEvidence.reviewCount === 1,
      "Damaged MP4 transfer/metadata/review state separation failed",
    );
  } finally {
    rmSync(generated.directory, { recursive: true, force: true });
    await db.end({ timeout: 2 });
  }
  console.log(`Signed TUS pause/resume, 360 metadata, duplicate review, reconciliation failures and damaged isolation passed; retained Demo Fixtures ${uploadPublicId}, ${sphericalUploadPublicId}, ${duplicateUploadPublicId}, ${damagedUploadPublicId} / ${sessionPublicId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture Upload: ${error.message}` : error);
  process.exitCode = 1;
});
