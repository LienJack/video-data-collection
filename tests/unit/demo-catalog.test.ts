import { describe, expect, it } from "vitest";
import {
  buildDemoCatalog,
  DEMO_CATALOG,
  DEMO_SEED_ANCHOR,
  demoTime,
  stableDemoPublicId,
  stableDemoUuid,
  validateDemoCatalog,
} from "@/scripts/fixtures/demo-catalog";

describe("deterministic demo catalog", () => {
  it("contains exactly six natural fictional identities per supported region", () => {
    expect(DEMO_CATALOG.people).toHaveLength(18);
    expect(Object.fromEntries(DEMO_CATALOG.regions.map((region) => [
      region.countryCode,
      DEMO_CATALOG.people.filter((person) => person.region.key === region.key).length,
    ]))).toEqual({ CN: 6, US: 6, JP: 6 });
    expect(DEMO_CATALOG.people.map((person) => person.displayAlias)).toEqual([
      "林晓雨", "陈思远", "周子涵", "王静怡", "刘晨", "赵嘉宁",
      "Emily Carter", "Michael Johnson", "Olivia Martinez", "Daniel Wilson", "Sophia Brown", "Ethan Davis",
      "佐藤 美咲", "鈴木 健太", "高橋 葵", "田中 悠斗", "伊藤 結衣", "渡辺 翔太",
    ]);
  });

  it("defines one login for each locale and a separate admin identity", () => {
    const logins = DEMO_CATALOG.people.filter((person) => person.login);
    expect(logins.map((person) => person.region.locale)).toEqual(["zh-CN", "en-US", "ja-JP"]);
    expect(logins.every((person) => person.profileId && person.status === "active" && person.consentStatus === "valid")).toBe(true);
    expect(DEMO_CATALOG.admin).toMatchObject({
      displayName: "EgoCapture Demo Admin",
      emailEnv: "DEMO_ADMIN_EMAIL",
      passwordEnv: "DEMO_ADMIN_PASSWORD",
    });
  });

  it("derives stable UUIDs, public ids, and chronology from one fixed anchor", () => {
    expect(stableDemoUuid("participant", "cn-lin-xiaoyu")).toBe("d40bc519-eab7-5e9b-93b2-497103b4641e");
    expect(stableDemoPublicId("PT", "cn-lin-xiaoyu")).toBe("PT-5YTSMK53SU");
    expect(demoTime(DEMO_SEED_ANCHOR, -1, 3)).toBe("2026-08-31T03:00:00.000Z");
    expect(buildDemoCatalog(DEMO_SEED_ANCHOR)).toEqual(DEMO_CATALOG);
    expect(DEMO_CATALOG.people.filter((person) => person.withdrawnAt).every((person) => person.withdrawnAt! < DEMO_SEED_ANCHOR)).toBe(true);
    expect(() => demoTime("2026-09-01", 0)).toThrow("Invalid DEMO_SEED_ANCHOR");
  });

  it("uses real regional mappings and realistic device models without serials", () => {
    expect(DEMO_CATALOG.regions).toEqual([
      { key: "cn", countryCode: "CN", locale: "zh-CN", timezone: "Asia/Shanghai" },
      { key: "us", countryCode: "US", locale: "en-US", timezone: "America/Los_Angeles" },
      { key: "jp", countryCode: "JP", locale: "ja-JP", timezone: "Asia/Tokyo" },
    ]);
    expect(DEMO_CATALOG.devices).toHaveLength(12);
    expect(new Set(DEMO_CATALOG.devices.map((device) => device.status))).toEqual(new Set(["active", "lost", "shared", "retired"]));
    expect(DEMO_CATALOG.devices.map(({ manufacturer, model }) => `${manufacturer} ${model}`)).toContain("Apple iPhone 15 Pro");
    expect(DEMO_CATALOG.devices.every((device) => !("serial" in device))).toBe(true);
  });

  it("covers required business scenarios and validates every lifecycle state through shared machines", () => {
    expect(new Set(DEMO_CATALOG.tasks.map((task) => task.lifecycle))).toEqual(new Set(["draft", "active", "archived"]));
    expect(DEMO_CATALOG.tasks).toHaveLength(7);
    expect(DEMO_CATALOG.tasks.filter((task) => task.versionId)).toHaveLength(6);
    expect(DEMO_CATALOG.scenarios).toHaveLength(12);
    expect(new Set(DEMO_CATALOG.scenarios.map((scenario) => scenario.kind))).toEqual(new Set([
      "healthy", "pending_review", "missing_upload", "device_mismatch", "failed_retry", "coverage",
    ]));
    expect(new Set(DEMO_CATALOG.scenarios.map((scenario) => scenario.assignmentStatus))).toEqual(new Set([
      "accepted", "needs_review", "missing_upload", "rework_required", "uploading", "submitted",
      "acknowledged", "session_created", "assigned", "expired", "canceled",
    ]));
    expect(DEMO_CATALOG.scenarios.flatMap((scenario) => scenario.uploadAttemptStatuses ?? [])).toEqual(expect.arrayContaining(["completed", "failed", "paused", "expired"]));
    expect(new Set(DEMO_CATALOG.scenarios.flatMap((scenario) => scenario.reviewStatus ? [scenario.reviewStatus] : []))).toEqual(new Set(["open", "in_review", "resolved", "dismissed"]));
    expect(DEMO_CATALOG.scenarios.some((scenario) => scenario.transferStatus === "failed")).toBe(true);
    expect(JSON.stringify(DEMO_CATALOG)).not.toMatch(/Participant Demo|Demo Region|Synthetic Demo Phone/);
    expect(() => validateDemoCatalog(DEMO_CATALOG)).not.toThrow();
  });

  it("rejects collisions and incomplete scenario dependency chains before seeding", () => {
    const duplicateIdentity = structuredClone(DEMO_CATALOG);
    Object.assign(duplicateIdentity.scenarios[1]!, {
      assignmentId: duplicateIdentity.scenarios[0]!.assignmentId,
    });
    expect(() => validateDemoCatalog(duplicateIdentity)).toThrow(/identifiers must be unique/);

    const incompleteChain = structuredClone(DEMO_CATALOG);
    Object.assign(incompleteChain.scenarios[0]!, { uploadIntentId: null });
    expect(() => validateDemoCatalog(incompleteChain)).toThrow(/child identity|dependency chain/);
  });
});
