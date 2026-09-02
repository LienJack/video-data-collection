import { describe, expect, it } from "vitest";
import {
  createUploadIntentInputSchema,
  createUploadObjectKey,
  fingerprintV1,
  sanitizeOriginalFilename,
  uploadMetadata,
} from "@egocapture/core/domain/upload";

describe("upload domain", () => {
  it("sanitizes path fragments and control characters from display filenames", () => {
    expect(sanitizeOriginalFilename("../private\\camera\u0000.mp4")).toBe("camera.mp4");
    expect([...sanitizeOriginalFilename("a".repeat(300))]).toHaveLength(255);
  });

  it("requires an exact extension, MIME and Session-choice contract", () => {
    const valid = {
      batchPublicId: "UB-23456789",
      originalFilename: "clip.mp4",
      sizeBytes: 1,
      contentType: "video/mp4",
      extension: "mp4",
      localModifiedAt: null,
      claimedSessionPublicId: "RS-23456789",
      unableToDetermine: false,
      fingerprintV1: "a".repeat(64),
    };
    expect(createUploadIntentInputSchema.safeParse(valid).success).toBe(true);
    expect(createUploadIntentInputSchema.safeParse({ ...valid, contentType: "video/quicktime" }).success).toBe(false);
    expect(createUploadIntentInputSchema.safeParse({ ...valid, claimedSessionPublicId: null }).success).toBe(false);
    expect(createUploadIntentInputSchema.safeParse({ ...valid, unableToDetermine: true }).success).toBe(false);
  });

  it("creates an opaque object key without display identifiers", () => {
    const objectKey = createUploadObjectKey({
      studyId: "11111111-1111-4111-8111-111111111111",
      participantId: "22222222-2222-4222-8222-222222222222",
      uploadId: "33333333-3333-4333-8333-333333333333",
      extension: "mp4",
    });
    expect(objectKey).toMatch(/^study\/11111111-1111-4111-8111-111111111111\/participant\/22222222-2222-4222-8222-222222222222\/upload\/33333333-3333-4333-8333-333333333333\/[0-9a-f-]{36}\.mp4$/);
    expect(objectKey).not.toMatch(/PT-|clip|alias/i);
  });

  it("defines fingerprint_v1 using an unsigned 64-bit big-endian size prefix", () => {
    expect(fingerprintV1(3, new Uint8Array([1, 2]), new Uint8Array([3]))).toBe(
      "b070698d25c7754918e53fd317b4fe4feddb041a79c78d35d5c8dd6e135fa745",
    );
  });

  it("uses only allowlisted TUS metadata", () => {
    expect(uploadMetadata("study/a/video.mp4", "video/mp4")).toEqual({
      bucketName: "egocapture-raw",
      objectName: "study/a/video.mp4",
      contentType: "video/mp4",
      cacheControl: "3600",
    });
  });
});
