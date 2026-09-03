import { createHash } from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { taskContentHash, taskInstructionsSchema } from "@egocapture/core/domain/task-instructions";
import postgres from "postgres";
import { assert, integrationEnvironment } from "@/scripts/check-support";
import {
  DEMO_STORAGE_BUCKET,
  EGOCAPTURE_BUSINESS_TABLES,
} from "@/scripts/demo-refresh-guard";
import {
  buildDemoCatalog,
  DEMO_SEED_ANCHOR,
  type DemoCatalog,
} from "@/scripts/fixtures/demo-catalog";

type IntegrationEnvironment = ReturnType<typeof integrationEnvironment>;
type Distribution = Record<string, number>;

const RLS_PROTECTED_TABLES = [...EGOCAPTURE_BUSINESS_TABLES, "state_machine_transitions"] as const;

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

export function canonicalDemoDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex");
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function distribution(values: readonly string[]): Distribution {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]),
  );
}

export function distributionFromEntries(entries: readonly (readonly [string, number])[]): Distribution {
  return Object.fromEntries(entries);
}

function normalizedEqual(actual: unknown, expected: unknown, message: string) {
  assert(JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected)), message);
}

function expectedCounts(catalog: DemoCatalog) {
  return {
    profiles: 1 + catalog.people.filter((person) => person.login).length,
    participants: catalog.people.length,
    participantLoginCredentials: catalog.people.filter((person) => person.login).length,
    consentRecords: catalog.people.filter((person) => person.consentStatus !== "pending").length,
    participantInvitations: catalog.people.filter((person) => person.status === "invited").length,
    devices: catalog.devices.length,
    deviceAssignments: catalog.devices.length,
    tasks: catalog.tasks.length,
    taskVersions: catalog.tasks.filter((task) => task.versionId).length,
    taskParticipantPlans: catalog.scenarios.length + 1,
    assignments: catalog.scenarios.length,
    recordingSessions: catalog.scenarios.filter((scenario) => scenario.sessionId).length,
    uploadBatches: catalog.scenarios.filter((scenario) => scenario.uploadBatchId).length,
    uploadIntents: catalog.scenarios.filter((scenario) => scenario.uploadIntentId).length,
    uploadAttempts: catalog.scenarios.reduce((count, scenario) => count + scenario.uploadAttemptIds.length, 0),
    storedObjects: catalog.scenarios.filter((scenario) => scenario.storedObjectId).length,
    videoAssets: catalog.scenarios.filter((scenario) => scenario.videoAssetId).length,
    assetFiles: catalog.scenarios.filter((scenario) => scenario.assetFileId).length,
    videoFileMetadata: catalog.scenarios.filter((scenario) => scenario.fileMetadataId).length,
    metadataEvidence: catalog.scenarios.filter((scenario) => scenario.metadataEvidenceId).length,
    metadataAttempts: catalog.scenarios.filter((scenario) => scenario.metadataAttemptId).length,
    matchDecisions: catalog.scenarios.filter((scenario) => scenario.matchDecisionId).length,
    reviewCases: catalog.scenarios.filter((scenario) => scenario.reviewId).length,
    auditEvents: catalog.scenarios.length,
  };
}

export async function verifyDemoSeed(
  env: IntegrationEnvironment,
  anchor = DEMO_SEED_ANCHOR,
): Promise<{ anchor: string; counts: ReturnType<typeof expectedCounts>; digest: string }> {
  const catalog = buildDemoCatalog(anchor);
  const expected = expectedCounts(catalog);
  const db = postgres(env.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 2,
    transform: postgres.camel,
  });

  try {
    const [counts] = await db<ReturnType<typeof expectedCounts>[]>`
      select
        (select count(*)::integer from egocapture.profiles) as profiles,
        (select count(*)::integer from egocapture.participants) as participants,
        (select count(*)::integer from egocapture.participant_login_credentials) as participant_login_credentials,
        (select count(*)::integer from egocapture.consent_records) as consent_records,
        (select count(*)::integer from egocapture.participant_invitations) as participant_invitations,
        (select count(*)::integer from egocapture.devices) as devices,
        (select count(*)::integer from egocapture.device_assignments) as device_assignments,
        (select count(*)::integer from egocapture.tasks) as tasks,
        (select count(*)::integer from egocapture.task_versions) as task_versions,
        (select count(*)::integer from egocapture.task_participant_plans) as task_participant_plans,
        (select count(*)::integer from egocapture.assignments) as assignments,
        (select count(*)::integer from egocapture.recording_sessions) as recording_sessions,
        (select count(*)::integer from egocapture.upload_batches) as upload_batches,
        (select count(*)::integer from egocapture.upload_intents) as upload_intents,
        (select count(*)::integer from egocapture.upload_attempts) as upload_attempts,
        (select count(*)::integer from egocapture.stored_objects) as stored_objects,
        (select count(*)::integer from egocapture.video_assets) as video_assets,
        (select count(*)::integer from egocapture.asset_files) as asset_files,
        (select count(*)::integer from egocapture.video_file_metadata) as video_file_metadata,
        (select count(*)::integer from egocapture.metadata_evidence) as metadata_evidence,
        (select count(*)::integer from egocapture.metadata_attempts) as metadata_attempts,
        (select count(*)::integer from egocapture.match_decisions) as match_decisions,
        (select count(*)::integer from egocapture.review_cases) as review_cases,
        (select count(*)::integer from egocapture.audit_events) as audit_events
    `;
    normalizedEqual(counts, expected, "Demo graph counts do not match the deterministic catalog");

    const countryCounts = await db<{ countryCode: string; count: number }[]>`
      select country_region as country_code, count(*)::integer
      from egocapture.participants
      group by country_region
      order by country_region
    `;
    normalizedEqual(countryCounts, [
      { countryCode: "CN", count: 6 },
      { countryCode: "JP", count: 6 },
      { countryCode: "US", count: 6 },
    ], "Demo participants must contain exactly six people per country");

    const [auth] = await db<{
      linkedProfiles: number;
      markedUsers: number;
      authUsers: number;
      nonFixtureUsers: number;
      nonReservedEmailUsers: number;
      participantProfiles: number;
      adminProfiles: number;
      credentialRows: number;
      credentialPasswordMatches: number;
      credentialSyncMatches: number;
      authenticatedCanReadCredentials: boolean;
      anonCanReadCredentials: boolean;
    }[]>`
      select
        (select count(*)::integer from auth.users) as auth_users,
        (select count(*)::integer from auth.users
          where raw_user_meta_data ->> 'egocapture_fixture' is distinct from 'true') as non_fixture_users,
        (select count(*)::integer from auth.users
          where email is null or split_part(lower(email), '@', 2) not like '%.invalid') as non_reserved_email_users,
        (select count(*)::integer from egocapture.profiles profile join auth.users auth_user on auth_user.id = profile.auth_user_id) as linked_profiles,
        (select count(*)::integer
          from egocapture.profiles profile
          join auth.users auth_user on auth_user.id = profile.auth_user_id
          where auth_user.raw_user_meta_data ->> 'egocapture_fixture' = 'true'
            and auth_user.raw_user_meta_data ->> 'egocapture_catalog_key' is not null) as marked_users,
        (select count(*)::integer from egocapture.profiles where role = 'participant') as participant_profiles,
        (select count(*)::integer from egocapture.profiles where role = 'admin' and is_demo_admin) as admin_profiles,
        (select count(*)::integer from egocapture.participant_login_credentials) as credential_rows,
        (select count(*)::integer from egocapture.participant_login_credentials where password = ${env.demoParticipantPassword}) as credential_password_matches,
        (select count(*)::integer from egocapture.participant_login_credentials where synced_at >= updated_at) as credential_sync_matches,
        has_table_privilege('authenticated', 'egocapture.participant_login_credentials', 'select') as authenticated_can_read_credentials,
        has_table_privilege('anon', 'egocapture.participant_login_credentials', 'select') as anon_can_read_credentials
    `;
    assert(auth.authUsers === 4 && auth.nonFixtureUsers === 0 && auth.nonReservedEmailUsers === 0, "Dedicated Auth must contain exactly four marked .invalid demo users");
    assert(auth.linkedProfiles === 4 && auth.markedUsers === 4, "All four demo profiles must link to marked Auth users");
    assert(auth.participantProfiles === 3 && auth.adminProfiles === 1, "Demo Auth roles must be three Participants and one Admin");
    assert(auth.credentialRows === 3 && auth.credentialPasswordMatches === 3 && auth.credentialSyncMatches === 3, "Participant credentials are not synchronized with the env-only demo password");
    assert(!auth.authenticatedCanReadCredentials && !auth.anonCanReadCredentials, "Browser roles must not read participant credentials");
    const credentialParticipants = await db<{ participantId: string }[]>`
      select participant_id::text from egocapture.participant_login_credentials order by participant_id
    `;
    normalizedEqual(
      credentialParticipants.map((row) => row.participantId),
      catalog.people.filter((person) => person.login).map((person) => person.id).sort(),
      "Participant credential identities do not match the three locale login fixtures",
    );

    const [legacy] = await db<{ legacyRows: number }[]>`
      select (
        (select count(*) from egocapture.participants
          where display_alias = 'Participant Demo' or country_region = 'Demo Region')
        + (select count(*) from egocapture.devices
          where manufacturer = 'Synthetic' or model = 'Demo Phone')
      )::integer as legacy_rows
    `;
    assert(legacy.legacyRows === 0, "Legacy placeholder names, regions, or devices remain in the demo graph");

    type DistributionEntries = [string, number][];
    const [stateEntries] = await db<{
      participantStatuses: DistributionEntries;
      consentStatuses: DistributionEntries;
      deviceStatuses: DistributionEntries;
      taskLifecycles: DistributionEntries;
      assignmentStatuses: DistributionEntries;
      sessionStatuses: DistributionEntries;
      uploadBatchStatuses: DistributionEntries;
      transferStatuses: DistributionEntries;
      metadataStatuses: DistributionEntries;
      uploadAttemptStatuses: DistributionEntries;
      assetStatuses: DistributionEntries;
      metadataAttemptStatuses: DistributionEntries;
      reviewStatuses: DistributionEntries;
    }[]>`
      select
        (select jsonb_agg(jsonb_build_array(status, count) order by status) from (select status, count(*)::integer from egocapture.participants group by status) grouped) as participant_statuses,
        (select jsonb_agg(jsonb_build_array(consent_status, count) order by consent_status) from (select consent_status, count(*)::integer from egocapture.participants group by consent_status) grouped) as consent_statuses,
        (select jsonb_agg(jsonb_build_array(status, count) order by status) from (select status, count(*)::integer from egocapture.devices group by status) grouped) as device_statuses,
        (select jsonb_agg(jsonb_build_array(lifecycle, count) order by lifecycle) from (select lifecycle, count(*)::integer from egocapture.tasks group by lifecycle) grouped) as task_lifecycles,
        (select jsonb_agg(jsonb_build_array(status, count) order by status) from (select status, count(*)::integer from egocapture.assignments group by status) grouped) as assignment_statuses,
        (select jsonb_agg(jsonb_build_array(status, count) order by status) from (select status, count(*)::integer from egocapture.recording_sessions group by status) grouped) as session_statuses,
        (select jsonb_agg(jsonb_build_array(status, count) order by status) from (select status, count(*)::integer from egocapture.upload_batches group by status) grouped) as upload_batch_statuses,
        (select jsonb_agg(jsonb_build_array(transfer_status, count) order by transfer_status) from (select transfer_status, count(*)::integer from egocapture.upload_intents group by transfer_status) grouped) as transfer_statuses,
        (select jsonb_agg(jsonb_build_array(metadata_status, count) order by metadata_status) from (select metadata_status, count(*)::integer from egocapture.upload_intents group by metadata_status) grouped) as metadata_statuses,
        (select jsonb_agg(jsonb_build_array(status, count) order by status) from (select status, count(*)::integer from egocapture.upload_attempts group by status) grouped) as upload_attempt_statuses,
        (select jsonb_agg(jsonb_build_array(status, count) order by status) from (select status, count(*)::integer from egocapture.video_assets group by status) grouped) as asset_statuses,
        (select jsonb_agg(jsonb_build_array(status, count) order by status) from (select status, count(*)::integer from egocapture.metadata_attempts group by status) grouped) as metadata_attempt_statuses,
        (select jsonb_agg(jsonb_build_array(status, count) order by status) from (select status, count(*)::integer from egocapture.review_cases group by status) grouped) as review_statuses
    `;
    const states = Object.fromEntries(
      Object.entries(stateEntries).map(([key, entries]) => [key, distributionFromEntries(entries)]),
    );
    normalizedEqual(states, {
      participantStatuses: distribution(catalog.people.map((person) => person.status)),
      consentStatuses: distribution(catalog.people.map((person) => person.consentStatus)),
      deviceStatuses: distribution(catalog.devices.map((device) => device.status)),
      taskLifecycles: distribution(catalog.tasks.map((task) => task.lifecycle)),
      assignmentStatuses: distribution(catalog.scenarios.map((scenario) => scenario.assignmentStatus)),
      sessionStatuses: distribution(catalog.scenarios.flatMap((scenario) => scenario.sessionStatus ? [scenario.sessionStatus] : [])),
      uploadBatchStatuses: distribution(catalog.scenarios.flatMap((scenario) => scenario.uploadBatchStatus ? [scenario.uploadBatchStatus] : [])),
      transferStatuses: distribution(catalog.scenarios.flatMap((scenario) => scenario.transferStatus ? [scenario.transferStatus] : [])),
      metadataStatuses: distribution(catalog.scenarios.flatMap((scenario) => scenario.metadataStatus ? [scenario.metadataStatus] : [])),
      uploadAttemptStatuses: distribution(catalog.scenarios.flatMap((scenario) => scenario.uploadAttemptStatuses ?? [])),
      assetStatuses: distribution(catalog.scenarios.flatMap((scenario) => scenario.videoAssetStatus ? [scenario.videoAssetStatus] : [])),
      metadataAttemptStatuses: distribution(catalog.scenarios.flatMap((scenario) => scenario.metadataAttemptStatus ? [scenario.metadataAttemptStatus] : [])),
      reviewStatuses: distribution(catalog.scenarios.flatMap((scenario) => scenario.reviewStatus ? [scenario.reviewStatus] : [])),
    }, "Lifecycle state distributions do not match the catalog");

    const [integrity] = await db<{
      invalidAssignmentAuthority: number;
      invalidSessionAuthority: number;
      invalidUploadAuthority: number;
      invalidAssetAuthority: number;
      invalidReviewState: number;
      assetsWithoutOneCurrentDecision: number;
      activeFixtureStoredObjects: number;
      storageObjects: number;
    }[]>`
      select
        (select count(*)::integer
          from egocapture.assignments assignment
          left join egocapture.task_versions version on version.id = assignment.task_version_id
          where version.id is null or assignment.task_id <> version.task_id) as invalid_assignment_authority,
        (select count(*)::integer
          from egocapture.recording_sessions session
          left join egocapture.assignments assignment on assignment.id = session.assignment_id
          where assignment.id is null or session.participant_id <> assignment.participant_id
            or session.task_version_id <> assignment.task_version_id) as invalid_session_authority,
        (select count(*)::integer
          from egocapture.upload_intents intent
          left join egocapture.upload_batches batch on batch.id = intent.batch_id
          where batch.id is null or intent.participant_id <> batch.participant_id) as invalid_upload_authority,
        (select count(*)::integer
          from egocapture.video_assets asset
          left join egocapture.upload_intents intent on intent.id = asset.upload_intent_id
          where intent.id is null or asset.participant_id <> intent.participant_id) as invalid_asset_authority,
        (select count(*)::integer from egocapture.review_cases
          where (status in ('resolved', 'dismissed')) <> (resolved_at is not null and resolution_reason is not null)) as invalid_review_state,
        (select count(*)::integer
          from egocapture.video_assets asset
          where (select count(*) from egocapture.match_decisions decision
            where decision.video_asset_id = asset.id and decision.superseded_by is null) <> 1) as assets_without_one_current_decision,
        (select count(*)::integer from egocapture.stored_objects where deleted_at is null) as active_fixture_stored_objects,
        (select count(*)::integer
          from storage.objects object
          where object.bucket_id = ${DEMO_STORAGE_BUCKET}) as storage_objects
    `;
    assert(Object.values(integrity).every((count) => count === 0), `Demo graph integrity failure: ${JSON.stringify(integrity)}`);

    const rls = await db<{ tableName: string; enabled: boolean }[]>`
      select expected.table_name,
        coalesce(relation.relrowsecurity, false) as enabled
      from unnest(${[...RLS_PROTECTED_TABLES]}::text[]) expected(table_name)
      left join pg_namespace namespace on namespace.nspname = 'egocapture'
      left join pg_class relation on relation.relnamespace = namespace.oid
        and relation.relname = expected.table_name and relation.relkind = 'r'
      order by expected.table_name
    `;
    assert(rls.length === RLS_PROTECTED_TABLES.length && rls.every((table) => table.enabled), "Every demo business or state registry table must exist with RLS enabled");

    const versions = await db<{
      id: string;
      taskId: string;
      contentHash: string;
      instructions: unknown;
      publishedAt: Date;
    }[]>`
      select id::text, task_id::text, content_hash, instructions, published_at
      from egocapture.task_versions
      order by id
    `;
    for (const version of versions) {
      const instructions = taskInstructionsSchema.parse(version.instructions);
      assert(taskContentHash(instructions) === version.contentHash, `TaskVersion content hash mismatch: ${version.id}`);
      const task = catalog.tasks.find((candidate) => candidate.versionId === version.id);
      assert(task?.id === version.taskId && task.publishedAt === iso(version.publishedAt), `TaskVersion identity or timestamp drift: ${version.id}`);
    }

    const profiles = await db<{
      id: string;
      role: string;
      displayName: string;
      isDemoAdmin: boolean;
    }[]>`
      select id::text, role, display_name, is_demo_admin
      from egocapture.profiles order by id
    `;
    const expectedProfiles = [
      { id: catalog.admin.profileId, role: "admin", displayName: catalog.admin.displayName, isDemoAdmin: true },
      ...catalog.people.filter((person) => person.login).map((person) => ({
        id: person.profileId!, role: "participant", displayName: person.displayAlias, isDemoAdmin: false,
      })),
    ].sort((left, right) => left.id.localeCompare(right.id));
    normalizedEqual(profiles, expectedProfiles, "Profile identities or roles drifted from the deterministic catalog");

    const participants = await db<{
      id: string;
      publicId: string;
      displayAlias: string;
      locale: string;
      timezone: string;
      countryRegion: string;
      status: string;
      consentStatus: string;
      createdAt: Date;
      withdrawnAt: Date | null;
    }[]>`
      select id::text, public_id, display_alias, locale, timezone, country_region,
        status, consent_status, created_at, withdrawn_at
      from egocapture.participants order by id
    `;
    const participantProjection = participants.map((person) => ({ ...person, createdAt: iso(person.createdAt), withdrawnAt: iso(person.withdrawnAt) }));
    const expectedParticipants = catalog.people.map((person) => ({
      id: person.id,
      publicId: person.publicId,
      displayAlias: person.displayAlias,
      locale: person.region.locale,
      timezone: person.region.timezone,
      countryRegion: person.region.countryCode,
      status: person.status,
      consentStatus: person.consentStatus,
      createdAt: person.createdAt,
      withdrawnAt: person.withdrawnAt,
    })).sort((left, right) => left.id.localeCompare(right.id));
    normalizedEqual(participantProjection, expectedParticipants, "Participant identity, region, state, or anchor timestamp drift");

    const tasks = await db<{
      id: string;
      publicId: string;
      lifecycle: string;
      title: string;
      instructions: unknown;
      createdAt: Date;
    }[]>`
      select id::text, public_id, lifecycle, title, draft_instructions as instructions, created_at
      from egocapture.tasks order by id
    `;
    const taskProjection = tasks.map((task) => ({ ...task, createdAt: iso(task.createdAt) }));
    const expectedTasks = catalog.tasks.map((task) => ({
      id: task.id,
      publicId: task.publicId,
      lifecycle: task.lifecycle,
      title: task.instructions.title,
      instructions: task.instructions,
      createdAt: task.createdAt,
    })).sort((left, right) => left.id.localeCompare(right.id));
    normalizedEqual(taskProjection, expectedTasks, "Task identity, localized content, lifecycle, or anchor timestamp drift");
    const assignments = await db<{
      id: string;
      publicId: string;
      participantId: string;
      taskId: string;
      status: string;
      locale: string;
      dueAt: Date;
      createdAt: Date;
    }[]>`
      select id::text, public_id, participant_id::text, task_id::text, status, locale, due_at, created_at
      from egocapture.assignments order by id
    `;
    for (const assignment of assignments) {
      const scenario = catalog.scenarios.find((candidate) => candidate.assignmentId === assignment.id);
      assert(scenario, `Unknown assignment identity: ${assignment.id}`);
      const person = catalog.people.find((candidate) => candidate.key === scenario.participantKey);
      const task = catalog.tasks.find((candidate) => candidate.key === scenario.taskKey);
      assert(scenario?.assignmentPublicId === assignment.publicId, `Assignment public identity drift: ${assignment.id}`);
      assert(
        person?.id === assignment.participantId
          && task?.id === assignment.taskId
          && person.region.locale === assignment.locale
          && scenario.assignmentStatus === assignment.status
          && scenario.dueAt === iso(assignment.dueAt)
          && scenario.createdAt === iso(assignment.createdAt),
        `Assignment authority, state, locale, or anchor timestamp drift: ${assignment.id}`,
      );
    }

    const sessions = await db`select id::text, public_id, assignment_id::text, participant_id::text, task_version_id::text, declared_device_id::text, timezone, status, created_at, closed_at from egocapture.recording_sessions order by id`;
    const uploads = await db`select id::text, public_id, batch_id::text, participant_id::text, object_key, transfer_status, metadata_status, expected_expires_at, created_at from egocapture.upload_intents order by id`;
    const attempts = await db`select id::text, public_id, upload_intent_id::text, attempt_number, status, bytes_uploaded::text, expires_at, started_at, completed_at from egocapture.upload_attempts order by id`;
    const assets = await db`select id::text, public_id, upload_intent_id::text, participant_id::text, status, is_fixture, created_at from egocapture.video_assets order by id`;
    const reviews = await db`select id::text, public_id, video_asset_id::text, assignment_id::text, upload_intent_id::text, case_type, status, reason, resolution_reason, is_fixture, created_at, resolved_at from egocapture.review_cases order by id`;
    const decisions = await db`select id::text, video_asset_id::text, claimed_session_id::text, resolved_session_id::text, resolved_device_id::text, decision_type, reason, supersedes_decision_id::text, superseded_by::text, decided_at from egocapture.match_decisions order by id`;
    const devices = await db<{
      id: string;
      publicId: string;
      manufacturer: string;
      model: string;
      deviceType: string;
      firmwareVersion: string;
      status: string;
      isFixture: boolean;
      createdAt: Date;
      retiredAt: Date | null;
    }[]>`select id::text, public_id, manufacturer, model, device_type, firmware_version, status, is_fixture, created_at, retired_at from egocapture.devices order by id`;
    const deviceProjection = devices.map((device) => ({ ...device, createdAt: iso(device.createdAt), retiredAt: iso(device.retiredAt) }));
    const expectedDevices = catalog.devices.map((device) => ({
      id: device.id,
      publicId: device.publicId,
      manufacturer: device.manufacturer,
      model: device.model,
      deviceType: device.deviceType,
      firmwareVersion: device.firmwareVersion,
      status: device.status,
      isFixture: true,
      createdAt: device.assignedAt,
      retiredAt: device.endedAt,
    })).sort((left, right) => left.id.localeCompare(right.id));
    normalizedEqual(deviceProjection, expectedDevices, "Device identity, model, state, or anchor timestamp drift");

    const digestPayload = {
      anchor,
      counts,
      profiles,
      participants: participantProjection,
      devices: deviceProjection,
      tasks: taskProjection,
      versions,
      assignments,
      sessions,
      uploads,
      attempts,
      assets,
      reviews,
      decisions,
    };
    return { anchor, counts, digest: canonicalDemoDigest(digestPayload) };
  } finally {
    await db.end({ timeout: 2 });
  }
}

async function main() {
  const anchor = argumentValue("--anchor") ?? process.env.DEMO_SEED_ANCHOR ?? DEMO_SEED_ANCHOR;
  const report = await verifyDemoSeed(integrationEnvironment(), anchor);
  console.log(`Demo seed verified: anchor=${report.anchor}; digest=${report.digest}; counts=${JSON.stringify(report.counts)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? `EgoCapture seed check: ${error.message}` : error);
    process.exitCode = 1;
  });
}
