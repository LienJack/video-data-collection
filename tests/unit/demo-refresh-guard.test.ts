import { describe, expect, it, vi } from "vitest";
import {
  DEMO_STORAGE_BUCKET,
  EGOCAPTURE_BUSINESS_TABLES,
  EGOCAPTURE_PRESERVED_TABLES,
  authorizeDemoPurge,
  assertDemoPurgeComplete,
  inspectionReport,
  maybeRunDemoPurge,
  parseDemoRefreshOptions,
  planAuthUserDeletion,
  redactSensitiveText,
  resetAllowedMarker,
  runIdempotentPurge,
  type DemoAuthUser,
  type DemoPurgeOperations,
  type DemoRefreshSnapshot,
} from "@/scripts/demo-refresh-guard";

const environmentId = "egocapture-nas-interview";
const linkedUserId = "11111111-1111-4111-8111-111111111111";
const fixtureUserId = "22222222-2222-4222-8222-222222222222";
const unrelatedUserId = "33333333-3333-4333-8333-333333333333";

function authUser(overrides: Partial<DemoAuthUser> & Pick<DemoAuthUser, "id">): DemoAuthUser {
  return {
    id: overrides.id,
    email: overrides.email ?? null,
    appMetadata: overrides.appMetadata ?? {},
    userMetadata: overrides.userMetadata ?? {},
  };
}

function snapshot(overrides: Partial<DemoRefreshSnapshot> = {}): DemoRefreshSnapshot {
  return {
    database: {
      hostname: "127.0.0.1",
      port: "56522",
      username: "postgres",
      databaseName: "postgres",
      schemaExists: true,
      tables: [...EGOCAPTURE_BUSINESS_TABLES, ...EGOCAPTURE_PRESERVED_TABLES],
      appliedMigrations: Array.from({ length: 24 }, (_, index) => String(index + 1).padStart(4, "0")),
    },
    apiUrl: "http://127.0.0.1:56521",
    storageTusUrl: "http://127.0.0.1:56521/storage/v1/upload/resumable",
    bucket: {
      id: DEMO_STORAGE_BUCKET,
      name: DEMO_STORAGE_BUCKET,
      public: false,
      objectNames: ["participant/a/upload/b/c.mp4"],
    },
    tableCounts: Object.fromEntries(EGOCAPTURE_BUSINESS_TABLES.map((table) => [table, table === "profiles" ? 2 : 0])),
    authUsers: [
      authUser({ id: linkedUserId, email: "member@example.invalid" }),
      authUser({
        id: fixtureUserId,
        email: "demo@egocapture.invalid",
        userMetadata: { egocapture_fixture: true, egocapture_role: "participant" },
      }),
      authUser({ id: unrelatedUserId, email: "unrelated@example.com" }),
    ],
    linkedAuthUserIds: [linkedUserId],
    ...overrides,
  };
}

function operations(): DemoPurgeOperations & Record<string, ReturnType<typeof vi.fn>> {
  return {
    deleteStorageObjects: vi.fn(async () => undefined),
    truncateBusinessTables: vi.fn(async () => undefined),
    deleteAuthUser: vi.fn(async () => "deleted" as const),
  };
}

describe("demo refresh CLI guard", () => {
  it("defaults to read-only inspection and parses an explicit execution", () => {
    expect(parseDemoRefreshOptions([])).toEqual({ mode: "inspect", confirm: undefined, anchor: undefined });
    expect(parseDemoRefreshOptions(["--", "--inspect"])).toEqual({
      mode: "inspect",
      confirm: undefined,
      anchor: undefined,
    });
    expect(parseDemoRefreshOptions([
      "--execute",
      "--confirm",
      environmentId,
      "--anchor",
      "2026-09-03T00:00:00+08:00",
    ])).toEqual({
      mode: "execute",
      confirm: environmentId,
      anchor: "2026-09-02T16:00:00.000Z",
    });
  });

  it("rejects ambiguous, duplicate, and unknown arguments", () => {
    expect(() => parseDemoRefreshOptions(["--inspect", "--execute"])).toThrow(/mutually exclusive/);
    expect(() => parseDemoRefreshOptions(["--inspect", "--confirm", environmentId])).toThrow(/only with --execute/);
    expect(() => parseDemoRefreshOptions(["--execute", "--execute"])).toThrow(/only once/);
    expect(() => parseDemoRefreshOptions(["--", "--", "--inspect"])).toThrow(/unknown/);
    expect(() => parseDemoRefreshOptions(["--inspect", "--"])).toThrow(/unknown/);
    expect(() => parseDemoRefreshOptions(["--force"])).toThrow(/unknown/);
    expect(() => parseDemoRefreshOptions(["--execute", "--anchor", "September 3 2026"])).toThrow(/ISO date-time/);
    expect(() => parseDemoRefreshOptions(["--execute", "--anchor", "2026-02-30T00:00:00Z"])).toThrow(/ISO date-time/);
  });

  it("requires both exact confirmation and an environment-bound reset marker", () => {
    const options = { mode: "execute", confirm: environmentId } as const;
    expect(() => authorizeDemoPurge(options, environmentId, undefined, snapshot())).toThrow(/RESET_ALLOWED/);
    expect(() => authorizeDemoPurge(options, environmentId, resetAllowedMarker("egocapture-nas-other"), snapshot()))
      .toThrow(/not bound/);
    expect(() => authorizeDemoPurge({ ...options, confirm: "egocapture-nas-other" }, environmentId, resetAllowedMarker(environmentId), snapshot()))
      .toThrow(/exactly match/);

    const plan = authorizeDemoPurge(options, environmentId, resetAllowedMarker(environmentId), snapshot());
    expect(plan.tables).toEqual(EGOCAPTURE_BUSINESS_TABLES);
    expect(plan.tables).not.toContain("schema_migrations");
    expect(plan.tables).not.toContain("state_machine_transitions");
    expect(plan.storage).toEqual({
      bucket: DEMO_STORAGE_BUCKET,
      objectNames: ["participant/a/upload/b/c.mp4"],
    });
    expect(plan.authUsers).toHaveLength(snapshot().authUsers.length);
  });

  it.each([
    "egocapture-local-dev",
    "egocapture-demo-shared",
    "egocapture-demo-text2sql",
    "unknown",
    "data-agent-demo",
  ])("rejects unapproved environment identity %s", async (unsafeIdentity) => {
    await expect(maybeRunDemoPurge(
      { mode: "inspect" },
      unsafeIdentity,
      undefined,
      snapshot(),
      operations(),
    )).rejects.toThrow(/HOLD/);
  });

  it("rejects schema, migration, bucket, and endpoint drift before any operation", async () => {
    const cases: DemoRefreshSnapshot[] = [
      snapshot({ database: { ...snapshot().database, schemaExists: false } }),
      snapshot({ database: { ...snapshot().database, appliedMigrations: ["0001", "0024"] } }),
      snapshot({ database: { ...snapshot().database, port: "56523" } }),
      snapshot({ bucket: { id: DEMO_STORAGE_BUCKET, name: DEMO_STORAGE_BUCKET, public: true, objectNames: [] } }),
      snapshot({ storageTusUrl: "http://127.0.0.1:56520/storage/v1/upload/resumable" }),
      snapshot({ tableCounts: { profiles: 2 } }),
    ];
    for (const unsafeSnapshot of cases) {
      const writes = operations();
      await expect(maybeRunDemoPurge(
        { mode: "execute", confirm: environmentId },
        environmentId,
        resetAllowedMarker(environmentId),
        unsafeSnapshot,
        writes,
      )).rejects.toThrow(/HOLD/);
      expect(writes.deleteStorageObjects).not.toHaveBeenCalled();
      expect(writes.truncateBusinessTables).not.toHaveBeenCalled();
      expect(writes.deleteAuthUser).not.toHaveBeenCalled();
    }
  });

  it("accepts only the API or direct Storage TUS origin for the same dedicated Supabase ref", () => {
    const cloudSnapshot = snapshot({
      database: {
        ...snapshot().database,
        hostname: "db.abcdefghijklmnopqrst.supabase.co",
        port: "5432",
      },
      apiUrl: "https://abcdefghijklmnopqrst.supabase.co",
      storageTusUrl: "https://abcdefghijklmnopqrst.storage.supabase.co/storage/v1/upload/resumable/sign",
    });
    expect(() => authorizeDemoPurge(
      { mode: "execute", confirm: "egocapture-demo-abcdefghijklmnopqrst" },
      "egocapture-demo-abcdefghijklmnopqrst",
      resetAllowedMarker("egocapture-demo-abcdefghijklmnopqrst"),
      cloudSnapshot,
    )).not.toThrow();
    expect(() => authorizeDemoPurge(
      { mode: "execute", confirm: "egocapture-demo-abcdefghijklmnopqrst" },
      "egocapture-demo-abcdefghijklmnopqrst",
      resetAllowedMarker("egocapture-demo-abcdefghijklmnopqrst"),
      {
        ...cloudSnapshot,
        storageTusUrl: "https://abcdefghijklmnopqrst.supabase.co/storage/v1/upload/resumable/sign",
      },
    )).not.toThrow();
    expect(() => authorizeDemoPurge(
      { mode: "execute", confirm: "egocapture-demo-abcdefghijklmnopqrst" },
      "egocapture-demo-abcdefghijklmnopqrst",
      resetAllowedMarker("egocapture-demo-abcdefghijklmnopqrst"),
      {
        ...cloudSnapshot,
        database: { ...cloudSnapshot.database, hostname: "db.differentprojectref.supabase.co" },
      },
    )).toThrow(/same Supabase project/);
    expect(() => authorizeDemoPurge(
      { mode: "execute", confirm: "egocapture-demo-us" },
      "egocapture-demo-us",
      resetAllowedMarker("egocapture-demo-us"),
      cloudSnapshot,
    )).toThrow(/project ref/);
    for (const storageTusUrl of [
      "https://differentprojectref.storage.supabase.co/storage/v1/upload/resumable/sign",
      "https://abcdefghijklmnopqrst.storage.supabase.co/storage/v1/upload/resumable",
      "https://abcdefghijklmnopqrst.storage.supabase.co/storage/v1/upload/resumable/sign?unsafe=1",
      "https://storage.example.com/storage/v1/upload/resumable/sign",
    ]) {
      expect(() => authorizeDemoPurge(
        { mode: "execute", confirm: "egocapture-demo-abcdefghijklmnopqrst" },
        "egocapture-demo-abcdefghijklmnopqrst",
        resetAllowedMarker("egocapture-demo-abcdefghijklmnopqrst"),
        { ...cloudSnapshot, storageTusUrl },
      )).toThrow(/same Supabase project/);
    }
  });
});

describe("scoped purge planning", () => {
  it("deletes every user returned by the verified dedicated project's Admin API", () => {
    const retryId = "44444444-4444-4444-8444-444444444444";
    const candidates = planAuthUserDeletion(environmentId, [
      ...snapshot().authUsers,
      authUser({
        id: retryId,
        email: "former-link@example.com",
        appMetadata: { egocapture_reset_environment_id: environmentId },
      }),
      authUser({
        id: "55555555-5555-4555-8555-555555555555",
        email: "forged@example.com",
        userMetadata: { egocapture_fixture: true, egocapture_role: "participant" },
      }),
    ], [linkedUserId]);
    expect(candidates).toEqual([
      { id: linkedUserId, reason: "dedicated_environment" },
      { id: fixtureUserId, reason: "dedicated_environment" },
      { id: unrelatedUserId, reason: "dedicated_environment" },
      { id: retryId, reason: "dedicated_environment" },
      { id: "55555555-5555-4555-8555-555555555555", reason: "dedicated_environment" },
    ]);
    expect(() => planAuthUserDeletion(environmentId, snapshot().authUsers, [
      "66666666-6666-4666-8666-666666666666",
    ])).toThrow(/profile-linked Auth user/);
    expect(() => planAuthUserDeletion(environmentId, [
      authUser({ id: "not-a-uuid" }),
    ], [])).toThrow(/invalid user id/);
    expect(() => planAuthUserDeletion(environmentId, [
      authUser({ id: linkedUserId }),
      authUser({ id: linkedUserId }),
    ], [])).toThrow(/duplicate user id/);
  });

  it("requires the verified dedicated Auth project to be empty after purge", () => {
    const remainingAuthSnapshot = snapshot({
      bucket: { id: DEMO_STORAGE_BUCKET, name: DEMO_STORAGE_BUCKET, public: false, objectNames: [] },
      tableCounts: Object.fromEntries(EGOCAPTURE_BUSINESS_TABLES.map((table) => [table, 0])),
      authUsers: [authUser({ id: unrelatedUserId, email: "unlinked@example.com" })],
      linkedAuthUserIds: [],
    });
    expect(() => assertDemoPurgeComplete(environmentId, remainingAuthSnapshot)).toThrow(/remaining EgoCapture data/);
  });

  it("performs no writes in default inspect mode and reports counts without row identities", async () => {
    const writes = operations();
    await expect(maybeRunDemoPurge(
      parseDemoRefreshOptions([]),
      environmentId,
      undefined,
      snapshot(),
      writes,
    )).resolves.toBe(false);
    expect(writes.deleteStorageObjects).not.toHaveBeenCalled();
    expect(writes.truncateBusinessTables).not.toHaveBeenCalled();
    expect(writes.deleteAuthUser).not.toHaveBeenCalled();

    const output = inspectionReport(environmentId, snapshot()).join("\n");
    expect(output).toContain(`Environment: ${environmentId}`);
    expect(output).toContain("Business rows: 2");
    expect(output).toContain("3 eligible for scoped deletion");
    expect(output).not.toContain(linkedUserId);
    expect(output).not.toContain("member@example.invalid");
    expect(output).not.toContain("participant/a/upload/b/c.mp4");
  });

  it("keeps phases retry-safe when an intermediate operation fails", async () => {
    const firstPlan = authorizeDemoPurge(
      { mode: "execute", confirm: environmentId },
      environmentId,
      resetAllowedMarker(environmentId),
      snapshot(),
    );
    const events: string[] = [];
    const firstRun: DemoPurgeOperations = {
      deleteStorageObjects: async () => { events.push("storage"); },
      truncateBusinessTables: async () => {
        events.push("database");
        throw new Error("database temporarily unavailable");
      },
      deleteAuthUser: async () => { events.push("delete-auth"); return "deleted"; },
    };
    await expect(runIdempotentPurge(firstPlan, firstRun)).rejects.toThrow(/temporarily unavailable/);
    expect(events).toEqual(["storage", "database"]);

    const retrySnapshot = snapshot({
      linkedAuthUserIds: [],
      bucket: { id: DEMO_STORAGE_BUCKET, name: DEMO_STORAGE_BUCKET, public: false, objectNames: [] },
    });
    const retryPlan = authorizeDemoPurge(
      { mode: "execute", confirm: environmentId },
      environmentId,
      resetAllowedMarker(environmentId),
      retrySnapshot,
    );
    expect(retryPlan.authUsers.find((user) => user.id === linkedUserId)?.reason).toBe("dedicated_environment");
    const retryRun = operations();
    await expect(runIdempotentPurge(retryPlan, retryRun)).resolves.toBeUndefined();
    expect(retryRun.truncateBusinessTables).toHaveBeenCalledWith(EGOCAPTURE_BUSINESS_TABLES);
    expect(retryRun.deleteAuthUser).toHaveBeenCalledTimes(3);
  });

  it("redacts database passwords, query secrets, and JWTs", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature";
    const input = `postgresql://postgres:password@db.example/postgres?token=secret ${jwt}`;
    const output = redactSensitiveText(input);
    expect(output).not.toContain("password");
    expect(output).not.toContain("token=secret");
    expect(output).not.toContain(jwt);
    expect(output).toContain("<redacted>");
  });
});
