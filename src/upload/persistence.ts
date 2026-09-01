"use client";

export type PersistedUpload = {
  uploadPublicId: string;
  attemptPublicId: string;
  objectKey: string;
  originalFilename: string;
  sizeBytes: number;
  fingerprintV1: string;
  claimedSessionPublicId: string | null;
  unableToDetermine: boolean;
  savedAt: string;
};

const PREFIX = "egocapture-upload-v1:";

export function persistedUpload(fingerprintV1: string): PersistedUpload | null {
  try {
    const value = localStorage.getItem(`${PREFIX}${fingerprintV1}`);
    return value ? JSON.parse(value) as PersistedUpload : null;
  } catch {
    return null;
  }
}

export function persistUpload(upload: PersistedUpload) {
  localStorage.setItem(`${PREFIX}${upload.fingerprintV1}`, JSON.stringify(upload));
}

export function removePersistedUpload(fingerprintV1: string) {
  localStorage.removeItem(`${PREFIX}${fingerprintV1}`);
}

export function persistedUploadCount() {
  return Object.keys(localStorage).filter((key) => key.startsWith(PREFIX)).length;
}
