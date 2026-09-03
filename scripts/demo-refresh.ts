import { spawn } from "node:child_process";
import process from "node:process";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import postgres from "postgres";
import { demoRefreshEnvironment } from "@/scripts/check-support";
import {
  DEMO_STORAGE_BUCKET,
  EGOCAPTURE_BUSINESS_TABLES,
  assertConfiguredTargetEndpoints,
  assertDemoPurgeComplete,
  inspectionReport,
  maybeRunDemoPurge,
  parseDemoRefreshOptions,
  planAuthUserDeletion,
  redactSensitiveText,
  type DemoPurgeOperations,
  type DemoRefreshOptions,
  type DemoRefreshSnapshot,
} from "@/scripts/demo-refresh-guard";

type LiveEnvironment = ReturnType<typeof demoRefreshEnvironment>;

export type DemoRefreshRuntime = {
  inspect(): Promise<DemoRefreshSnapshot>;
  operationsFor(snapshot: DemoRefreshSnapshot): DemoPurgeOperations;
  seed(anchor: string | undefined): Promise<void>;
  verify(anchor: string | undefined): Promise<void>;
  write(line: string): void;
};

export type DemoRefreshResult = {
  executed: boolean;
  before: DemoRefreshSnapshot;
  afterPurge?: DemoRefreshSnapshot;
};

function databaseCoordinates(databaseUrl: string) {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("HOLD: DATABASE_URL is not a valid URL");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("HOLD: DATABASE_URL must use PostgreSQL");
  }
  return {
    hostname: url.hostname,
    port: url.port || "5432",
    username: decodeURIComponent(url.username),
    databaseName: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
}

export function assertLiveEnvironmentIdentity(environment: LiveEnvironment): void {
  const database = databaseCoordinates(environment.databaseUrl);
  assertConfiguredTargetEndpoints(environment.environmentId, {
    databaseHostname: database.hostname,
    databasePort: database.port,
    databaseUsername: database.username,
    databaseName: database.databaseName,
    apiUrl: environment.supabaseUrl,
    storageTusUrl: environment.tusEndpoint,
  });
}

async function listAllAuthUsers(supabase: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 100;
  for (let page = 1; page <= 1_000; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("HOLD: Auth user inspection failed");
    users.push(...data.users);
    if (data.users.length < perPage) return users;
  }
  throw new Error("HOLD: Auth user inspection exceeded the reviewed pagination limit");
}

async function inspectTarget(
  db: postgres.Sql,
  supabase: SupabaseClient,
  environment: LiveEnvironment,
): Promise<DemoRefreshSnapshot> {
  const configuredDatabase = databaseCoordinates(environment.databaseUrl);
  const [identity] = await db<{
    databaseName: string;
    schemaExists: boolean;
  }[]>`
    select
      current_database() as "databaseName",
      to_regnamespace('egocapture') is not null as "schemaExists"
  `;
  const tables = identity.schemaExists
    ? (await db<{ tableName: string }[]>`
        select relation.relname as "tableName"
        from pg_class relation
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        where namespace.nspname = 'egocapture'
          and relation.relkind in ('r', 'p')
        order by relation.relname
      `).map((row) => row.tableName)
    : [];
  const tableSet = new Set(tables);
  const appliedMigrations = tableSet.has("schema_migrations")
    ? (await db<{ version: string }[]>`
        select version from egocapture.schema_migrations order by version
      `).map((row) => row.version)
    : [];

  const tableCounts: Record<string, number> = {};
  for (const table of EGOCAPTURE_BUSINESS_TABLES) {
    if (!tableSet.has(table)) {
      tableCounts[table] = 0;
      continue;
    }
    const [row] = await db.unsafe<{ count: number }[]>(
      `select count(*)::integer as count from egocapture."${table}"`,
    );
    tableCounts[table] = row.count;
  }

  const linkedAuthUserIds = tableSet.has("profiles") && tableSet.has("participants")
    ? (await db<{ authUserId: string }[]>`
        select auth_user_id as "authUserId" from egocapture.profiles
        union
        select auth_user_id as "authUserId" from egocapture.participants
        where auth_user_id is not null
        order by "authUserId"
      `).map((row) => row.authUserId)
    : [];

  const [storageSchema] = await db<{ available: boolean }[]>`
    select to_regclass('storage.buckets') is not null
      and to_regclass('storage.objects') is not null as available
  `;
  let bucket: DemoRefreshSnapshot["bucket"] = null;
  if (storageSchema.available) {
    const [bucketRow] = await db<{ id: string; name: string; public: boolean }[]>`
      select id, name, public
      from storage.buckets
      where id = ${DEMO_STORAGE_BUCKET}
    `;
    if (bucketRow) {
      const objectNames = (await db<{ name: string }[]>`
        select name from storage.objects
        where bucket_id = ${DEMO_STORAGE_BUCKET}
        order by name
      `).map((row) => row.name);
      bucket = { ...bucketRow, objectNames };
    }
  }

  const authUsers = (await listAllAuthUsers(supabase)).map((user) => ({
    id: user.id,
    email: user.email ?? null,
    appMetadata: user.app_metadata ?? {},
    userMetadata: user.user_metadata ?? {},
  }));
  return {
    database: {
      ...configuredDatabase,
      databaseName: identity.databaseName,
      schemaExists: identity.schemaExists,
      tables,
      appliedMigrations,
    },
    apiUrl: environment.supabaseUrl,
    storageTusUrl: environment.tusEndpoint,
    bucket,
    tableCounts,
    authUsers,
    linkedAuthUserIds,
  };
}

function sameTableManifest(tables: readonly string[]): boolean {
  return tables.length === EGOCAPTURE_BUSINESS_TABLES.length
    && tables.every((table, index) => table === EGOCAPTURE_BUSINESS_TABLES[index]);
}

function isMissingAuthUser(error: { status?: number; code?: string }): boolean {
  return error.status === 404 || error.code === "user_not_found";
}

function livePurgeOperations(
  db: postgres.Sql,
  supabase: SupabaseClient,
  environmentId: string,
  snapshot: DemoRefreshSnapshot,
): DemoPurgeOperations {
  const inspectedObjects = new Set(snapshot.bucket?.objectNames ?? []);
  const eligibleUsers = new Set(
    planAuthUserDeletion(environmentId, snapshot.authUsers, snapshot.linkedAuthUserIds)
      .map((user) => user.id),
  );
  return {
    async deleteStorageObjects(bucket, objectNames) {
      if (bucket !== DEMO_STORAGE_BUCKET || objectNames.some((name) => !inspectedObjects.has(name))) {
        throw new Error("HOLD: Storage purge escaped the inspected egocapture-raw object set");
      }
      for (let offset = 0; offset < objectNames.length; offset += 100) {
        const chunk = objectNames.slice(offset, offset + 100);
        const { error } = await supabase.storage.from(DEMO_STORAGE_BUCKET).remove([...chunk]);
        if (error) throw new Error("HOLD: scoped Storage object deletion failed");
      }
    },
    async truncateBusinessTables(tables) {
      if (!sameTableManifest(tables)) {
        throw new Error("HOLD: database purge differs from the reviewed business table manifest");
      }
      const qualifiedTables = tables.map((table) => `egocapture."${table}"`).join(",\n");
      await db.begin(async (transaction) => {
        await transaction`select pg_advisory_xact_lock(hashtext('egocapture.demo_refresh'))`;
        await transaction.unsafe(`truncate table ${qualifiedTables} restart identity`);
      });
    },
    async deleteAuthUser(userId) {
      if (!eligibleUsers.has(userId)) {
        throw new Error("HOLD: Auth purge escaped the inspected user set");
      }
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (!error) return "deleted";
      if (isMissingAuthUser(error)) return "already-absent";
      throw new Error("HOLD: scoped Auth user deletion failed");
    },
  };
}

async function runPnpmScript(script: string, extraEnvironment: Record<string, string | undefined> = {}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", [script], {
      env: { ...process.env, ...extraEnvironment },
      shell: false,
      stdio: "inherit",
    });
    child.once("error", () => reject(new Error(`HOLD: failed to start ${script}`)));
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`HOLD: ${script} failed (${signal ?? code ?? "unknown"})`));
    });
  });
}

export async function orchestrateDemoRefresh(
  options: DemoRefreshOptions,
  environmentId: string,
  resetAllowedMarker: string | undefined,
  runtime: DemoRefreshRuntime,
): Promise<DemoRefreshResult> {
  const before = await runtime.inspect();
  for (const line of inspectionReport(environmentId, before)) runtime.write(line);
  if (options.mode === "inspect") return { executed: false, before };

  await maybeRunDemoPurge(
    options,
    environmentId,
    resetAllowedMarker,
    before,
    runtime.operationsFor(before),
  );
  const afterPurge = await runtime.inspect();
  assertDemoPurgeComplete(environmentId, afterPurge);
  runtime.write("Scoped purge verified; starting deterministic seed.");
  await runtime.seed(options.anchor);
  await runtime.verify(options.anchor);
  runtime.write("Deterministic demo refresh complete.");
  return { executed: true, before, afterPurge };
}

function createLiveRuntime(
  environment: LiveEnvironment,
  db: postgres.Sql,
  supabase: SupabaseClient,
): DemoRefreshRuntime {
  return {
    inspect: () => inspectTarget(db, supabase, environment),
    operationsFor: (snapshot) => livePurgeOperations(
      db,
      supabase,
      environment.environmentId,
      snapshot,
    ),
    seed: (anchor) => runPnpmScript("db:seed", {
      DEMO_SEED_ANCHOR: anchor ?? environment.seedAnchor,
    }),
    verify: async (anchor) => {
      await runPnpmScript("db:test:seed", {
        DEMO_SEED_ANCHOR: anchor ?? environment.seedAnchor,
      });
      await runPnpmScript("db:test:rls");
    },
    write: (line) => console.log(line),
  };
}

async function main(): Promise<void> {
  const options = parseDemoRefreshOptions(process.argv.slice(2));
  const environment = demoRefreshEnvironment();
  assertLiveEnvironmentIdentity(environment);
  const db = postgres(environment.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 2,
  });
  const supabase = createClient(environment.supabaseUrl, environment.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  try {
    await orchestrateDemoRefresh(
      options,
      environment.environmentId,
      environment.resetAllowedMarker,
      createLiveRuntime(environment, db, supabase),
    );
  } finally {
    await db.end({ timeout: 2 });
  }
}

if (process.argv[1]?.endsWith("demo-refresh.ts")) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "unknown failure";
    console.error(`EgoCapture demo refresh: ${redactSensitiveText(message)}`);
    process.exitCode = 1;
  });
}
