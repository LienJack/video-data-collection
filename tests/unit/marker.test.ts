import { exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import {
  createMarkerPayload,
  markerShortCode,
  markerUri,
  signMarkerPayload,
  verifyMarkerJws,
} from "@/src/domain/marker";

describe("signed session marker", () => {
  it("signs and verifies the exact non-PII payload with Ed25519", async () => {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", { extractable: true });
    const payload = createMarkerPayload({
      sessionPublicId: "RS-AB234567",
      assignmentPublicId: "AS-CD234567",
      devicePublicId: "DEV-EF234567",
      now: new Date("2026-09-01T00:00:00.000Z"),
    });
    const jws = await signMarkerPayload(payload, await exportJWK(privateKey), "marker-key-v1");
    await expect(verifyMarkerJws(jws, await exportJWK(publicKey), "marker-key-v1")).resolves.toEqual(payload);
    expect(markerUri(jws)).toBe(`egocapture://marker/${jws}`);
    expect(markerShortCode(payload.session_public_id)).toBe("AB234567");
    expect(JSON.stringify(payload)).not.toMatch(/email|name|study/i);
  });

  it("rejects tampering and an unexpected key id", async () => {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", { extractable: true });
    const payload = createMarkerPayload({
      sessionPublicId: "RS-AB234567",
      assignmentPublicId: "AS-CD234567",
      devicePublicId: "DEV-EF234567",
    });
    const jws = await signMarkerPayload(payload, await exportJWK(privateKey), "marker-key-v1");
    const [header, body, signature] = jws.split(".");
    const changedFirstByte = signature.startsWith("A") ? "B" : "A";
    const tampered = `${header}.${body}.${changedFirstByte}${signature.slice(1)}`;
    await expect(verifyMarkerJws(tampered, await exportJWK(publicKey), "marker-key-v1")).rejects.toThrow();
    await expect(verifyMarkerJws(jws, await exportJWK(publicKey), "marker-key-v2")).rejects.toThrow("MARKER_HEADER_INVALID");
  });
});
