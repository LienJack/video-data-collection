import { describe, expect, it } from "vitest";
import { canonicalDemoDigest, distributionFromEntries } from "@/scripts/seed-check";

describe("demo seed verification digest", () => {
  it("preserves snake_case lifecycle values independently of postgres key transforms", () => {
    expect(distributionFromEntries([
      ["in_review", 1],
      ["missing_upload", 1],
      ["needs_review", 1],
      ["rework_required", 2],
      ["session_created", 1],
    ])).toEqual({
      in_review: 1,
      missing_upload: 1,
      needs_review: 1,
      rework_required: 2,
      session_created: 1,
    });
  });

  it("is insensitive to object key insertion order", () => {
    expect(canonicalDemoDigest({ participants: 18, content: { locale: "en-US", country: "US" } }))
      .toBe(canonicalDemoDigest({ content: { country: "US", locale: "en-US" }, participants: 18 }));
  });

  it("changes when stable identity, state, timestamp, or content changes", () => {
    const baseline = { id: "fixture-1", status: "active", createdAt: new Date("2026-09-01T00:00:00.000Z"), content: { title: "Brew coffee" } };
    expect(canonicalDemoDigest({ ...baseline, id: "fixture-2" })).not.toBe(canonicalDemoDigest(baseline));
    expect(canonicalDemoDigest({ ...baseline, status: "suspended" })).not.toBe(canonicalDemoDigest(baseline));
    expect(canonicalDemoDigest({ ...baseline, createdAt: new Date("2026-09-02T00:00:00.000Z") })).not.toBe(canonicalDemoDigest(baseline));
    expect(canonicalDemoDigest({ ...baseline, content: { title: "Organize desk" } })).not.toBe(canonicalDemoDigest(baseline));
  });

  it("normalizes Date and bigint values without exposing secrets", () => {
    const digest = canonicalDemoDigest({ timestamp: new Date("2026-09-01T00:00:00.000Z"), bytes: 1024n });
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });
});
