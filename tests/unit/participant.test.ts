import { describe, expect, it } from "vitest";
import { canStartParticipantActivity, canTransitionParticipant } from "@egocapture/core/domain/participant";

describe("participant lifecycle", () => {
  it("allows only the declared lifecycle edges", () => {
    expect(canTransitionParticipant("draft", "invited")).toBe(true);
    expect(canTransitionParticipant("invited", "expired")).toBe(true);
    expect(canTransitionParticipant("expired", "invited")).toBe(true);
    expect(canTransitionParticipant("active", "suspended")).toBe(true);
    expect(canTransitionParticipant("suspended", "active")).toBe(true);
    expect(canTransitionParticipant("withdrawn", "active")).toBe(false);
    expect(canTransitionParticipant("draft", "active")).toBe(false);
  });

  it("requires active status and valid consent for new activity", () => {
    expect(canStartParticipantActivity("active", "valid")).toBe(true);
    expect(canStartParticipantActivity("suspended", "valid")).toBe(false);
    expect(canStartParticipantActivity("active", "expired")).toBe(false);
  });
});
