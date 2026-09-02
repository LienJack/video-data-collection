import { createHash } from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { internalParticipantEmail } from "@egocapture/core/domain/invitation";
import { taskContentHash } from "@egocapture/core/domain/task-instructions";
import postgres from "postgres";
import { integrationEnvironment } from "@/scripts/check-support";
import { EGOCAPTURE_BUSINESS_TABLES } from "@/scripts/demo-refresh-guard";
import {
  buildDemoCatalog,
  DEMO_SEED_ANCHOR,
  demoTime,
  stableDemoUuid,
} from "@/scripts/fixtures/demo-catalog";

type IntegrationEnvironment = ReturnType<typeof integrationEnvironment>;

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fingerprint(value: string): string {
  return createHash("sha256").update(`egocapture/demo-fixture/${value}`).digest("hex");
}

function addHours(value: string, hours: number): string {
  return new Date(new Date(value).getTime() + hours * 60 * 60 * 1_000).toISOString();
}

async function allUsers(supabase: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 100) return users;
  }
  throw new Error("HOLD: Auth user inventory exceeded the bounded fixture scan");
}

async function ensureFixtureUser(
  supabase: SupabaseClient,
  users: User[],
  input: { email: string; password: string; role: "admin" | "participant"; catalogKey: string },
): Promise<User> {
  assertInternalDemoEmail(input.email);
  const existing = assertFixtureAuthIdentityAvailable(users, input);
  const userMetadata = {
    ...(existing?.user_metadata ?? {}),
    egocapture_fixture: true,
    egocapture_role: input.role,
    egocapture_catalog_key: input.catalogKey,
  };
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: userMetadata,
    });
    if (error || !data.user) throw error ?? new Error(`Unable to restore Auth fixture ${input.catalogKey}`);
    return data.user;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: userMetadata,
  });
  if (error || !data.user) throw error ?? new Error(`Unable to create Auth fixture ${input.catalogKey}`);
  users.push(data.user);
  return data.user;
}

export function assertInternalDemoEmail(email: string): void {
  const normalized = email.trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0 || !normalized.slice(separator + 1).endsWith(".invalid")) {
    throw new Error("HOLD: demo Auth email must use the reserved .invalid domain");
  }
}

export function assertFixtureAuthIdentityAvailable<T extends {
  email?: string;
  user_metadata?: Record<string, unknown>;
}>(
  users: readonly T[],
  input: { email: string; role: "admin" | "participant"; catalogKey: string },
): T | undefined {
  const desiredEmail = input.email.trim().toLowerCase();
  const owners = users.filter(
    (user) => user.user_metadata?.egocapture_catalog_key === input.catalogKey,
  );
  if (owners.length > 1 || owners.some((user) => user.email?.toLowerCase() !== desiredEmail)) {
    throw new Error(`HOLD: Auth catalog identity collision for ${input.catalogKey}`);
  }
  const matchingEmails = users.filter((user) => user.email?.toLowerCase() === desiredEmail);
  if (matchingEmails.length > 1) {
    throw new Error(`HOLD: duplicate Auth email for ${input.catalogKey}`);
  }
  const existing = matchingEmails[0];
  if (existing && (
    existing.user_metadata?.egocapture_fixture !== true
    || existing.user_metadata?.egocapture_catalog_key !== input.catalogKey
    || existing.user_metadata?.egocapture_role !== input.role
  )) {
    throw new Error(`HOLD: Auth identity collision for ${input.catalogKey}`);
  }
  return existing;
}

async function requireEmptyBusinessGraph(db: postgres.Sql) {
  let rowCount = 0;
  for (const table of EGOCAPTURE_BUSINESS_TABLES) {
    const [result] = await db.unsafe<{ count: number }[]>(
      `select count(*)::integer as count from egocapture."${table}"`,
    );
    rowCount += result.count;
  }
  if (rowCount !== 0) {
    throw new Error(`HOLD: EgoCapture business graph is not empty (${rowCount} rows); run the guarded demo refresh`);
  }
}

function requiredMapValue<T>(map: ReadonlyMap<string, T>, key: string, kind: string): T {
  const value = map.get(key);
  if (!value) throw new Error(`Demo catalog ${kind} not found: ${key}`);
  return value;
}

export async function seedDemoData(
  env: IntegrationEnvironment,
  anchor = DEMO_SEED_ANCHOR,
): Promise<{ anchor: string; participants: number; participantLogins: number; tasks: number; scenarios: number }> {
  const catalog = buildDemoCatalog(anchor);
  const db = postgres(env.databaseUrl, { max: 1, prepare: false, connect_timeout: 8, idle_timeout: 2, transform: postgres.camel });
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  try {
    await requireEmptyBusinessGraph(db);
    assertInternalDemoEmail(env.demoAdminEmail);
    const users = await allUsers(supabase);
    const adminUser = await ensureFixtureUser(supabase, users, {
      email: env.demoAdminEmail,
      password: env.demoAdminPassword,
      role: "admin",
      catalogKey: catalog.admin.key,
    });
    const participantUsers = new Map<string, User>();
    for (const person of catalog.people.filter((candidate) => candidate.login)) {
      participantUsers.set(person.key, await ensureFixtureUser(supabase, users, {
        email: internalParticipantEmail(person.publicId),
        password: env.demoParticipantPassword,
        role: "participant",
        catalogKey: person.key,
      }));
    }

    await db.begin(async (transaction) => {
      await transaction`
        insert into egocapture.profiles (
          id, auth_user_id, role, display_name, is_demo_admin, created_at, updated_at
        ) values (
          ${catalog.admin.profileId}::uuid, ${adminUser.id}::uuid, 'admin', ${catalog.admin.displayName},
          true, ${demoTime(anchor, -100)}::timestamptz, ${demoTime(anchor, -100)}::timestamptz
        )
      `;

      for (const person of catalog.people.filter((candidate) => candidate.login)) {
        const user = requiredMapValue(participantUsers, person.key, "Auth user");
        await transaction`
          insert into egocapture.profiles (
            id, auth_user_id, role, display_name, is_demo_admin, created_at, updated_at
          ) values (
            ${person.profileId}::uuid, ${user.id}::uuid, 'participant', ${person.displayAlias},
            false, ${person.createdAt}::timestamptz, ${person.createdAt}::timestamptz
          )
        `;
      }

      for (const person of catalog.people) {
        const user = person.login ? requiredMapValue(participantUsers, person.key, "Auth user") : null;
        await transaction`
          insert into egocapture.participants (
            id, public_id, auth_user_id, display_alias, management_email, locale, timezone,
            country_region, status, consent_status, notes, is_fixture, created_by,
            created_at, updated_at, withdrawn_at
          ) values (
            ${person.id}::uuid, ${person.publicId}, ${user?.id ?? null}::uuid, ${person.displayAlias},
            null, ${person.region.locale}, ${person.region.timezone}, ${person.region.countryCode},
            ${person.status}, ${person.consentStatus},
            'Fictional demonstration fixture; no real personal information.', true,
            ${catalog.admin.profileId}::uuid, ${person.createdAt}::timestamptz,
            ${person.createdAt}::timestamptz, ${person.withdrawnAt}::timestamptz
          )
        `;

        if (person.login) {
          await transaction`
            insert into egocapture.participant_login_credentials (
              participant_id, password, version, updated_at, synced_at
            ) values (
              ${person.id}::uuid, ${env.demoParticipantPassword}, 1,
              ${person.createdAt}::timestamptz, ${person.createdAt}::timestamptz
            )
          `;
        }

        if (person.consentStatus !== "pending") {
          const recordStatus = person.consentStatus === "valid" ? "accepted" : person.consentStatus;
          const acceptedAt = recordStatus === "accepted" ? addHours(person.createdAt, 24) : null;
          const effectiveUntil = recordStatus === "accepted"
            ? demoTime(anchor, 180)
            : recordStatus === "expired" ? demoTime(anchor, -1) : null;
          await transaction`
            insert into egocapture.consent_records (
              id, participant_id, status, recorded_by, accepted_at, effective_until, reason, created_at
            ) values (
              ${stableDemoUuid("consent-record", person.key)}::uuid, ${person.id}::uuid,
              ${recordStatus}, ${catalog.admin.profileId}::uuid, ${acceptedAt}::timestamptz,
              ${effectiveUntil}::timestamptz,
              ${recordStatus === "expired" ? "Demo consent validity period expired." : recordStatus === "withdrawn" ? "Demo participant withdrew consent." : null},
              ${addHours(person.createdAt, 24)}::timestamptz
            )
          `;
        }

        if (person.status === "invited") {
          const invited = catalog.people.filter((candidate) => candidate.status === "invited");
          const invitationIndex = invited.findIndex((candidate) => candidate.key === person.key);
          const invitationStatus = invitationIndex % 2 === 0 ? "generated" : "opened";
          const createdAt = demoTime(anchor, -3 - invitationIndex);
          await transaction`
            insert into egocapture.participant_invitations (
              id, participant_id, token_hash, status, expires_at, opened_at, created_by, created_at
            ) values (
              ${stableDemoUuid("participant-invitation", person.key)}::uuid, ${person.id}::uuid,
              ${createHash("sha256").update(`demo-invitation/${person.key}`).digest()},
              ${invitationStatus}, ${demoTime(anchor, 14)}::timestamptz,
              ${invitationStatus === "opened" ? addHours(createdAt, 2) : null}::timestamptz,
              ${catalog.admin.profileId}::uuid, ${createdAt}::timestamptz
            )
          `;
        }
      }

      const people = new Map(catalog.people.map((person) => [person.key, person]));
      const devicesByParticipant = new Map<string, (typeof catalog.devices)[number]>();
      for (const device of catalog.devices) {
        const person = requiredMapValue(people, device.participantKey, "participant");
        await transaction`
          insert into egocapture.devices (
            id, public_id, manufacturer, model, device_type, serial_hmac, firmware_version,
            status, is_fixture, created_at, updated_at, retired_at
          ) values (
            ${device.id}::uuid, ${device.publicId}, ${device.manufacturer}, ${device.model},
            ${device.deviceType}, null, ${device.firmwareVersion}, ${device.status}, true,
            ${device.assignedAt}::timestamptz, ${device.assignedAt}::timestamptz, ${device.endedAt}::timestamptz
          )
        `;
        await transaction`
          insert into egocapture.device_assignments (
            id, device_id, participant_id, assigned_at, ended_at, assigned_by, reason
          ) values (
            ${device.assignmentId}::uuid, ${device.id}::uuid, ${person.id}::uuid,
            ${device.assignedAt}::timestamptz, ${device.endedAt}::timestamptz,
            ${catalog.admin.profileId}::uuid,
            ${device.endedAt ? "Demo device assignment ended after retirement." : null}
          )
        `;
        if (!devicesByParticipant.has(person.key) || device.isDefault) devicesByParticipant.set(person.key, device);
        if (device.isDefault) {
          await transaction`update egocapture.participants set default_device_id = ${device.id}::uuid where id = ${person.id}::uuid`;
        }
      }

      const tasks = new Map(catalog.tasks.map((task) => [task.key, task]));
      for (const task of catalog.tasks) {
        await transaction`
          insert into egocapture.tasks (
            id, public_id, title, lifecycle, draft_instructions, is_fixture, created_by,
            created_at, updated_at
          ) values (
            ${task.id}::uuid, ${task.publicId}, ${task.instructions.title}, ${task.lifecycle},
            ${transaction.json(task.instructions)}, true, ${catalog.admin.profileId}::uuid,
            ${task.createdAt}::timestamptz, ${task.createdAt}::timestamptz
          )
        `;
        if (task.versionId && task.publishedAt) {
          await transaction`
            insert into egocapture.task_versions (
              id, task_id, version, instructions, content_hash, published_by, published_at
            ) values (
              ${task.versionId}::uuid, ${task.id}::uuid, 1,
              ${transaction.json(task.instructions)}, ${taskContentHash(task.instructions)},
              ${catalog.admin.profileId}::uuid, ${task.publishedAt}::timestamptz
            )
          `;
        }
      }

      const scenarios = new Map(catalog.scenarios.map((scenario) => [scenario.key, scenario]));
      for (const scenario of catalog.scenarios) {
        const person = requiredMapValue(people, scenario.participantKey, "participant");
        const task = requiredMapValue(tasks, scenario.taskKey, "task");
        if (!task.versionId) throw new Error(`Demo scenario cannot target draft task: ${scenario.key}`);
        const preferredDevice = devicesByParticipant.get(person.key) ?? null;
        const acknowledged = !["assigned", "expired", "missing_upload", "canceled"].includes(scenario.assignmentStatus);
        const canceledAt = scenario.assignmentStatus === "canceled" ? demoTime(anchor, -1) : null;
        await transaction`
          insert into egocapture.assignments (
            id, public_id, participant_id, task_version_id, task_id, preferred_device_id,
            due_at, locale, note, status, acknowledged_at, acknowledged_content_hash,
            canceled_at, created_by, created_at, updated_at
          ) values (
            ${scenario.assignmentId}::uuid, ${scenario.assignmentPublicId}, ${person.id}::uuid,
            ${task.versionId}::uuid, ${task.id}::uuid, ${preferredDevice?.id ?? null}::uuid,
            ${scenario.dueAt}::timestamptz, ${person.region.locale},
            ${`Demo scenario: ${scenario.kind}.`}, ${scenario.assignmentStatus},
            ${acknowledged ? addHours(scenario.createdAt, 24) : null}::timestamptz,
            ${acknowledged ? taskContentHash(task.instructions) : null}, ${canceledAt}::timestamptz,
            ${catalog.admin.profileId}::uuid, ${scenario.createdAt}::timestamptz, ${scenario.createdAt}::timestamptz
          )
        `;
        await transaction`
          insert into egocapture.task_participant_plans (
            id, task_id, participant_id, preferred_device_id, due_at, locale, note,
            assignment_id, created_by, created_at, updated_at
          ) values (
            ${stableDemoUuid("task-participant-plan", scenario.key)}::uuid, ${task.id}::uuid,
            ${person.id}::uuid, ${preferredDevice?.id ?? null}::uuid, ${scenario.dueAt}::timestamptz,
            ${person.region.locale}, ${`Demo plan for ${scenario.kind}.`},
            ${scenario.assignmentId}::uuid, ${catalog.admin.profileId}::uuid,
            ${scenario.createdAt}::timestamptz, ${scenario.createdAt}::timestamptz
          )
        `;
      }

      const draftTask = catalog.tasks.find((task) => task.lifecycle === "draft");
      const draftPerson = catalog.people.find((person) => person.key === "us-sophia-brown");
      if (!draftTask || !draftPerson) throw new Error("Demo draft plan authority is incomplete");
      await transaction`
        insert into egocapture.task_participant_plans (
          id, task_id, participant_id, due_at, locale, note, created_by, created_at, updated_at
        ) values (
          ${stableDemoUuid("task-participant-plan", "draft-us-books")}::uuid,
          ${draftTask.id}::uuid, ${draftPerson.id}::uuid, ${demoTime(anchor, 30)}::timestamptz,
          ${draftPerson.region.locale}, 'Draft roster preview; no assignment exists yet.',
          ${catalog.admin.profileId}::uuid, ${demoTime(anchor, -10)}::timestamptz,
          ${demoTime(anchor, -10)}::timestamptz
        )
      `;

      for (const scenario of catalog.scenarios) {
        const sessionStatus = scenario.sessionStatus;
        if (!scenario.sessionId || !sessionStatus) continue;
        const person = requiredMapValue(people, scenario.participantKey, "participant");
        const task = requiredMapValue(tasks, scenario.taskKey, "task");
        const device = requiredMapValue(devicesByParticipant, person.key, "declared device");
        await transaction`
          insert into egocapture.recording_sessions (
            id, public_id, assignment_id, participant_id, task_version_id,
            declared_device_id, timezone, status, marker_acknowledged_at,
            closed_at, close_reason, created_at, updated_at
          ) values (
            ${scenario.sessionId}::uuid, ${scenario.sessionPublicId}, ${scenario.assignmentId}::uuid,
            ${person.id}::uuid, ${task.versionId}::uuid, ${device.id}::uuid,
            ${person.region.timezone}, ${sessionStatus}, ${addHours(scenario.createdAt, 1)}::timestamptz,
            ${sessionStatus === "closed" ? addHours(scenario.createdAt, 3) : null}::timestamptz,
            ${sessionStatus === "closed" ? "Demo recording session completed normally." : null},
            ${scenario.createdAt}::timestamptz, ${scenario.createdAt}::timestamptz
          )
        `;
      }

      for (const [scenarioIndex, scenario] of catalog.scenarios.entries()) {
        const person = requiredMapValue(people, scenario.participantKey, "participant");
        const device = devicesByParticipant.get(person.key) ?? null;
        const sizeBytes = 1_024 + scenarioIndex * 128;
        const objectFilename = stableDemoUuid("object-file", scenario.key);
        const objectKey = `participant/${person.id}/upload/${scenario.uploadIntentId}/${objectFilename}.mp4`;

        if (scenario.uploadBatchId) {
          const uploadBatchStatus = scenario.uploadBatchStatus;
          if (!uploadBatchStatus) throw new Error(`Demo upload batch status missing: ${scenario.key}`);
          await transaction`
            insert into egocapture.upload_batches (
              id, public_id, participant_id, status, created_at, completed_at
            ) values (
              ${scenario.uploadBatchId}::uuid, ${scenario.uploadBatchPublicId}, ${person.id}::uuid,
              ${uploadBatchStatus}, ${scenario.createdAt}::timestamptz,
              ${uploadBatchStatus === "open" ? null : addHours(scenario.createdAt, 4)}::timestamptz
            )
          `;
        }

        if (scenario.uploadIntentId && scenario.uploadBatchId) {
          const transferStatus = scenario.transferStatus;
          const metadataStatus = scenario.metadataStatus;
          if (!transferStatus || !metadataStatus) throw new Error(`Demo upload state missing: ${scenario.key}`);
          await transaction`
            insert into egocapture.upload_intents (
              id, public_id, batch_id, participant_id, original_filename, size_bytes,
              content_type, extension, local_modified_at, object_key, claimed_session_id,
              unable_to_determine, participant_note, fingerprint_v1, transfer_status,
              metadata_status, expected_expires_at, verified_at, failure_code,
              created_at, updated_at
            ) values (
              ${scenario.uploadIntentId}::uuid, ${scenario.uploadPublicId}, ${scenario.uploadBatchId}::uuid,
              ${person.id}::uuid, ${`fixture-${scenario.key}.mp4`}, ${sizeBytes}, 'video/mp4', 'mp4',
              ${scenario.createdAt}::timestamptz, ${objectKey}, ${scenario.sessionId}::uuid,
              ${scenario.sessionId === null}, 'Fixture metadata only; no media object is shipped.',
              ${fingerprint(scenario.key)}, ${transferStatus}, ${metadataStatus},
              ${transferStatus === "expired" ? demoTime(anchor, -1) : demoTime(anchor, 365)}::timestamptz,
              ${transferStatus === "verified" ? addHours(scenario.createdAt, 4) : null}::timestamptz,
              ${transferStatus === "failed" ? "demo_fixture_upload_failure" : null},
              ${scenario.createdAt}::timestamptz, ${scenario.createdAt}::timestamptz
            )
          `;
        }

        for (const [attemptIndex, status] of (scenario.uploadAttemptStatuses ?? []).entries()) {
          const terminal = ["completed", "failed", "aborted", "expired"].includes(status);
          await transaction`
            insert into egocapture.upload_attempts (
              id, public_id, upload_intent_id, attempt_number, status, bytes_uploaded,
              expires_at, started_at, completed_at, error_code, created_at, updated_at
            ) values (
              ${scenario.uploadAttemptIds[attemptIndex]}::uuid, ${scenario.uploadAttemptPublicIds[attemptIndex]},
              ${scenario.uploadIntentId}::uuid, ${attemptIndex + 1}, ${status},
              ${status === "completed" ? sizeBytes : status === "paused" ? Math.floor(sizeBytes / 2) : 0},
              ${status === "expired" ? demoTime(anchor, -1) : demoTime(anchor, 365)}::timestamptz,
              ${addHours(scenario.createdAt, attemptIndex + 1)}::timestamptz,
              ${terminal ? addHours(scenario.createdAt, attemptIndex + 2) : null}::timestamptz,
              ${status === "failed" ? "demo_fixture_network_failure" : null},
              ${addHours(scenario.createdAt, attemptIndex + 1)}::timestamptz,
              ${addHours(scenario.createdAt, attemptIndex + 1)}::timestamptz
            )
          `;
        }

        if (scenario.videoAssetId && scenario.storedObjectId && scenario.assetFileId && scenario.uploadIntentId) {
          const videoAssetStatus = scenario.videoAssetStatus;
          if (!videoAssetStatus) throw new Error(`Demo video asset state missing: ${scenario.key}`);
          await transaction`
            insert into egocapture.stored_objects (
              id, upload_intent_id, provider, bucket, object_key, size_bytes, etag,
              verified_at, created_at, deleted_at, delete_reason
            ) values (
              ${scenario.storedObjectId}::uuid, ${scenario.uploadIntentId}::uuid, 'supabase',
              'egocapture-raw', ${objectKey}, ${sizeBytes}, ${fingerprint(`etag/${scenario.key}`)},
              ${addHours(scenario.createdAt, 4)}::timestamptz, ${addHours(scenario.createdAt, 4)}::timestamptz,
              ${addHours(scenario.createdAt, 5)}::timestamptz, 'demo_fixture_no_media_object'
            )
          `;
          await transaction`
            insert into egocapture.video_assets (
              id, public_id, upload_intent_id, participant_id, status, is_fixture, created_at, updated_at
            ) values (
              ${scenario.videoAssetId}::uuid, ${scenario.videoAssetPublicId}, ${scenario.uploadIntentId}::uuid,
              ${person.id}::uuid, ${videoAssetStatus}, true,
              ${addHours(scenario.createdAt, 4)}::timestamptz, ${addHours(scenario.createdAt, 4)}::timestamptz
            )
          `;
          await transaction`
            insert into egocapture.asset_files (id, video_asset_id, stored_object_id, file_role, created_at)
            values (
              ${scenario.assetFileId}::uuid, ${scenario.videoAssetId}::uuid,
              ${scenario.storedObjectId}::uuid, 'source', ${addHours(scenario.createdAt, 4)}::timestamptz
            )
          `;
        }

        if (scenario.metadataAttemptId && scenario.videoAssetId) {
          const metadataAttemptStatus = scenario.metadataAttemptStatus;
          if (!metadataAttemptStatus) throw new Error(`Demo metadata attempt state missing: ${scenario.key}`);
          await transaction`
            insert into egocapture.metadata_attempts (
              id, video_asset_id, attempt_number, parser_name, parser_version, status,
              range_request_count, bytes_read, started_at, completed_at, error_code, created_at
            ) values (
              ${scenario.metadataAttemptId}::uuid, ${scenario.videoAssetId}::uuid, 1,
              'demo_fixture_parser', '1.0', ${metadataAttemptStatus}, 2, 1024,
              ${addHours(scenario.createdAt, 5)}::timestamptz, ${addHours(scenario.createdAt, 6)}::timestamptz,
              ${metadataAttemptStatus === "failed" ? "demo_fixture_metadata_failure" : null},
              ${addHours(scenario.createdAt, 5)}::timestamptz
            )
          `;
        }

        if (scenario.fileMetadataId && scenario.videoAssetId && scenario.metadataEvidenceId) {
          const mismatch = scenario.kind === "device_mismatch";
          await transaction`
            insert into egocapture.video_file_metadata (
              id, video_asset_id, parser_name, parser_version, container_format,
              duration_ms, file_size_bytes, video_codec, width, height, frame_rate,
              capture_time_source, capture_time_confidence, camera_manufacturer,
              camera_model, gps_metadata_present, is_360, device_consistency, extracted_at
            ) values (
              ${scenario.fileMetadataId}::uuid, ${scenario.videoAssetId}::uuid,
              'demo_fixture_parser', '1.0', 'MPEG-4', 600000, ${sizeBytes}, 'AVC',
              1920, 1080, 30, 'container', 'high',
              ${mismatch ? "GoPro" : device?.manufacturer ?? "Unknown"},
              ${mismatch ? "HERO12 Black" : device?.model ?? "Unknown"}, false, false,
              ${mismatch ? "model_mismatch" : scenario.metadataAttemptStatus === "partial" ? "partial_match" : "matched"},
              ${addHours(scenario.createdAt, 6)}::timestamptz
            )
          `;
          await transaction`
            insert into egocapture.metadata_evidence (
              id, video_asset_id, field_name, normalized_value, parser_name, source, created_at
            ) values (
              ${scenario.metadataEvidenceId}::uuid, ${scenario.videoAssetId}::uuid, 'camera_model',
              ${transaction.json({ value: mismatch ? "HERO12 Black" : device?.model ?? "Unknown", fixture: true })},
              'demo_fixture_parser', 'fixture metadata; no media bytes included',
              ${addHours(scenario.createdAt, 6)}::timestamptz
            )
          `;
        }

        if (scenario.matchDecisionId && scenario.videoAssetId) {
          const isHealthy = scenario.kind === "healthy";
          const isClaim = scenario.kind === "pending_review";
          await transaction`
            insert into egocapture.match_decisions (
              id, video_asset_id, claimed_session_id, resolved_session_id, resolved_device_id,
              decision_type, reason, decided_by, decided_at, created_at
            ) values (
              ${scenario.matchDecisionId}::uuid, ${scenario.videoAssetId}::uuid,
              ${isHealthy || isClaim ? scenario.sessionId : null}::uuid,
              ${isHealthy || isClaim ? scenario.sessionId : null}::uuid,
              ${isHealthy || isClaim ? device?.id ?? null : null}::uuid,
              ${isHealthy ? "admin_confirmed" : isClaim ? "participant_claim" : "unmatched"},
              ${isHealthy ? "Demo administrator confirmed session and device match." : null},
              ${isClaim && person.profileId ? person.profileId : catalog.admin.profileId}::uuid,
              ${addHours(scenario.createdAt, 7)}::timestamptz, ${addHours(scenario.createdAt, 7)}::timestamptz
            )
          `;
        }

        if (scenario.reviewId) {
          const reviewStatus = scenario.reviewStatus;
          if (!reviewStatus) throw new Error(`Demo review state missing: ${scenario.key}`);
          const caseType = scenario.kind === "missing_upload" ? "missing"
            : scenario.kind === "device_mismatch" ? "device_mismatch"
              : scenario.kind === "failed_retry" || scenario.transferStatus === "failed" ? "upload_failed"
                : scenario.metadataStatus === "failed" ? "metadata_failed" : "needs_review";
          const terminal = reviewStatus === "resolved" || reviewStatus === "dismissed";
          await transaction`
            insert into egocapture.review_cases (
              id, public_id, video_asset_id, assignment_id, upload_intent_id,
              case_type, status, reason, resolution_reason, is_fixture,
              created_at, updated_at, resolved_at
            ) values (
              ${scenario.reviewId}::uuid, ${scenario.reviewPublicId}, ${scenario.videoAssetId}::uuid,
              ${scenario.assignmentId}::uuid, ${scenario.uploadIntentId}::uuid,
              ${caseType}, ${reviewStatus}, ${`Demo ${scenario.kind} review fixture.`},
              ${terminal ? "Demo review fixture reached its terminal state." : null}, true,
              ${addHours(scenario.createdAt, 8)}::timestamptz, ${addHours(scenario.createdAt, 8)}::timestamptz,
              ${terminal ? addHours(scenario.createdAt, 9) : null}::timestamptz
            )
          `;
        }

        await transaction`
          insert into egocapture.audit_events (
            id, actor_profile_id, actor_auth_user_id, action, entity_type,
            entity_public_id, reason, request_id, after_values, metadata, created_at
          ) values (
            ${scenario.auditEventId}::uuid, ${catalog.admin.profileId}::uuid, ${adminUser.id}::uuid,
            'demo.seed.scenario', 'assignment', ${scenario.assignmentPublicId},
            'Deterministic demonstration fixture creation.', ${scenario.auditRequestId}::uuid,
            ${transaction.json({ status: scenario.assignmentStatus })},
            ${transaction.json({ fixture: true, scenarioKey: scenario.key, anchor })},
            ${addHours(scenario.createdAt, 10)}::timestamptz
          )
        `;
      }

      if (scenarios.size !== catalog.scenarios.length) throw new Error("Demo scenario identities are not unique");
    });

    return {
      anchor: catalog.anchor,
      participants: catalog.people.length,
      participantLogins: participantUsers.size,
      tasks: catalog.tasks.length,
      scenarios: catalog.scenarios.length,
    };
  } catch (error) {
    if (error instanceof Error && /duplicate key|violates.*constraint/i.test(error.message)) {
      throw new Error(`HOLD: deterministic fixture identity collision (${error.message})`, { cause: error });
    }
    throw error;
  } finally {
    await db.end({ timeout: 2 });
  }
}

async function main() {
  const anchor = argumentValue("--anchor") ?? process.env.DEMO_SEED_ANCHOR ?? DEMO_SEED_ANCHOR;
  const result = await seedDemoData(integrationEnvironment(), anchor);
  console.log(
    `Demo seed complete: anchor=${result.anchor}; participants=${result.participants}; participant_logins=${result.participantLogins}; tasks=${result.tasks}; scenarios=${result.scenarios}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? `EgoCapture seed: ${error.message}` : error);
    process.exitCode = 1;
  });
}
