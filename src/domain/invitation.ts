import { createHash, randomBytes } from "node:crypto";

export const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

export function createInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest();
}

export function invitationExpiresAt(now = new Date()) {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

export function internalParticipantEmail(publicId: string) {
  return `egocapture-${publicId.toLowerCase()}@demo.invalid`;
}
