import { describe, expect, it, vi } from "vitest";
import type { Upload } from "tus-js-client";
import { createTusUpload, startOrResumeTus } from "@egocapture/core/upload/tus";

describe("TUS resume", () => {
  it("keeps the existing UploadIntent fingerprint key for v1 resume compatibility", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "video.mp4", { type: "video/mp4" });
    const upload = createTusUpload(file, {
      uploadPublicId: "UP-23456789",
      attemptPublicId: "UA-23456789",
      objectKey: "participant/id/upload/id/video.mp4",
      tusEndpoint: "https://storage.example/upload/resumable",
      signedUploadToken: "signed",
      expiresAt: "2030-01-01T00:00:00.000Z",
      attemptExpiresAt: "2030-01-02T00:00:00.000Z",
      chunkSizeBytes: 6 * 1024 * 1024,
      authMode: "official_signed",
    }, "f".repeat(64), "video/mp4", {
      onProgress: vi.fn(),
      onChunkComplete: vi.fn(),
      onError: vi.fn(),
      onSuccess: vi.fn(),
    });

    expect(await upload.options.fingerprint?.(file, upload.options)).toBe(
      `egocapture:UP-23456789:${"f".repeat(64)}`,
    );
  });

  it("does not silently replace an expired saved resource during resume", async () => {
    const previous = {
      size: 12,
      metadata: {},
      creationTime: "2030-01-01T00:00:00.000Z",
      urlStorageKey: "saved-resource",
      uploadUrl: "https://storage.example/upload/1",
      parallelUploadUrls: null,
    };
    const upload = {
      options: { endpoint: "https://storage.example/upload/resumable" },
      findPreviousUploads: vi.fn().mockResolvedValue([previous]),
      resumeFromPreviousUpload: vi.fn(),
      start: vi.fn(),
    } as unknown as Upload;

    expect(await startOrResumeTus(upload)).toBe(true);
    expect(upload.resumeFromPreviousUpload).toHaveBeenCalledWith(previous);
    expect(upload.options.endpoint).toBeNull();
    expect(upload.start).toHaveBeenCalledOnce();
  });

  it("refuses a zero-byte restart when a saved Attempt has lost its TUS URL", async () => {
    const upload = {
      options: { endpoint: "https://storage.example/upload/resumable" },
      findPreviousUploads: vi.fn().mockResolvedValue([]),
      resumeFromPreviousUpload: vi.fn(),
      start: vi.fn(),
    } as unknown as Upload;

    await expect(startOrResumeTus(upload, { requirePrevious: true })).rejects.toThrow(
      "TUS_SAVED_RESOURCE_MISSING",
    );
    expect(upload.start).not.toHaveBeenCalled();
  });

  it("discards a previous resource before a replacement Attempt starts", async () => {
    const previous = {
      size: 12,
      metadata: {},
      creationTime: "2030-01-01T00:00:00.000Z",
      urlStorageKey: "old-attempt",
      uploadUrl: "https://storage.example/upload/old",
      parallelUploadUrls: null,
    };
    const removeUpload = vi.fn().mockResolvedValue(undefined);
    const upload = {
      options: {
        endpoint: "https://storage.example/upload/resumable",
        urlStorage: { removeUpload },
      },
      findPreviousUploads: vi.fn().mockResolvedValue([previous]),
      resumeFromPreviousUpload: vi.fn(),
      start: vi.fn(),
    } as unknown as Upload;

    expect(await startOrResumeTus(upload, { discardPrevious: true })).toBe(false);
    expect(removeUpload).toHaveBeenCalledWith("old-attempt");
    expect(upload.resumeFromPreviousUpload).not.toHaveBeenCalled();
    expect(upload.start).toHaveBeenCalledOnce();
  });

  it("does not start after the owning workflow has been canceled", async () => {
    const upload = {
      options: { endpoint: "https://storage.example/upload/resumable" },
      findPreviousUploads: vi.fn().mockResolvedValue([]),
      resumeFromPreviousUpload: vi.fn(),
      start: vi.fn(),
    } as unknown as Upload;

    await expect(startOrResumeTus(upload, { shouldStart: () => false })).rejects.toThrow(
      "TUS_START_CANCELED",
    );
    expect(upload.start).not.toHaveBeenCalled();
  });
});
