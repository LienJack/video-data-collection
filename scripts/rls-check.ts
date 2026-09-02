import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";
import { createPublicId } from "@egocapture/core/domain/public-id";

class RollbackCheck extends Error {}

function parseEnv(text: string): Record<string, string> {
  return Object.fromEntries(
    text.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
  );
}

function readEnv(file: string): Record<string, string> {
  try { return parseEnv(readFileSync(file, "utf8")); } catch { return {}; }
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const root = process.cwd();
  const local = readEnv(path.join(root, ".env.development.local"));
  const profile = local.EGOCAPTURE_DEV_PROFILE || "local";
  const runtime = readEnv(path.join(root, ".runtime", profile, "app.env"));
  if (!runtime.DATABASE_URL) throw new Error("缺少 DATABASE_URL");
  return runtime.DATABASE_URL;
}

function assertEqual(actual: number, expected: number, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

async function main() {
  const db = postgres(databaseUrl(), { max: 1, connect_timeout: 8, prepare: false });
  const adminA = randomUUID();
  const adminB = randomUUID();
  const participantUser = randomUUID();
  const adminProfileA = randomUUID();
  const adminProfileB = randomUUID();
  const participantProfile = randomUUID();
  const participantA = randomUUID();
  const participantB = randomUUID();
  const taskA = randomUUID();
  const taskB = randomUUID();
  const taskVersionA = randomUUID();
  const taskVersionB = randomUUID();
  const participantPublicA = createPublicId("PT");
  const participantPublicB = createPublicId("PT");
  const forbiddenParticipantPublicId = createPublicId("PT");
  const taskPublicA = createPublicId("TSK");
  const taskPublicB = createPublicId("TSK");
  const assignmentPublicId = createPublicId("AS");
  try {
    const [rlsState] = await db<{ disabled: number }[]>`
      select count(*)::integer as disabled
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'egocapture'
        and relation.relkind in ('r', 'p')
        and relation.relname <> 'schema_migrations'
        and not relation.relrowsecurity
    `;
    assertEqual(rlsState.disabled, 0, "Every business table has RLS enabled");
    const [bucket] = await db<{ public: boolean; fileSizeLimit: number; mimeCount: number }[]>`
      select public, file_size_limit::integer as "fileSizeLimit",
        cardinality(allowed_mime_types)::integer as "mimeCount"
      from storage.buckets where id = 'egocapture-raw'
    `;
    if (!bucket) throw new Error("egocapture-raw private bucket is missing");
    assertEqual(Number(bucket.public), 0, "Storage bucket remains private");
    assertEqual(bucket.fileSizeLimit, 50_000_000, "Storage bucket size limit");
    assertEqual(bucket.mimeCount, 3, "Storage bucket MIME allowlist");

    await db.begin(async (transaction) => {
      await transaction`
        insert into auth.users (id, aud, role, email, created_at, updated_at)
        values
          (${adminA}::uuid, 'authenticated', 'authenticated', ${`${adminA}@rls.invalid`}, now(), now()),
          (${adminB}::uuid, 'authenticated', 'authenticated', ${`${adminB}@rls.invalid`}, now(), now()),
          (${participantUser}::uuid, 'authenticated', 'authenticated', ${`${participantUser}@rls.invalid`}, now(), now())
      `;
      await transaction`
        insert into egocapture.profiles (id, auth_user_id, role, display_name)
        values
          (${adminProfileA}::uuid, ${adminA}::uuid, 'admin', 'Admin A'),
          (${adminProfileB}::uuid, ${adminB}::uuid, 'admin', 'Admin B'),
          (${participantProfile}::uuid, ${participantUser}::uuid, 'participant', 'Participant A')
      `;
      await transaction`
        insert into egocapture.participants (
          id, public_id, auth_user_id, display_alias, status, consent_status, created_by
        ) values
          (${participantA}::uuid, ${participantPublicA}, ${participantUser}::uuid, 'Participant A', 'active', 'valid', ${adminProfileA}::uuid),
          (${participantB}::uuid, ${participantPublicB}, null, 'Participant B', 'draft', 'pending', ${adminProfileB}::uuid)
      `;
      await transaction`
        insert into egocapture.tasks (id, public_id, title, draft_instructions, created_by)
        values
          (${taskA}::uuid, ${taskPublicA}, 'Assigned Task', '{}'::jsonb, ${adminProfileA}::uuid),
          (${taskB}::uuid, ${taskPublicB}, 'Unassigned Task', '{}'::jsonb, ${adminProfileB}::uuid)
      `;
      await transaction`
        insert into egocapture.task_versions (
          id, task_id, version, instructions, content_hash, published_by
        ) values
          (${taskVersionA}::uuid, ${taskA}::uuid, 1, '{}'::jsonb, ${"a".repeat(64)}, ${adminProfileA}::uuid),
          (${taskVersionB}::uuid, ${taskB}::uuid, 1, '{}'::jsonb, ${"b".repeat(64)}, ${adminProfileB}::uuid)
      `;
      await transaction`
        insert into egocapture.assignments (
          public_id, participant_id, task_version_id, due_at, locale, created_by
        ) values (
          ${assignmentPublicId}, ${participantA}::uuid, ${taskVersionA}::uuid,
          now() + interval '1 day', 'zh-CN', ${adminProfileA}::uuid
        )
      `;
      await transaction`
        insert into egocapture.audit_events (
          actor_profile_id, actor_auth_user_id, action, entity_type, entity_public_id, request_id
        ) values (
          ${adminProfileA}::uuid, ${adminA}::uuid, 'rls.check', 'participant',
          ${participantPublicA}, ${randomUUID()}::uuid
        )
      `;

      await transaction`select set_config('request.jwt.claim.sub', ${adminA}, true)`;
      await transaction.unsafe("set local role authenticated");
      const [adminParticipantCount] = await transaction<{ count: number }[]>`
        select count(*)::integer as count
        from egocapture.participants
        where id in (${participantA}::uuid, ${participantB}::uuid)
      `;
      assertEqual(adminParticipantCount.count, 2, "Admin can read all participants");
      const [adminTaskCount] = await transaction<{ count: number }[]>`
        select count(*)::integer as count
        from egocapture.tasks
        where id in (${taskA}::uuid, ${taskB}::uuid)
      `;
      assertEqual(adminTaskCount.count, 2, "Admin can read all tasks");

      let insertDenied = false;
      try {
        await transaction.savepoint(async (savepoint) => {
          await savepoint`
            insert into egocapture.participants (public_id, display_alias, status, consent_status)
            values (${forbiddenParticipantPublicId}, 'Forbidden', 'draft', 'pending')
          `;
        });
      } catch {
        insertDenied = true;
      }
      if (!insertDenied) throw new Error("Authenticated browser unexpectedly inserted participant directly");

      await transaction.unsafe("reset role");
      await transaction`select set_config('request.jwt.claim.sub', ${participantUser}, true)`;
      await transaction.unsafe("set local role authenticated");
      const [ownParticipants] = await transaction<{ count: number }[]>`
        select count(*)::integer as count from egocapture.participants
      `;
      assertEqual(ownParticipants.count, 1, "Participant can read only self");
      const [ownAssignments] = await transaction<{ count: number }[]>`
        select count(*)::integer as count from egocapture.assignments
      `;
      assertEqual(ownAssignments.count, 1, "Participant can read own assignment");
      const [assignedTasks] = await transaction<{ count: number }[]>`
        select count(*)::integer as count from egocapture.tasks
      `;
      assertEqual(assignedTasks.count, 1, "Participant can read only assigned tasks");
      const [assignedVersions] = await transaction<{ count: number }[]>`
        select count(*)::integer as count from egocapture.task_versions
      `;
      assertEqual(assignedVersions.count, 1, "Participant can read only assigned task versions");
      const [participantAudit] = await transaction<{ count: number }[]>`
        select count(*)::integer as count from egocapture.audit_events
      `;
      assertEqual(participantAudit.count, 0, "Participant cannot read audit events");

      await transaction.unsafe("reset role");
      let immutableVersion = false;
      try {
        await transaction.savepoint(async (savepoint) => {
          await savepoint`update egocapture.task_versions set version = 2 where id = ${taskVersionA}::uuid`;
        });
      } catch {
        immutableVersion = true;
      }
      if (!immutableVersion) throw new Error("TaskVersion update was not blocked");

      let immutableAudit = false;
      try {
        await transaction.savepoint(async (savepoint) => {
          await savepoint`update egocapture.audit_events set action = 'rls.changed' where entity_public_id = ${participantPublicA}`;
        });
      } catch {
        immutableAudit = true;
      }
      if (!immutableAudit) throw new Error("AuditEvent update was not blocked");
      throw new RollbackCheck();
    });
  } catch (error) {
    if (!(error instanceof RollbackCheck)) throw error;
  } finally {
    await db.end({ timeout: 2 });
  }
  console.log("RLS global admin, participant ownership, Assignment-scoped task access, direct-write denial and immutability checks passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture RLS: ${error.message}` : error);
  process.exitCode = 1;
});
