import { z } from "zod";

export const DEMO_STORAGE_BUCKET = "egocapture-raw";
export const REQUIRED_MIGRATION_FRONTIER = "0024";
export const DEMO_RESET_MARKER_PREFIX = "ALLOW-DEMO-RESET:";

export const EGOCAPTURE_PRESERVED_TABLES = [
  "schema_migrations",
  "state_machine_transitions",
] as const;

export const EGOCAPTURE_BUSINESS_TABLES = [
  "asset_files",
  "assignments",
  "audit_events",
  "command_receipts",
  "consent_records",
  "device_assignments",
  "devices",
  "match_decisions",
  "metadata_attempts",
  "metadata_evidence",
  "multipart_upload_parts",
  "participant_invitations",
  "participant_login_credentials",
  "participants",
  "profiles",
  "recording_sessions",
  "review_cases",
  "session_markers",
  "stored_objects",
  "task_participant_plans",
  "task_versions",
  "tasks",
  "upload_attempts",
  "upload_batches",
  "upload_intents",
  "video_assets",
  "video_file_metadata",
] as const;

export type DemoRefreshMode = "inspect" | "execute";

export type DemoRefreshOptions = {
  mode: DemoRefreshMode;
  confirm?: string;
  anchor?: string;
};

export type DemoAuthUser = {
  id: string;
  email: string | null;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
};

export type DemoRefreshSnapshot = {
  database: {
    hostname: string;
    port: string;
    username: string;
    databaseName: string;
    schemaExists: boolean;
    tables: string[];
    appliedMigrations: string[];
  };
  apiUrl: string;
  storageTusUrl: string;
  bucket: {
    id: string;
    name: string;
    public: boolean;
    objectNames: string[];
  } | null;
  tableCounts: Record<string, number>;
  authUsers: DemoAuthUser[];
  linkedAuthUserIds: string[];
};

export type PlannedAuthUser = {
  id: string;
  reason: "dedicated_environment";
};

export type DemoPurgePlan = {
  environmentId: string;
  storage: {
    bucket: typeof DEMO_STORAGE_BUCKET;
    objectNames: string[];
  };
  authUsers: PlannedAuthUser[];
  tables: readonly string[];
};

export type DemoPurgeOperations = {
  deleteStorageObjects(bucket: string, objectNames: readonly string[]): Promise<void>;
  truncateBusinessTables(tables: readonly string[]): Promise<void>;
  deleteAuthUser(userId: string): Promise<"deleted" | "already-absent">;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TARGET_ID_PATTERN = /^egocapture-(nas|demo)-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUPABASE_PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const FORBIDDEN_TARGET_WORDS = /(?:^|-)(?:shared|text2sql|data-agent|unknown|local|mac|default)(?:-|$)/;
const APPROVED_NAS_TARGET = {
  environmentId: "egocapture-nas-interview",
  databaseHostname: "127.0.0.1",
  databasePort: "56522",
  apiOrigin: "http://127.0.0.1:56521",
} as const;

function optionValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`HOLD: ${flag} requires a value`);
  return value;
}

export function parseDemoRefreshOptions(args: readonly string[]): DemoRefreshOptions {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  let mode: DemoRefreshMode = "inspect";
  let explicitInspect = false;
  let explicitExecute = false;
  let confirm: string | undefined;
  let anchor: string | undefined;

  for (let index = 0; index < normalizedArgs.length; index += 1) {
    const argument = normalizedArgs[index];
    switch (argument) {
      case "--inspect":
        if (explicitInspect) throw new Error("HOLD: --inspect may be provided only once");
        explicitInspect = true;
        mode = "inspect";
        break;
      case "--execute":
        if (explicitExecute) throw new Error("HOLD: --execute may be provided only once");
        explicitExecute = true;
        mode = "execute";
        break;
      case "--confirm":
        if (confirm !== undefined) throw new Error("HOLD: --confirm may be provided only once");
        confirm = optionValue(normalizedArgs, index, argument);
        index += 1;
        break;
      case "--anchor": {
        if (anchor !== undefined) throw new Error("HOLD: --anchor may be provided only once");
        const value = optionValue(normalizedArgs, index, argument);
        if (!z.string().datetime({ offset: true }).safeParse(value).success) {
          throw new Error("HOLD: --anchor must be an ISO date-time");
        }
        anchor = new Date(value).toISOString();
        index += 1;
        break;
      }
      default:
        throw new Error(`HOLD: unknown demo refresh argument ${argument}`);
    }
  }

  if (explicitInspect && explicitExecute) {
    throw new Error("HOLD: --inspect and --execute are mutually exclusive");
  }
  if (mode === "inspect" && confirm !== undefined) {
    throw new Error("HOLD: --confirm is accepted only with --execute");
  }
  return { mode, confirm, anchor };
}

export function resetAllowedMarker(environmentId: string): string {
  return `${DEMO_RESET_MARKER_PREFIX}${environmentId}`;
}

function parseUrl(value: string, label: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`HOLD: ${label} is not a valid URL`);
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function targetKind(environmentId: string): "nas" | "cloud" {
  const match = TARGET_ID_PATTERN.exec(environmentId);
  if (!match || FORBIDDEN_TARGET_WORDS.test(environmentId)) {
    throw new Error("HOLD: environment id is not an approved EgoCapture NAS or dedicated demo identity");
  }
  return match[1] === "nas" ? "nas" : "cloud";
}

function assertExactSchema(snapshot: DemoRefreshSnapshot): void {
  if (!snapshot.database.schemaExists) throw new Error("HOLD: egocapture schema does not exist");
  const expected = new Set<string>([
    ...EGOCAPTURE_BUSINESS_TABLES,
    ...EGOCAPTURE_PRESERVED_TABLES,
  ]);
  const actual = new Set(snapshot.database.tables);
  const missing = [...expected].filter((table) => !actual.has(table));
  const unexpected = [...actual].filter((table) => !expected.has(table));
  if (missing.length || unexpected.length) {
    throw new Error(
      `HOLD: egocapture schema differs from the reviewed reset manifest (missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"})`,
    );
  }
}

function assertMigrationFrontier(snapshot: DemoRefreshSnapshot): void {
  const migrations = [...snapshot.database.appliedMigrations].sort();
  const expected = Array.from({ length: Number(REQUIRED_MIGRATION_FRONTIER) }, (_, index) =>
    String(index + 1).padStart(4, "0"),
  );
  if (migrations.length !== expected.length || migrations.some((version, index) => version !== expected[index])) {
    throw new Error(`HOLD: migration frontier must be exactly ${REQUIRED_MIGRATION_FRONTIER}`);
  }
}

function assertInspectionCounts(snapshot: DemoRefreshSnapshot): void {
  const expected = new Set<string>(EGOCAPTURE_BUSINESS_TABLES);
  const actual = new Set(Object.keys(snapshot.tableCounts));
  const missing = [...expected].filter((table) => !actual.has(table));
  const unexpected = [...actual].filter((table) => !expected.has(table));
  const invalid = Object.entries(snapshot.tableCounts)
    .filter(([, count]) => !Number.isSafeInteger(count) || count < 0)
    .map(([table]) => table);
  if (missing.length || unexpected.length || invalid.length) {
    throw new Error("HOLD: business table inspection is incomplete or invalid");
  }
}

function assertEndpointIdentity(environmentId: string, snapshot: DemoRefreshSnapshot): void {
  assertConfiguredTargetEndpoints(environmentId, {
    databaseHostname: snapshot.database.hostname,
    databasePort: snapshot.database.port,
    databaseUsername: snapshot.database.username,
    databaseName: snapshot.database.databaseName,
    apiUrl: snapshot.apiUrl,
    storageTusUrl: snapshot.storageTusUrl,
  });
}

export function assertConfiguredTargetEndpoints(
  environmentId: string,
  endpoints: {
    databaseHostname: string;
    databasePort: string;
    databaseUsername: string;
    databaseName: string;
    apiUrl: string;
    storageTusUrl: string;
  },
): void {
  const kind = targetKind(environmentId);
  const api = parseUrl(endpoints.apiUrl, "Supabase API URL");
  const tus = parseUrl(endpoints.storageTusUrl, "Storage TUS URL");
  if (api.pathname !== "/" || api.search || api.hash || tus.search || tus.hash) {
    throw new Error("HOLD: API and Storage TUS endpoints do not identify the same Supabase project");
  }
  if (endpoints.databaseName !== "postgres") {
    throw new Error("HOLD: database name is not the reviewed EgoCapture database");
  }

  const databaseIsLoopback = isLoopback(endpoints.databaseHostname);
  const apiIsLoopback = isLoopback(api.hostname);
  if (kind === "nas") {
    if (!databaseIsLoopback || !apiIsLoopback || api.protocol !== "http:"
      || environmentId !== APPROVED_NAS_TARGET.environmentId
      || endpoints.databaseHostname !== APPROVED_NAS_TARGET.databaseHostname
      || endpoints.databasePort !== APPROVED_NAS_TARGET.databasePort
      || api.origin !== APPROVED_NAS_TARGET.apiOrigin
      || tus.origin !== api.origin
      || tus.pathname.replace(/\/$/, "") !== "/storage/v1/upload/resumable") {
      throw new Error("HOLD: NAS identity does not match the reviewed supervised tunnel target");
    }
    return;
  }

  if (databaseIsLoopback || apiIsLoopback || api.protocol !== "https:" || tus.protocol !== "https:"
    || !api.hostname.endsWith(".supabase.co")) {
    throw new Error("HOLD: dedicated cloud identity requires non-local Supabase HTTPS endpoints");
  }
  const projectRef = api.hostname.slice(0, -".supabase.co".length);
  if (!SUPABASE_PROJECT_REF_PATTERN.test(projectRef)
    || environmentId !== `egocapture-demo-${projectRef}`) {
    throw new Error("HOLD: dedicated cloud environment id is not bound to the Supabase project ref");
  }
  const allowedTusOrigins = new Set([
    api.origin,
    `https://${projectRef}.storage.supabase.co`,
  ]);
  if (!allowedTusOrigins.has(tus.origin)
    || tus.pathname.replace(/\/$/, "") !== "/storage/v1/upload/resumable/sign") {
    throw new Error("HOLD: API and Storage TUS endpoints do not identify the same Supabase project");
  }
  const directDatabase = endpoints.databaseHostname === `db.${projectRef}.supabase.co`;
  const pooledDatabase = endpoints.databaseHostname.endsWith(".pooler.supabase.com")
    && endpoints.databaseUsername === `postgres.${projectRef}`;
  if (!directDatabase && !pooledDatabase) {
    throw new Error("HOLD: database and API endpoints do not identify the same Supabase project");
  }
}

function assertBucket(snapshot: DemoRefreshSnapshot): asserts snapshot is DemoRefreshSnapshot & {
  bucket: NonNullable<DemoRefreshSnapshot["bucket"]>;
} {
  if (!snapshot.bucket
    || snapshot.bucket.id !== DEMO_STORAGE_BUCKET
    || snapshot.bucket.name !== DEMO_STORAGE_BUCKET
    || snapshot.bucket.public) {
    throw new Error("HOLD: exact private egocapture-raw bucket is not present");
  }
}

export function assertDemoRefreshTarget(environmentId: string, snapshot: DemoRefreshSnapshot): void {
  targetKind(environmentId);
  assertExactSchema(snapshot);
  assertMigrationFrontier(snapshot);
  assertInspectionCounts(snapshot);
  assertEndpointIdentity(environmentId, snapshot);
  assertBucket(snapshot);
}

export function planAuthUserDeletion(
  _environmentId: string,
  users: readonly DemoAuthUser[],
  linkedAuthUserIds: readonly string[],
): PlannedAuthUser[] {
  const linked = new Set(linkedAuthUserIds);
  const userIds = new Set<string>();
  const planned = users.map((user): PlannedAuthUser => {
    if (!UUID_PATTERN.test(user.id)) throw new Error("HOLD: Auth returned an invalid user id");
    if (userIds.has(user.id)) throw new Error("HOLD: Auth returned a duplicate user id");
    userIds.add(user.id);
    return { id: user.id, reason: "dedicated_environment" };
  });
  if ([...linked].some((userId) => !userIds.has(userId))) {
    throw new Error("HOLD: a profile-linked Auth user was not returned by Auth inspection");
  }
  return planned;
}

export function authorizeDemoPurge(
  options: DemoRefreshOptions,
  environmentId: string,
  resetMarker: string | undefined,
  snapshot: DemoRefreshSnapshot,
): DemoPurgePlan {
  if (options.mode !== "execute") throw new Error("HOLD: inspect mode cannot create an executable purge plan");
  assertDemoRefreshTarget(environmentId, snapshot);
  if (options.confirm !== environmentId) {
    throw new Error("HOLD: --confirm must exactly match EGOCAPTURE_ENVIRONMENT_ID");
  }
  if (resetMarker !== resetAllowedMarker(environmentId)) {
    throw new Error("HOLD: EGOCAPTURE_DEMO_RESET_ALLOWED is not bound to this environment id");
  }
  if (!snapshot.bucket) throw new Error("HOLD: exact private egocapture-raw bucket is not present");
  return {
    environmentId,
    storage: {
      bucket: DEMO_STORAGE_BUCKET,
      objectNames: [...snapshot.bucket.objectNames].sort(),
    },
    authUsers: planAuthUserDeletion(environmentId, snapshot.authUsers, snapshot.linkedAuthUserIds),
    tables: EGOCAPTURE_BUSINESS_TABLES,
  };
}

export async function runIdempotentPurge(
  plan: DemoPurgePlan,
  operations: DemoPurgeOperations,
): Promise<void> {
  await operations.deleteStorageObjects(plan.storage.bucket, plan.storage.objectNames);
  await operations.truncateBusinessTables(plan.tables);
  for (const user of plan.authUsers) await operations.deleteAuthUser(user.id);
}

export async function maybeRunDemoPurge(
  options: DemoRefreshOptions,
  environmentId: string,
  resetMarker: string | undefined,
  snapshot: DemoRefreshSnapshot,
  operations: DemoPurgeOperations,
): Promise<boolean> {
  assertDemoRefreshTarget(environmentId, snapshot);
  if (options.mode === "inspect") return false;
  const plan = authorizeDemoPurge(options, environmentId, resetMarker, snapshot);
  await runIdempotentPurge(plan, operations);
  return true;
}

export function inspectionReport(environmentId: string, snapshot: DemoRefreshSnapshot): string[] {
  assertDemoRefreshTarget(environmentId, snapshot);
  if (!snapshot.bucket) throw new Error("HOLD: exact private egocapture-raw bucket is not present");
  const api = parseUrl(snapshot.apiUrl, "Supabase API URL");
  const tus = parseUrl(snapshot.storageTusUrl, "Storage TUS URL");
  const totalRows = Object.values(snapshot.tableCounts).reduce((sum, count) => sum + count, 0);
  const tableCounts = EGOCAPTURE_BUSINESS_TABLES
    .map((table) => `${table}=${snapshot.tableCounts[table]}`)
    .join(", ");
  const plannedUsers = planAuthUserDeletion(environmentId, snapshot.authUsers, snapshot.linkedAuthUserIds);
  return [
    `Environment: ${environmentId}`,
    `Database: ${snapshot.database.hostname}:${snapshot.database.port || "5432"}/${snapshot.database.databaseName}`,
    `API origin: ${api.origin}`,
    `Storage TUS origin: ${tus.origin}`,
    `Migration frontier: ${REQUIRED_MIGRATION_FRONTIER}`,
    `Business rows: ${totalRows}`,
    `Tables: ${tableCounts}`,
    `Auth users: ${snapshot.authUsers.length} total; ${plannedUsers.length} eligible for scoped deletion`,
    `Storage: ${DEMO_STORAGE_BUCKET}; ${snapshot.bucket.objectNames.length} objects`,
  ];
}

export function assertDemoPurgeComplete(environmentId: string, snapshot: DemoRefreshSnapshot): void {
  assertDemoRefreshTarget(environmentId, snapshot);
  const nonEmptyTables = Object.entries(snapshot.tableCounts)
    .filter(([, count]) => count !== 0)
    .map(([table]) => table);
  const remainingAuthUsers = planAuthUserDeletion(
    environmentId,
    snapshot.authUsers,
    snapshot.linkedAuthUserIds,
  );
  if (nonEmptyTables.length
    || snapshot.bucket?.objectNames.length
    || snapshot.authUsers.length
    || remainingAuthUsers.length
    || snapshot.linkedAuthUserIds.length) {
    throw new Error("HOLD: purge verification found remaining EgoCapture data");
  }
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/gi, "$1<redacted>@")
    .replace(/([?&](?:apikey|token|key|secret|password)=)[^&\s]+/gi, "$1<redacted>")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "<redacted-jwt>");
}
