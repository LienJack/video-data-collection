import { describe, expect, it } from "vitest";
import {
  createInvitationToken,
  hashInvitationToken,
  internalParticipantEmail,
  invitationExpiresAt,
} from "@egocapture/core/domain/invitation";

describe("participant invitations", () => {
  it("stores only a deterministic 32-byte SHA-256 digest", () => {
    const first = createInvitationToken();
    const second = createInvitationToken();
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toHaveLength(32);
    expect(hashInvitationToken(first.token)).toEqual(first.tokenHash);
    expect(first.tokenHash.toString("base64url")).not.toBe(first.token);
  });

  it("expires after 24 hours and maps public ID to an internal-only email", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    expect(invitationExpiresAt(now).toISOString()).toBe("2026-09-02T00:00:00.000Z");
    expect(internalParticipantEmail("PT-AB234567")).toBe("egocapture-pt-ab234567@demo.invalid");
  });
});
