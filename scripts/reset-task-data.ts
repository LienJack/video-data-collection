import process from "node:process";
import postgres from "postgres";
import { integrationEnvironment } from "@/scripts/check-support";

const confirmation = "RESET-EGOCAPTURE-TASK-DATA";

async function main() {
  const inspectOnly = process.argv.includes("--inspect");
  if (!inspectOnly && process.env.EGOCAPTURE_RESET_TASK_DATA !== confirmation) {
    throw new Error(`HOLD: set EGOCAPTURE_RESET_TASK_DATA=${confirmation} to confirm the scoped reset`);
  }

  const env = integrationEnvironment();
  const target = new URL(env.databaseUrl);
  const db = postgres(env.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 2,
    transform: postgres.camel,
  });

  try {
    const [databaseIdentity] = await db<{
      databaseName: string;
      schemaExists: boolean;
    }[]>`
      select
        current_database() as database_name,
        to_regnamespace('egocapture') is not null as schema_exists
    `;
    if (!databaseIdentity.schemaExists) throw new Error("HOLD: egocapture schema does not exist");

    const [migrationState] = await db<{
      latestMigration: string | null;
      v2MigrationApplied: boolean;
    }[]>`
      select
        (select max(version) from egocapture.schema_migrations) as latest_migration,
        exists(select 1 from egocapture.schema_migrations where version = '0014') as v2_migration_applied
    `;
    if (!migrationState.latestMigration || Number(migrationState.latestMigration) < 13) {
      throw new Error(`HOLD: expected migration frontier 0013, found ${migrationState.latestMigration ?? "none"}`);
    }
    const [before] = await db<{
      tasks: number;
      taskVersions: number;
      assignments: number;
      sessions: number;
      uploadBatches: number;
      uploadIntents: number;
      videoAssets: number;
      reviewCases: number;
      auditEvents: number;
      commandReceipts: number;
    }[]>`
      select
        (select count(*)::integer from egocapture.tasks) as tasks,
        (select count(*)::integer from egocapture.task_versions) as task_versions,
        (select count(*)::integer from egocapture.assignments) as assignments,
        (select count(*)::integer from egocapture.recording_sessions) as sessions,
        (select count(*)::integer from egocapture.upload_batches) as upload_batches,
        (select count(*)::integer from egocapture.upload_intents) as upload_intents,
        (select count(*)::integer from egocapture.video_assets) as video_assets,
        (select count(*)::integer from egocapture.review_cases) as review_cases,
        (select count(*)::integer from egocapture.audit_events) as audit_events,
        (select count(*)::integer from egocapture.command_receipts) as command_receipts
    `;

    console.log(`Target: ${target.hostname}:${target.port || "5432"}/${databaseIdentity.databaseName} schema egocapture`);
    console.log(`Migration frontier: ${migrationState.latestMigration}; task V2 applied: ${migrationState.v2MigrationApplied}`);
    console.log("Before:", before);
    if (inspectOnly) return;

    await db.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(hashtext('egocapture.task_data_v2_reset'))`;
      await transaction.unsafe(`
        truncate table
          egocapture.tasks,
          egocapture.upload_batches
        cascade
      `);
      await transaction`
        delete from egocapture.audit_events
        where entity_type in (
          'task', 'assignment', 'recording_session', 'upload_batch',
          'upload_intent', 'video_asset', 'review_case'
        )
      `;
      await transaction`
        delete from egocapture.command_receipts
        where command_name like any(array['task.%', 'assignment.%', 'session.%', 'upload.%', 'review_case.%'])
      `;
    });

    const [after] = await db<{
      tasks: number;
      uploadBatches: number;
      taskAuditEvents: number;
      taskCommandReceipts: number;
    }[]>`
      select
        (select count(*)::integer from egocapture.tasks) as tasks,
        (select count(*)::integer from egocapture.upload_batches) as upload_batches,
        (select count(*)::integer from egocapture.audit_events where entity_type in (
          'task', 'assignment', 'recording_session', 'upload_batch',
          'upload_intent', 'video_asset', 'review_case'
        )) as task_audit_events,
        (select count(*)::integer from egocapture.command_receipts
          where command_name like any(array['task.%', 'assignment.%', 'session.%', 'upload.%', 'review_case.%'])
        ) as task_command_receipts
    `;
    if (after.tasks !== 0 || after.uploadBatches !== 0 || after.taskAuditEvents !== 0 || after.taskCommandReceipts !== 0) {
      throw new Error(`Reset verification failed: ${JSON.stringify(after)}`);
    }
    console.log("After:", after);
    console.log("Scoped reset complete. Participants, consent records, devices, profiles and unrelated audit records were preserved.");
  } finally {
    await db.end({ timeout: 2 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture task reset: ${error.message}` : error);
  process.exitCode = 1;
});
