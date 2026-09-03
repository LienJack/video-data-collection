import { randomInt } from "node:crypto";

export const PARTICIPANT_PASSWORD_LENGTH = 16;
export const PARTICIPANT_PASSWORD_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

export type ParticipantCredentialStatus =
  | "missing"
  | "pending_activation"
  | "pending_sync"
  | "ready";

export type ParticipantLoginCredential = {
  username: string;
  password: string | null;
  loginUrl: string;
  version: number;
  status: ParticipantCredentialStatus;
  canLogin: boolean;
  updatedAt: string | null;
  syncedAt: string | null;
};

export function createParticipantPassword(length = PARTICIPANT_PASSWORD_LENGTH): string {
  if (!Number.isSafeInteger(length) || length < 12 || length > 128) {
    throw new RangeError("Participant password length must be between 12 and 128");
  }
  return Array.from(
    { length },
    () => PARTICIPANT_PASSWORD_ALPHABET[randomInt(PARTICIPANT_PASSWORD_ALPHABET.length)],
  ).join("");
}

export function participantCredentialStatus(input: {
  password: string | null;
  authUserId: string | null;
  updatedAt: Date | null;
  syncedAt: Date | null;
}): ParticipantCredentialStatus {
  if (!input.password) return "missing";
  if (!input.authUserId) return "pending_activation";
  if (!input.updatedAt || !input.syncedAt || input.syncedAt < input.updatedAt) return "pending_sync";
  return "ready";
}

export function participantCredentialCanLogin(input: {
  credentialStatus: ParticipantCredentialStatus;
  participantStatus: string;
  consentStatus: string;
}): boolean {
  return input.credentialStatus === "ready"
    && input.participantStatus === "active"
    && input.consentStatus === "valid";
}
