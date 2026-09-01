import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { Upload, type HttpRequest } from "tus-js-client";
import { internalParticipantEmail } from "@/src/domain/invitation";
import { createPublicId } from "@/src/domain/public-id";
import { taskContentHash } from "@/src/domain/task-instructions";
import { defaultTaskInstructions } from "@/src/domain/task-template";
import { fingerprintV1 } from "@/src/domain/upload";
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
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30",
    "-t", "5", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", file,
  ]);
  return { directory, file };
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
  const fileSize = statSync(generated.file).size;
  assert(fileSize > 6 * 1024 * 1024 && fileSize < 50_000_000, "Synthetic MP4 does not exercise multiple TUS chunks");
  const first = new Uint8Array(bytes.subarray(0, Math.min(bytes.length, 1024 * 1024)));
  const last = new Uint8Array(bytes.subarray(Math.max(0, bytes.length - 1024 * 1024)));
  const fingerprint = fingerprintV1(fileSize, first, last);
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
        'phone', ${createHash("sha256").update(suffix).digest("hex")}, 'active', true
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
    const [evidence] = await db<{
      storedSize: number;
      assetCount: number;
      attemptStatus: string;
      attemptCount: number;
      expiredAttemptCount: number;
      decisionType: string;
      assignmentStatus: string;
      auditCount: number;
    }[]>`
      select
        stored.size_bytes::integer as stored_size,
        (select count(*)::integer from egocapture.video_assets where upload_intent_id = intent.id) as asset_count,
        attempt.status as attempt_status,
        (select count(*)::integer from egocapture.upload_attempts where upload_intent_id = intent.id) as attempt_count,
        (select count(*)::integer from egocapture.upload_attempts where upload_intent_id = intent.id and status = 'expired') as expired_attempt_count,
        decision.decision_type,
        assignment.status as assignment_status,
        (select count(*)::integer from egocapture.audit_events where study_id = ${studyId}::uuid) as audit_count
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
      evidence.auditCount >= 4,
      "TUS Upload database, match or audit evidence mismatch",
    );
  } finally {
    rmSync(generated.directory, { recursive: true, force: true });
    await db.end({ timeout: 2 });
  }
  console.log(`Signed TUS direct upload, pause, resume, object reconciliation, idempotent Complete and participant_claim passed; retained Demo Fixture ${uploadPublicId} / ${sessionPublicId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture Upload: ${error.message}` : error);
  process.exitCode = 1;
});
