import { describe, expect, it } from "vitest";
import {
  advanceUploadAttemptProgress,
  createUploadIntentInputSchema,
  createUploadObjectKey,
  fingerprintV1,
  sanitizeOriginalFilename,
  updateUploadAttemptProgressInputSchema,
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
      participantId: "22222222-2222-4222-8222-222222222222",
      uploadId: "33333333-3333-4333-8333-333333333333",
      extension: "mp4",
    });
    expect(objectKey).toMatch(/^participant\/22222222-2222-4222-8222-222222222222\/upload\/33333333-3333-4333-8333-333333333333\/[0-9a-f-]{36}\.mp4$/);
    expect(objectKey).not.toMatch(/PT-|clip|alias/i);
  });

  it("defines fingerprint_v1 using an unsigned 64-bit big-endian size prefix", () => {
    expect(fingerprintV1(3, new Uint8Array([1, 2]), new Uint8Array([3]))).toBe(
      "b070698d25c7754918e53fd317b4fe4feddb041a79c78d35d5c8dd6e135fa745",
    );
  });

  it("uses only allowlisted TUS metadata", () => {
    expect(uploadMetadata("participant/a/video.mp4", "video/mp4")).toEqual({
      bucketName: "egocapture-raw",
      objectName: "participant/a/video.mp4",
      contentType: "video/mp4",
      cacheControl: "3600",
    });
  });

  it("accepts only bounded active-attempt progress updates", () => {
    expect(updateUploadAttemptProgressInputSchema.safeParse({
      bytesUploaded: 6,
      status: "paused",
    }).success).toBe(true);
    expect(updateUploadAttemptProgressInputSchema.safeParse({
      bytesUploaded: -1,
      status: "uploading",
    }).success).toBe(false);
    expect(updateUploadAttemptProgressInputSchema.safeParse({
      bytesUploaded: 6,
      status: "completed",
    }).success).toBe(false);
  });

  it("advances an Attempt offset monotonically within the declared file size", () => {
    expect(advanceUploadAttemptProgress(6, 12, 12)).toBe(12);
    expect(() => advanceUploadAttemptProgress(6, 3, 12)).toThrow("不能小于服务端已记录进度");
    expect(() => advanceUploadAttemptProgress(6, 13, 12)).toThrow("不能超过文件大小");
  });
});
