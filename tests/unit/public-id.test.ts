import { describe, expect, it } from "vitest";
import { createPublicId, isPublicId } from "@egocapture/core/domain/public-id";

describe("public ids", () => {
  it("creates prefixed, non-ambiguous ids", () => {
    const value = createPublicId("PT");
    expect(value).toMatch(/^PT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    expect(isPublicId(value, "PT")).toBe(true);
    expect(isPublicId(value, "DEV")).toBe(false);
  });
});
