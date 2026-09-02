import { describe, expect, it } from "vitest";
import { DomainError } from "@egocapture/core/domain/errors";
import { decodeCreatedAtCursor, encodeCreatedAtCursor } from "@egocapture/core/server/cursor";

describe("opaque created-at cursor", () => {
  it("round-trips the stable timestamp and tie-breaker", () => {
    const encoded = encodeCreatedAtCursor({
      createdAt: new Date("2026-09-02T12:34:56.789Z"),
      publicId: "UP-23456789",
    });

    expect(encoded).not.toContain("2026-09-02");
    expect(decodeCreatedAtCursor(encoded)).toEqual({
      createdAt: "2026-09-02T12:34:56.789Z",
      publicId: "UP-23456789",
    });
  });

  it("rejects malformed cursors as a domain validation error", () => {
    expect(() => decodeCreatedAtCursor("not-a-cursor")).toThrowError(DomainError);
  });
});
