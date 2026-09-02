import { describe, expect, it } from "vitest";
import {
  canAcknowledgeAssignment,
  canCancelAssignment,
  statusAfterExtension,
} from "@egocapture/core/domain/assignment";

describe("assignment lifecycle", () => {
  it("allows acknowledgement only from assigned", () => {
    expect(canAcknowledgeAssignment("assigned")).toBe(true);
    expect(canAcknowledgeAssignment("acknowledged")).toBe(false);
    expect(canAcknowledgeAssignment("canceled")).toBe(false);
  });

  it("keeps terminal assignments closed and restores overdue work appropriately", () => {
    expect(canCancelAssignment("submitted")).toBe(true);
    expect(canCancelAssignment("accepted")).toBe(false);
    expect(statusAfterExtension("missing_upload", new Date())).toBe("acknowledged");
    expect(statusAfterExtension("expired", null)).toBe("assigned");
    expect(statusAfterExtension("submitted", new Date())).toBe("submitted");
  });
});
