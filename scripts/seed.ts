import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import postgres from "postgres";
import { integrationEnvironment } from "@/scripts/check-support";
import { internalParticipantEmail } from "@egocapture/core/domain/invitation";
import { defaultTaskInstructions } from "@egocapture/core/domain/task-template";
import { taskContentHash, taskInstructionsSchema, type TaskInstructions } from "@egocapture/core/domain/task-instructions";

const ids = {
  study: "10000000-0000-4000-8000-000000000001",
  adminProfile: "20000000-0000-4000-8000-000000000001",
  participantProfile: "20000000-0000-4000-8000-000000000002",
  membership: "21000000-0000-4000-8000-000000000001",
  participant: "30000000-0000-4000-8000-000000000001",
  consent: "31000000-0000-4000-8000-000000000001",
  device: "40000000-0000-4000-8000-000000000001",
  deviceAssignment: "41000000-0000-4000-8000-000000000001",
  tasks: [
    "50000000-0000-4000-8000-000000000001",
    "50000000-0000-4000-8000-000000000002",
    "50000000-0000-4000-8000-000000000003",
    "50000000-0000-4000-8000-000000000004",
  ],
  versions: [
    "51000000-0000-4000-8000-000000000001",
    "51000000-0000-4000-8000-000000000002",
    "51000000-0000-4000-8000-000000000003",
    "51000000-0000-4000-8000-000000000004",
  ],
  assignments: [
    "60000000-0000-4000-8000-000000000001",
    "60000000-0000-4000-8000-000000000002",
    "60000000-0000-4000-8000-000000000003",
    "60000000-0000-4000-8000-000000000004",
  ],
  session: "61000000-0000-4000-8000-000000000001",
  uploadBatch: "70000000-0000-4000-8000-000000000001",
  failedBatch: "70000000-0000-4000-8000-000000000002",
  upload: "71000000-0000-4000-8000-000000000001",
  failedUpload: "71000000-0000-4000-8000-000000000002",
  uploadAttempt: "72000000-0000-4000-8000-000000000001",
  failedAttempt: "72000000-0000-4000-8000-000000000002",
  storedObject: "73000000-0000-4000-8000-000000000001",
  asset: "74000000-0000-4000-8000-000000000001",
  assetFile: "75000000-0000-4000-8000-000000000001",
  metadata: "76000000-0000-4000-8000-000000000001",
  decision: "77000000-0000-4000-8000-000000000001",
} as const;

const publicIds = {
  study: "ST-23456789",
  participant: "PT-23456789",
  device: "DEV-23456789",
  tasks: ["TSK-23456782", "TSK-23456783", "TSK-23456784", "TSK-23456785"],
  assignments: ["AS-23456782", "AS-23456783", "AS-23456784", "AS-23456785"],
  session: "RS-23456789",
  uploadBatch: "UB-23456789",
  failedBatch: "UB-23456782",
  upload: "UP-23456789",
  failedUpload: "UP-23456782",
  uploadAttempt: "UA-23456789",
  failedAttempt: "UA-23456782",
  asset: "VA-23456789",
  reviews: ["RV-23456782", "RV-23456783", "RV-23456784", "RV-23456785", "RV-23456786", "RV-23456787", "RV-23456788"],
} as const;

function instructions(title: string, description: string): TaskInstructions {
  const value = structuredClone(defaultTaskInstructions);
  value.title = title;
  value.description = description;
  return taskInstructionsSchema.parse(value);
}

const taskFixtures = [
  instructions("Demo Only：上传 5～20 秒测试视频", "录制一段不含个人信息的短视频，用于走通真实上传和人工匹配流程。"),
  instructions("制作一杯咖啡", "以第一人称视角展示准备杯子、冲泡与完成后的桌面。"),
  instructions("整理桌面", "以第一人称视角整理普通桌面物品，不拍摄屏幕通知或个人文件。"),
  instructions("将衣服放入洗衣机", "以第一人称视角展示将无识别信息的衣物放入洗衣机。"),
];

async function allUsers(supabase: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 100) break;
  }
  return users;
}

async function ensureAuthUser(
  supabase: SupabaseClient,
  users: User[],
  email: string,
  password: string,
  role: "admin" | "participant",
) {
  const existing = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing && (existing.user_metadata?.egocapture_fixture !== true || existing.user_metadata?.egocapture_role !== role)) {
    throw new Error(`HOLD: Auth Email ${email} 已被非 EgoCapture Demo Fixture 使用`);
  }
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { egocapture_fixture: true, egocapture_role: role },
    });
    if (error || !data.user) throw error || new Error(`无法恢复 ${role} Demo Auth User`);
    return data.user;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { egocapture_fixture: true, egocapture_role: role },
  });
  if (error || !data.user) throw error || new Error(`无法创建 ${role} Demo Auth User`);
  users.push(data.user);
  return data.user;
}

async function main() {
  const env = integrationEnvironment();
  const db = postgres(env.databaseUrl, { max: 1, prepare: false, connect_timeout: 8, transform: postgres.camel });
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  try {
    const users = await allUsers(supabase);
    const [adminUser, participantUser] = await Promise.all([
      ensureAuthUser(supabase, users, env.demoAdminEmail, env.demoAdminPassword, "admin"),
      ensureAuthUser(supabase, users, internalParticipantEmail(publicIds.participant), env.demoParticipantPassword, "participant"),
    ]);

    await db.begin(async (transaction) => {
      const existingStudies = await transaction<{ id: string; isDemo: boolean }[]>`
        select id, is_demo from egocapture.studies
        where id = ${ids.study}::uuid or public_id = ${publicIds.study} or slug = 'egocapture-demo'
      `;
      if (existingStudies.length > 1) throw new Error("HOLD: Demo Study 固定标识分别命中了多个对象");
      const [existingStudy] = existingStudies;
      if (existingStudy && (existingStudy.id !== ids.study || !existingStudy.isDemo)) {
        throw new Error("HOLD: Demo Study 标识已被非本 Fixture 对象占用");
      }
      const protectedRows = await transaction<{ kind: string; idMatches: boolean; isFixture: boolean }[]>`
        select 'participant' as kind, id = ${ids.participant}::uuid as id_matches, is_fixture
        from egocapture.participants
        where id = ${ids.participant}::uuid or public_id = ${publicIds.participant}
        union all
        select 'device' as kind, id = ${ids.device}::uuid as id_matches, is_fixture
        from egocapture.devices
        where id = ${ids.device}::uuid or public_id = ${publicIds.device}
        union all
        select 'review' as kind, true as id_matches, is_fixture
        from egocapture.review_cases
        where public_id = any(${[...publicIds.reviews]})
      `;
      if (protectedRows.some((row) => !row.idMatches || !row.isFixture)) {
        throw new Error("HOLD: Participant、Device 或 Review Public ID 已被非本 Demo Fixture 使用");
      }
      await transaction`
        insert into egocapture.studies (id, public_id, slug, name, serial_hmac_salt, is_demo)
        values (${ids.study}::uuid, ${publicIds.study}, 'egocapture-demo', 'EgoCapture Public Demo', 'egocapture-demo-v1', true)
        on conflict (id) do update set name = excluded.name, is_demo = true
      `;
      await transaction`
        insert into egocapture.profiles (id, auth_user_id, role, display_name, is_demo_admin)
        values (${ids.adminProfile}::uuid, ${adminUser.id}::uuid, 'admin', 'Admin Demo', true)
        on conflict (id) do update set auth_user_id = excluded.auth_user_id, role = 'admin', display_name = excluded.display_name, is_demo_admin = true
      `;
      await transaction`
        insert into egocapture.profiles (id, auth_user_id, role, display_name, is_demo_admin)
        values (${ids.participantProfile}::uuid, ${participantUser.id}::uuid, 'participant', 'Participant Demo', false)
        on conflict (id) do update set auth_user_id = excluded.auth_user_id, role = 'participant', display_name = excluded.display_name
      `;
      await transaction`
        insert into egocapture.study_memberships (id, study_id, profile_id, role, status)
        values (${ids.membership}::uuid, ${ids.study}::uuid, ${ids.adminProfile}::uuid, 'owner', 'active')
        on conflict (id) do update set role = 'owner', status = 'active'
      `;
      await transaction`
        insert into egocapture.participants (
          id, public_id, study_id, auth_user_id, display_alias, locale, timezone,
          country_region, status, consent_status, notes, is_fixture, created_by, consent_version
        ) values (
          ${ids.participant}::uuid, ${publicIds.participant}, ${ids.study}::uuid,
          ${participantUser.id}::uuid, 'Participant Demo', 'zh-CN', 'Asia/Shanghai',
          'Demo Region', 'active', 'valid', 'Synthetic fixture. Do not enter PII.', true,
          ${ids.adminProfile}::uuid, 'demo-consent-v1'
        )
        on conflict (id) do update set
          auth_user_id = excluded.auth_user_id, display_alias = excluded.display_alias,
          status = 'active', consent_status = 'valid', withdrawn_at = null,
          notes = excluded.notes, is_fixture = true
      `;
      await transaction`
        insert into egocapture.consent_records (
          id, participant_id, version, status, recorded_by, accepted_at
        ) values (
          ${ids.consent}::uuid, ${ids.participant}::uuid, 'demo-consent-v1', 'accepted',
          ${ids.adminProfile}::uuid, '2026-09-01T00:00:00Z'
        ) on conflict (id) do nothing
      `;
      await transaction`
        insert into egocapture.devices (
          id, public_id, study_id, manufacturer, model, device_type, status, is_fixture
        ) values (
          ${ids.device}::uuid, ${publicIds.device}, ${ids.study}::uuid,
          'Synthetic', 'Demo Phone', 'phone', 'active', true
        ) on conflict (id) do update set manufacturer = excluded.manufacturer,
          model = excluded.model, status = 'active', retired_at = null, is_fixture = true
      `;
      await transaction`
        insert into egocapture.device_assignments (
          id, device_id, participant_id, assigned_by
        ) values (
          ${ids.deviceAssignment}::uuid, ${ids.device}::uuid, ${ids.participant}::uuid, ${ids.adminProfile}::uuid
        ) on conflict (id) do update set ended_at = null, assigned_by = excluded.assigned_by
      `;
      await transaction`
        update egocapture.participants set default_device_id = ${ids.device}::uuid
        where id = ${ids.participant}::uuid
      `;

      for (const [index, fixture] of taskFixtures.entries()) {
        const contentHash = taskContentHash(fixture);
        await transaction`
          insert into egocapture.tasks (
            id, public_id, study_id, title, lifecycle, draft_instructions, is_fixture, created_by
          ) values (
            ${ids.tasks[index]}::uuid, ${publicIds.tasks[index]}, ${ids.study}::uuid,
            ${fixture.title}, 'active', ${transaction.json(fixture)}, true, ${ids.adminProfile}::uuid
          ) on conflict (id) do update set title = excluded.title, lifecycle = 'active',
            draft_instructions = excluded.draft_instructions, is_fixture = true
        `;
        await transaction`
          insert into egocapture.task_versions (
            id, task_id, study_id, version, instructions, content_hash, published_by
          ) values (
            ${ids.versions[index]}::uuid, ${ids.tasks[index]}::uuid, ${ids.study}::uuid,
            1, ${transaction.json(fixture)}, ${contentHash}, ${ids.adminProfile}::uuid
          ) on conflict (id) do nothing
        `;
        const [version] = await transaction<{ contentHash: string }[]>`
          select content_hash from egocapture.task_versions where id = ${ids.versions[index]}::uuid
        `;
        if (version.contentHash !== contentHash) throw new Error(`HOLD: Demo TaskVersion ${index + 1} 内容与固定快照冲突`);
      }

      const assignmentStates = [
        { status: "assigned", due: transaction`now() + interval '30 days'` },
        { status: "assigned", due: transaction`now() - interval '1 day'` },
        { status: "needs_review", due: transaction`now() + interval '7 days'` },
        { status: "assigned", due: transaction`now() + interval '14 days'` },
      ] as const;
      for (const [index, state] of assignmentStates.entries()) {
        await transaction`
          insert into egocapture.assignments (
            id, public_id, study_id, participant_id, task_version_id, preferred_device_id,
            due_at, locale, status, created_by, created_at
          ) values (
            ${ids.assignments[index]}::uuid, ${publicIds.assignments[index]}, ${ids.study}::uuid,
            ${ids.participant}::uuid, ${ids.versions[index]}::uuid, ${ids.device}::uuid,
            ${state.due}, 'zh-CN', ${state.status}, ${ids.adminProfile}::uuid,
            now() - interval '60 days'
          ) on conflict (id) do update set due_at = excluded.due_at, status = excluded.status,
            acknowledged_at = null, acknowledged_content_hash = null, canceled_at = null
        `;
      }
      await transaction`
        insert into egocapture.recording_sessions (
          id, public_id, assignment_id, participant_id, study_id, task_version_id,
          declared_device_id, timezone, status
        ) values (
          ${ids.session}::uuid, ${publicIds.session}, ${ids.assignments[2]}::uuid,
          ${ids.participant}::uuid, ${ids.study}::uuid, ${ids.versions[2]}::uuid,
          ${ids.device}::uuid, 'Asia/Shanghai', 'open'
        ) on conflict (id) do update set status = 'open', closed_at = null, close_reason = null
      `;

      const objectKey = `study/${ids.study}/participant/${ids.participant}/upload/${ids.upload}/70000000-0000-4000-8000-000000000099.mp4`;
      await transaction`
        insert into egocapture.upload_batches (id, public_id, study_id, participant_id, status, completed_at)
        values (${ids.uploadBatch}::uuid, ${publicIds.uploadBatch}, ${ids.study}::uuid, ${ids.participant}::uuid, 'completed', now())
        on conflict (id) do update set status = 'completed', completed_at = now()
      `;
      await transaction`
        insert into egocapture.upload_intents (
          id, public_id, batch_id, study_id, participant_id, original_filename,
          size_bytes, content_type, extension, object_key, unable_to_determine,
          fingerprint_v1, transfer_status, metadata_status, expected_expires_at,
          verified_at
        ) values (
          ${ids.upload}::uuid, ${publicIds.upload}, ${ids.uploadBatch}::uuid, ${ids.study}::uuid,
          ${ids.participant}::uuid, 'demo-fixture.mp4', 1000, 'video/mp4', 'mp4',
          ${objectKey}, true, ${"a".repeat(64)}, 'verified', 'failed', now() + interval '365 days', now()
        ) on conflict (id) do update set transfer_status = 'verified', metadata_status = 'failed',
          failure_code = null, expected_expires_at = now() + interval '365 days', verified_at = now()
      `;
      await transaction`
        insert into egocapture.upload_attempts (
          id, public_id, upload_intent_id, attempt_number, status, bytes_uploaded,
          started_at, completed_at
        ) values (
          ${ids.uploadAttempt}::uuid, ${publicIds.uploadAttempt}, ${ids.upload}::uuid,
          1, 'completed', 1000, now(), now()
        ) on conflict (id) do update set status = 'completed', bytes_uploaded = 1000,
          completed_at = now(), error_code = null
      `;
      await transaction`
        insert into egocapture.stored_objects (
          id, upload_intent_id, provider, bucket, object_key, size_bytes, verified_at
        ) values (
          ${ids.storedObject}::uuid, ${ids.upload}::uuid, 'supabase', 'egocapture-raw',
          ${objectKey}, 1000, now()
        ) on conflict (id) do update set verified_at = now(), deleted_at = null, delete_reason = null
      `;
      await transaction`
        insert into egocapture.video_assets (
          id, public_id, upload_intent_id, study_id, participant_id, status, is_fixture
        ) values (
          ${ids.asset}::uuid, ${publicIds.asset}, ${ids.upload}::uuid, ${ids.study}::uuid,
          ${ids.participant}::uuid, 'active', true
        ) on conflict (id) do update set status = 'active', is_fixture = true
      `;
      await transaction`
        insert into egocapture.asset_files (id, video_asset_id, stored_object_id, file_role)
        values (${ids.assetFile}::uuid, ${ids.asset}::uuid, ${ids.storedObject}::uuid, 'source')
        on conflict (id) do nothing
      `;
      await transaction`
        insert into egocapture.video_file_metadata (
          id, video_asset_id, parser_name, parser_version, container_format, duration_ms,
          file_size_bytes, video_codec, width, height, camera_manufacturer, camera_model,
          device_consistency, extracted_at
        ) values (
          ${ids.metadata}::uuid, ${ids.asset}::uuid, 'demo_fixture', '1', 'MPEG-4', 10000,
          1000, 'AVC', 1920, 960, 'Synthetic', 'Different Demo Camera', 'model_mismatch', now()
        ) on conflict (id) do update set camera_manufacturer = excluded.camera_manufacturer,
          camera_model = excluded.camera_model, device_consistency = 'model_mismatch', extracted_at = now()
      `;
      const [currentDecision] = await transaction<{
        id: string;
        decisionType: string;
        resolvedSessionId: string | null;
      }[]>`
        select id, decision_type, resolved_session_id
        from egocapture.match_decisions
        where video_asset_id = ${ids.asset}::uuid and superseded_by is null
        for update
      `;
      if (!currentDecision) {
        await transaction`
          insert into egocapture.match_decisions (
            id, video_asset_id, decision_type, decided_by
          ) values (${ids.decision}::uuid, ${ids.asset}::uuid, 'unmatched', ${ids.participantProfile}::uuid)
        `;
      } else if (currentDecision.decisionType !== "unmatched" || currentDecision.resolvedSessionId) {
        const nextId = randomUUID();
        await transaction`set constraints all deferred`;
        await transaction`update egocapture.match_decisions set superseded_by = ${nextId}::uuid where id = ${currentDecision.id}::uuid`;
        await transaction`
          insert into egocapture.match_decisions (
            id, video_asset_id, decision_type, supersedes_decision_id, decided_by
          ) values (
            ${nextId}::uuid, ${ids.asset}::uuid, 'unmatched', ${currentDecision.id}::uuid,
            ${ids.participantProfile}::uuid
          )
        `;
      }

      await transaction`
        insert into egocapture.upload_batches (id, public_id, study_id, participant_id, status, completed_at)
        values (${ids.failedBatch}::uuid, ${publicIds.failedBatch}, ${ids.study}::uuid, ${ids.participant}::uuid, 'completed', now())
        on conflict (id) do update set status = 'completed', completed_at = now()
      `;
      await transaction`
        insert into egocapture.upload_intents (
          id, public_id, batch_id, study_id, participant_id, original_filename,
          size_bytes, content_type, extension, object_key, claimed_session_id,
          unable_to_determine, fingerprint_v1, transfer_status, metadata_status,
          expected_expires_at, failure_code
        ) values (
          ${ids.failedUpload}::uuid, ${publicIds.failedUpload}, ${ids.failedBatch}::uuid,
          ${ids.study}::uuid, ${ids.participant}::uuid, 'demo-upload-failed.mp4', 1000,
          'video/mp4', 'mp4',
          ${`study/${ids.study}/participant/${ids.participant}/upload/${ids.failedUpload}/70000000-0000-4000-8000-000000000098.mp4`},
          ${ids.session}::uuid, false, ${"b".repeat(64)}, 'failed', 'pending',
          now() + interval '365 days', 'storage_missing'
        ) on conflict (id) do update set transfer_status = 'failed', metadata_status = 'pending',
          failure_code = 'storage_missing', expected_expires_at = now() + interval '365 days'
      `;
      await transaction`
        insert into egocapture.upload_attempts (
          id, public_id, upload_intent_id, attempt_number, status, bytes_uploaded,
          started_at, completed_at, error_code
        ) values (
          ${ids.failedAttempt}::uuid, ${publicIds.failedAttempt}, ${ids.failedUpload}::uuid,
          1, 'failed', 0, now(), now(), 'storage_missing'
        ) on conflict (id) do update set status = 'failed', bytes_uploaded = 0,
          completed_at = now(), error_code = 'storage_missing'
      `;

      const reviewFixtures = [
        { publicId: publicIds.reviews[0], type: "missing", assignmentId: ids.assignments[1], assetId: null, uploadId: null, reason: "demo_fixture_missing_due_assignment" },
        { publicId: publicIds.reviews[1], type: "upload_failed", assignmentId: ids.assignments[3], assetId: null, uploadId: ids.failedUpload, reason: "demo_fixture_storage_missing" },
        { publicId: publicIds.reviews[2], type: "metadata_failed", assignmentId: ids.assignments[2], assetId: ids.asset, uploadId: null, reason: "demo_fixture_parser_failure" },
        { publicId: publicIds.reviews[3], type: "duplicate_candidate", assignmentId: ids.assignments[2], assetId: ids.asset, uploadId: null, reason: "demo_fixture_matching_fingerprint" },
        { publicId: publicIds.reviews[4], type: "unmatched", assignmentId: ids.assignments[2], assetId: ids.asset, uploadId: null, reason: "demo_fixture_unable_to_determine" },
        { publicId: publicIds.reviews[5], type: "device_mismatch", assignmentId: ids.assignments[2], assetId: ids.asset, uploadId: null, reason: "demo_fixture_model_mismatch" },
        { publicId: publicIds.reviews[6], type: "needs_review", assignmentId: ids.assignments[2], assetId: ids.asset, uploadId: null, reason: "demo_fixture_human_decision_required" },
      ];
      for (const fixture of reviewFixtures) {
        await transaction`
          insert into egocapture.review_cases (
            public_id, study_id, video_asset_id, assignment_id, upload_intent_id,
            case_type, status, reason, is_fixture
          ) values (
            ${fixture.publicId}, ${ids.study}::uuid, ${fixture.assetId}::uuid,
            ${fixture.assignmentId}::uuid, ${fixture.uploadId}::uuid,
            ${fixture.type}, 'open', ${fixture.reason}, true
          ) on conflict (public_id) do update set
            video_asset_id = excluded.video_asset_id, assignment_id = excluded.assignment_id,
            upload_intent_id = excluded.upload_intent_id, case_type = excluded.case_type,
            status = 'open', reason = excluded.reason, resolution_reason = null,
            resolved_at = null, is_fixture = true
        `;
      }
    });

    console.log(`Demo Seed restored: Admin ${env.demoAdminUsername}; Participant ${publicIds.participant}; 4 TaskVersions; 7 Demo Fixture ReviewCases`);
  } finally {
    await db.end({ timeout: 2 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture seed: ${error.message}` : error);
  process.exitCode = 1;
});
