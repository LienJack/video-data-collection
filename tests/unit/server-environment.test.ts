import { afterEach, describe, expect, it, vi } from "vitest";

const BASE_ENVIRONMENT = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(32),
  NEXT_PUBLIC_STORAGE_TUS_ENDPOINT: "https://abcdefghijklmnopqrst.storage.supabase.co/storage/v1/upload/resumable/sign",
  SUPABASE_SERVICE_ROLE_KEY: "b".repeat(32),
  SUPABASE_JWT_SECRET: "c".repeat(32),
  STORAGE_UPLOAD_AUTH_MODE: "official_signed",
  DATABASE_URL: "postgresql://postgres.abcdefghijklmnopqrst:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
  PARTICIPANT_SITE_URL: "https://participant.example.com",
  ADMIN_SITE_URL: "https://admin.example.com",
  MARKER_PRIVATE_KEY_JWK: "{}",
  MARKER_PUBLIC_KEY_JWK: "{}",
  MARKER_KEY_ID: "demo-key",
  DEVICE_SERIAL_HMAC_KEY: "d".repeat(32),
  CRON_SECRET: "e".repeat(32),
  DEMO_ADMIN_USERNAME: "admin",
  DEMO_ADMIN_EMAIL: "admin@example.com",
  DEMO_ADMIN_PASSWORD: "password",
  DEMO_PARTICIPANT_PASSWORD: "participant-password",
} as const;

async function parseEnvironment(overrides: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE_ENVIRONMENT, ...overrides })) {
    vi.stubEnv(key, value);
  }
  const { serverEnvironment } = await import("@egocapture/core/server/env");
  return serverEnvironment();
}

describe("serverEnvironment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts the official signed upload mode for Supabase Cloud", async () => {
    await expect(parseEnvironment()).resolves.toMatchObject({
      STORAGE_UPLOAD_AUTH_MODE: "official_signed",
    });
  });

  it("rejects the NAS scoped JWT mode for Supabase Cloud", async () => {
    await expect(parseEnvironment({ STORAGE_UPLOAD_AUTH_MODE: "nas_scoped_jwt" }))
      .rejects.toThrow(/Supabase Cloud 必须使用 official_signed/);
  });

  it("rejects a missing public Storage endpoint", async () => {
    await expect(parseEnvironment({ NEXT_PUBLIC_STORAGE_TUS_ENDPOINT: "" }))
      .rejects.toThrow(/NEXT_PUBLIC_STORAGE_TUS_ENDPOINT/);
  });

  it("reports an invalid Supabase URL through the environment schema", async () => {
    await expect(parseEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }))
      .rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("keeps the NAS scoped JWT mode available for the supervised local profile", async () => {
    await expect(parseEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:56521",
      NEXT_PUBLIC_STORAGE_TUS_ENDPOINT: "http://127.0.0.1:56521/storage/v1/upload/resumable",
      DATABASE_URL: "postgresql://postgres:password@127.0.0.1:56522/postgres",
      PARTICIPANT_SITE_URL: "http://127.0.0.1:3000",
      ADMIN_SITE_URL: "http://127.0.0.1:3001",
      STORAGE_UPLOAD_AUTH_MODE: "nas_scoped_jwt",
    })).resolves.toMatchObject({
      STORAGE_UPLOAD_AUTH_MODE: "nas_scoped_jwt",
    });
  });
});
