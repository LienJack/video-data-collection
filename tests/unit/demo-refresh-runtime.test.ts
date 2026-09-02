import { describe, expect, it, vi } from "vitest";
import {
  DEMO_STORAGE_BUCKET,
  EGOCAPTURE_BUSINESS_TABLES,
  EGOCAPTURE_PRESERVED_TABLES,
  resetAllowedMarker,
  type DemoPurgeOperations,
  type DemoRefreshSnapshot,
} from "@/scripts/demo-refresh-guard";
import {
  assertLiveEnvironmentIdentity,
  orchestrateDemoRefresh,
  type DemoRefreshRuntime,
} from "@/scripts/demo-refresh";

const environmentId = "egocapture-nas-interview";
const linkedUserId = "11111111-1111-4111-8111-111111111111";

function beforeSnapshot(): DemoRefreshSnapshot {
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
    tableCounts: Object.fromEntries(EGOCAPTURE_BUSINESS_TABLES.map((table) => [table, table === "profiles" ? 1 : 0])),
    authUsers: [{
      id: linkedUserId,
      email: "participant@egocapture.invalid",
      appMetadata: {},
      userMetadata: {},
    }],
    linkedAuthUserIds: [linkedUserId],
  };
}

function purgedSnapshot(): DemoRefreshSnapshot {
  const before = beforeSnapshot();
  return {
    ...before,
    bucket: { ...before.bucket!, objectNames: [] },
    tableCounts: Object.fromEntries(EGOCAPTURE_BUSINESS_TABLES.map((table) => [table, 0])),
    authUsers: [],
    linkedAuthUserIds: [],
  };
}

function purgeOperations(events: string[] = []): DemoPurgeOperations {
  return {
    deleteStorageObjects: async () => { events.push("storage"); },
    truncateBusinessTables: async () => { events.push("database"); },
    deleteAuthUser: async () => { events.push("delete-auth"); return "deleted"; },
  };
}

describe("demo refresh runtime orchestration", () => {
  it("validates configuration before a live client is used", () => {
    const base = {
      databaseUrl: "postgresql://postgres:secret@127.0.0.1:56522/postgres",
      supabaseUrl: "http://127.0.0.1:56521",
      tusEndpoint: "http://127.0.0.1:56521/storage/v1/upload/resumable",
      serviceRoleKey: "not-used",
      participantSiteUrl: "http://localhost:3000",
      adminSiteUrl: "http://localhost:3001",
      markerPublicKeyJwk: {},
      markerKeyId: "key",
      cronSecret: "not-used",
      demoAdminUsername: "admin",
      demoAdminEmail: "admin@egocapture.invalid",
      demoAdminPassword: "not-used",
      demoParticipantPassword: "not-used",
      environmentId,
      resetAllowedMarker: undefined,
      seedAnchor: undefined,
    };
    expect(() => assertLiveEnvironmentIdentity(base)).not.toThrow();
    expect(() => assertLiveEnvironmentIdentity({
      ...base,
      environmentId: "egocapture-local-mac",
    })).toThrow(/approved EgoCapture NAS/);
    expect(() => assertLiveEnvironmentIdentity({
      ...base,
      databaseUrl: "postgresql://postgres:secret@127.0.0.1:54322/text2sql",
    })).toThrow(/database name/);
  });

  it("keeps default inspect read-only", async () => {
    const writes: string[] = [];
    const operationsFor = vi.fn(() => purgeOperations());
    const seed = vi.fn(async () => undefined);
    const verify = vi.fn(async () => undefined);
    const runtime: DemoRefreshRuntime = {
      inspect: vi.fn(async () => beforeSnapshot()),
      operationsFor,
      seed,
      verify,
      write: (line) => writes.push(line),
    };
    const result = await orchestrateDemoRefresh(
      { mode: "inspect" },
      environmentId,
      undefined,
      runtime,
    );
    expect(result.executed).toBe(false);
    expect(runtime.inspect).toHaveBeenCalledTimes(1);
    expect(operationsFor).not.toHaveBeenCalled();
    expect(seed).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(writes.some((line) => line.startsWith("Tables: asset_files="))).toBe(true);
  });

  it("runs seed and verification only after a verified purge", async () => {
    const events: string[] = [];
    const inspect = vi.fn()
      .mockResolvedValueOnce(beforeSnapshot())
      .mockResolvedValueOnce(purgedSnapshot());
    const runtime: DemoRefreshRuntime = {
      inspect,
      operationsFor: () => purgeOperations(events),
      seed: async (anchor) => { events.push(`seed:${anchor}`); },
      verify: async (anchor) => { events.push(`verify:${anchor}`); },
      write: () => undefined,
    };
    const result = await orchestrateDemoRefresh(
      { mode: "execute", confirm: environmentId, anchor: "2026-09-03T00:00:00.000Z" },
      environmentId,
      resetAllowedMarker(environmentId),
      runtime,
    );
    expect(result.executed).toBe(true);
    expect(events).toEqual([
      "storage",
      "database",
      "delete-auth",
      "seed:2026-09-03T00:00:00.000Z",
      "verify:2026-09-03T00:00:00.000Z",
    ]);
  });

  it("does not seed after a purge or post-purge verification failure", async () => {
    const seedAfterPurgeFailure = vi.fn(async () => undefined);
    const purgeFailureRuntime: DemoRefreshRuntime = {
      inspect: vi.fn(async () => beforeSnapshot()),
      operationsFor: () => ({
        ...purgeOperations(),
        truncateBusinessTables: async () => { throw new Error("purge failed"); },
      }),
      seed: seedAfterPurgeFailure,
      verify: vi.fn(async () => undefined),
      write: () => undefined,
    };
    await expect(orchestrateDemoRefresh(
      { mode: "execute", confirm: environmentId },
      environmentId,
      resetAllowedMarker(environmentId),
      purgeFailureRuntime,
    )).rejects.toThrow(/purge failed/);
    expect(seedAfterPurgeFailure).not.toHaveBeenCalled();

    const seedAfterVerificationFailure = vi.fn(async () => undefined);
    const verificationFailureRuntime: DemoRefreshRuntime = {
      inspect: vi.fn(async () => beforeSnapshot()),
      operationsFor: () => purgeOperations(),
      seed: seedAfterVerificationFailure,
      verify: vi.fn(async () => undefined),
      write: () => undefined,
    };
    await expect(orchestrateDemoRefresh(
      { mode: "execute", confirm: environmentId },
      environmentId,
      resetAllowedMarker(environmentId),
      verificationFailureRuntime,
    )).rejects.toThrow(/purge verification/);
    expect(seedAfterVerificationFailure).not.toHaveBeenCalled();
  });
});
