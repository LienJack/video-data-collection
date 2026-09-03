import { describe, expect, it } from "vitest";
import {
  assertFixtureAuthIdentityAvailable,
  assertInternalDemoEmail,
} from "@/scripts/seed";

describe("demo seed Auth guards", () => {
  const input = {
    email: "egocapture-pt-example@demo.invalid",
    role: "participant" as const,
    catalogKey: "cn-lin-xiaoyu",
  };

  it("accepts only reserved .invalid addresses", () => {
    expect(() => assertInternalDemoEmail(input.email)).not.toThrow();
    expect(() => assertInternalDemoEmail("person@example.com")).toThrow(/reserved \.invalid/);
    expect(() => assertInternalDemoEmail("invalid-address")).toThrow(/reserved \.invalid/);
  });

  it("reuses only the exact fixture email, catalog key, and role", () => {
    const exact = {
      email: input.email,
      user_metadata: {
        egocapture_fixture: true,
        egocapture_catalog_key: input.catalogKey,
        egocapture_role: input.role,
      },
    };
    expect(assertFixtureAuthIdentityAvailable([exact], input)).toBe(exact);
    expect(() => assertFixtureAuthIdentityAvailable([{
      ...exact,
      email: "different@demo.invalid",
    }], input)).toThrow(/catalog identity collision/);
    expect(() => assertFixtureAuthIdentityAvailable([{
      ...exact,
      user_metadata: { ...exact.user_metadata, egocapture_role: "admin" },
    }], input)).toThrow(/Auth identity collision/);
    expect(() => assertFixtureAuthIdentityAvailable([exact, { ...exact }], input)).toThrow(/identity collision|duplicate Auth email/);
  });
});
