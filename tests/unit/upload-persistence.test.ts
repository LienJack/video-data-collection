import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  legacyPersistedUploadCount,
  migrateLegacyPersistedUpload,
  persistUpload,
  persistedUpload,
  persistedUploads,
  removePersistedUpload,
  updatePersistedUpload,
  type PersistedUpload,
} from "@egocapture/core/upload/persistence";

const manifest: PersistedUpload = {
  version: 2,
  uploadPublicId: "UP-23456789",
  attemptPublicId: "UA-23456789",
  objectKey: "participant/user/upload/id/video.mp4",
  originalFilename: "video.mp4",
  sizeBytes: 12,
  contentType: "video/mp4",
  lastModified: 1_700_000_000_000,
  fingerprintV1: "a".repeat(64),
  sourceSha256: "b".repeat(64),
  claimedSessionPublicId: "RS-23456789",
  unableToDetermine: false,
  acceptedBytes: 0,
  status: "uploading",
  attemptExpiresAt: "2030-01-01T00:00:00.000Z",
  savedAt: "2029-12-31T00:00:00.000Z",
};

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("upload recovery manifest", () => {
  beforeAll(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("lists resumable uploads by their full-file SHA-256", () => {
    persistUpload(manifest);

    expect(persistedUpload(manifest.sourceSha256)).toEqual(manifest);
    expect(persistedUploads()).toEqual([manifest]);
  });

  it("never regresses the provider-accepted byte offset", () => {
    persistUpload({ ...manifest, acceptedBytes: 6 });

    updatePersistedUpload(manifest.sourceSha256, { acceptedBytes: 3, status: "paused" });

    expect(persistedUpload(manifest.sourceSha256)).toMatchObject({
      acceptedBytes: 6,
      status: "paused",
    });
  });

  it("ignores malformed records and removes terminal manifests", () => {
    window.localStorage.setItem("egocapture-upload-v2:not-a-manifest", "{}");
    window.localStorage.setItem(
      "egocapture-upload-v2:terminal",
      JSON.stringify({ ...manifest, sourceSha256: "c".repeat(64), status: "verified" }),
    );
    persistUpload(manifest);

    expect(persistedUploads()).toEqual([manifest]);
    removePersistedUpload(manifest.sourceSha256);
    expect(persistedUploads()).toEqual([]);
  });

  it("migrates a v1 manifest after the original file is reselected", () => {
    window.localStorage.setItem(`egocapture-upload-v1:${manifest.fingerprintV1}`, JSON.stringify({
      uploadPublicId: manifest.uploadPublicId,
      attemptPublicId: manifest.attemptPublicId,
      objectKey: manifest.objectKey,
      originalFilename: manifest.originalFilename,
      sizeBytes: manifest.sizeBytes,
      fingerprintV1: manifest.fingerprintV1,
      claimedSessionPublicId: manifest.claimedSessionPublicId,
      unableToDetermine: manifest.unableToDetermine,
      savedAt: manifest.savedAt,
    }));

    expect(legacyPersistedUploadCount()).toBe(1);
    const migrated = migrateLegacyPersistedUpload(manifest.fingerprintV1, {
      contentType: manifest.contentType,
      lastModified: manifest.lastModified,
      sourceSha256: manifest.sourceSha256,
      originalFilename: manifest.originalFilename,
      sizeBytes: manifest.sizeBytes,
    });

    expect(migrated).toMatchObject({
      version: 2,
      sourceSha256: manifest.sourceSha256,
      acceptedBytes: 0,
      status: "paused",
    });
    expect(legacyPersistedUploadCount()).toBe(0);
    expect(persistedUpload(manifest.sourceSha256)).toEqual(migrated);
  });
});
