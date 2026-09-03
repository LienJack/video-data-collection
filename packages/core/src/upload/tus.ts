"use client";

import { DetailedError, Upload } from "tus-js-client";

export type TusCredential = {
  uploadPublicId: string;
  attemptPublicId: string;
  objectKey: string;
  tusEndpoint: string;
  signedUploadToken: string;
  expiresAt: string;
  attemptExpiresAt: string;
  chunkSizeBytes: number;
  authMode: "official_signed" | "nas_scoped_jwt";
};

export type TusCallbacks = {
  onProgress: (bytesUploaded: number, bytesTotal: number) => void;
  onChunkComplete: (chunkSize: number, bytesAccepted: number, bytesTotal: number) => void;
  onSuccess: () => void;
  onError: (error: Error, resourceExpired: boolean) => void;
};

export function createTusUpload(
  file: File,
  credential: TusCredential,
  fingerprintV1: string,
  contentType: string,
  callbacks: TusCallbacks,
) {
  return new Upload(file, {
    endpoint: credential.tusEndpoint,
    retryDelays: [0, 1_000, 3_000, 5_000, 10_000, 20_000],
    headers: {
      ...(credential.authMode === "official_signed"
        ? { "x-signature": credential.signedUploadToken }
        : { authorization: `Bearer ${credential.signedUploadToken}` }),
      "x-upsert": "false",
    },
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    chunkSize: credential.chunkSizeBytes,
    metadata: {
      bucketName: "egocapture-raw",
      objectName: credential.objectKey,
      contentType,
      cacheControl: "3600",
    },
    fingerprint: async () => `egocapture:${credential.uploadPublicId}:${fingerprintV1}`,
    onProgress: callbacks.onProgress,
    onChunkComplete: callbacks.onChunkComplete,
    onSuccess: callbacks.onSuccess,
    onError: (error) => {
      const detailed = error instanceof DetailedError ? error : null;
      const status = detailed?.originalResponse?.getStatus();
      callbacks.onError(error, status === 404 || status === 410);
    },
  });
}

export async function startOrResumeTus(
  upload: Upload,
  options: {
    requirePrevious?: boolean;
    discardPrevious?: boolean;
    shouldStart?: () => boolean;
  } = {},
) {
  const previousUploads = await upload.findPreviousUploads();
  if (options.discardPrevious && previousUploads.length > 0) {
    const storage = upload.options.urlStorage;
    if (!storage) throw new Error("TUS_URL_STORAGE_UNAVAILABLE");
    await Promise.all(previousUploads.map((previous) => storage.removeUpload(previous.urlStorageKey)));
    if (options.shouldStart && !options.shouldStart()) throw new Error("TUS_START_CANCELED");
    upload.start();
    return false;
  }
  if (options.requirePrevious && previousUploads.length === 0) {
    throw new Error("TUS_SAVED_RESOURCE_MISSING");
  }
  if (previousUploads.length > 0) {
    upload.resumeFromPreviousUpload(previousUploads[0]);
    // A failed resume must surface to the control plane. Otherwise tus-js-client
    // may silently POST a replacement resource under the old UploadAttempt.
    upload.options.endpoint = null;
  }
  if (options.shouldStart && !options.shouldStart()) throw new Error("TUS_START_CANCELED");
  upload.start();
  return previousUploads.length > 0;
}
