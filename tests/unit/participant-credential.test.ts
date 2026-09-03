import { describe, expect, it } from "vitest";
import {
  createParticipantPassword,
  PARTICIPANT_PASSWORD_ALPHABET,
  PARTICIPANT_PASSWORD_LENGTH,
  participantCredentialCanLogin,
  participantCredentialStatus,
} from "@egocapture/core/domain/participant-credential";

describe("participant login credentials", () => {
  it("generates non-deterministic 16-character passwords from the unambiguous alphabet", () => {
    const generated = new Set(Array.from({ length: 16 }, () => createParticipantPassword()));
    expect(generated.size).toBeGreaterThan(1);
    for (const password of generated) {
      expect(password).toHaveLength(PARTICIPANT_PASSWORD_LENGTH);
      expect([...password].every((character) => PARTICIPANT_PASSWORD_ALPHABET.includes(character))).toBe(true);
      expect(password).not.toMatch(/[01IOol]/);
    }
  });

  it("rejects lengths outside the database contract", () => {
    expect(() => createParticipantPassword(11)).toThrow(RangeError);
    expect(() => createParticipantPassword(129)).toThrow(RangeError);
  });

  it("derives missing, activation, synchronization, and ready states", () => {
    const updatedAt = new Date("2026-09-02T00:00:00.000Z");
    expect(participantCredentialStatus({ password: null, authUserId: null, updatedAt: null, syncedAt: null })).toBe("missing");
    expect(participantCredentialStatus({ password: "A".repeat(16), authUserId: null, updatedAt, syncedAt: null })).toBe("pending_activation");
    expect(participantCredentialStatus({ password: "A".repeat(16), authUserId: "auth-user", updatedAt, syncedAt: null })).toBe("pending_sync");
    expect(participantCredentialStatus({
      password: "A".repeat(16),
      authUserId: "auth-user",
      updatedAt,
      syncedAt: new Date("2026-09-02T00:00:01.000Z"),
    })).toBe("ready");
  });

  it("only permits login for synced credentials on an active consented participant", () => {
    expect(participantCredentialCanLogin({
      credentialStatus: "ready",
      participantStatus: "active",
      consentStatus: "valid",
    })).toBe(true);
    expect(participantCredentialCanLogin({
      credentialStatus: "ready",
      participantStatus: "suspended",
      consentStatus: "valid",
    })).toBe(false);
    expect(participantCredentialCanLogin({
      credentialStatus: "pending_sync",
      participantStatus: "active",
      consentStatus: "valid",
    })).toBe(false);
  });
});
