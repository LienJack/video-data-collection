import { randomBytes } from "node:crypto";
import {
  importJWK,
  jwtVerify,
  SignJWT,
  type JWK,
  type JWTPayload,
} from "jose";
import { z } from "zod";
import { MARKER_TTL_SECONDS } from "@egocapture/core/domain/constants";

export const markerPayloadSchema = z.object({
  v: z.literal(1),
  session_public_id: z.string().regex(/^RS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/),
  assignment_public_id: z.string().regex(/^AS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/),
  device_public_id: z.string().regex(/^DEV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/),
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{22,64}$/),
});

export type MarkerPayload = z.infer<typeof markerPayloadSchema>;

export function createMarkerPayload(input: {
  sessionPublicId: string;
  assignmentPublicId: string;
  devicePublicId: string;
  now?: Date;
}): MarkerPayload {
  const issuedAt = input.now ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + MARKER_TTL_SECONDS * 1000);
  return markerPayloadSchema.parse({
    v: 1,
    session_public_id: input.sessionPublicId,
    assignment_public_id: input.assignmentPublicId,
    device_public_id: input.devicePublicId,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    nonce: randomBytes(18).toString("base64url"),
  });
}

export async function signMarkerPayload(payload: MarkerPayload, privateJwk: JWK, keyId: string) {
  const validated = markerPayloadSchema.parse(payload);
  const key = await importJWK(privateJwk, "EdDSA");
  return await new SignJWT(validated as unknown as JWTPayload)
    .setProtectedHeader({ alg: "EdDSA", kid: keyId, typ: "JWT" })
    .sign(key);
}

export async function verifyMarkerJws(jws: string, publicJwk: JWK, expectedKeyId: string) {
  const key = await importJWK(publicJwk, "EdDSA");
  const { payload, protectedHeader } = await jwtVerify(jws, key, { algorithms: ["EdDSA"] });
  if (protectedHeader.kid !== expectedKeyId || protectedHeader.typ !== "JWT") {
    throw new Error("MARKER_HEADER_INVALID");
  }
  return markerPayloadSchema.parse(payload);
}

export function markerUri(jws: string) {
  return `egocapture://marker/${jws}`;
}

export function markerShortCode(sessionPublicId: string) {
  return sessionPublicId.replace(/^RS-/, "");
}
