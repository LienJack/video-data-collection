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
    onSuccess: callbacks.onSuccess,
    onError: (error) => {
      const detailed = error instanceof DetailedError ? error : null;
      const status = detailed?.originalResponse?.getStatus();
      callbacks.onError(error, status === 404 || status === 410);
    },
  });
}

export async function startOrResumeTus(upload: Upload) {
  const previousUploads = await upload.findPreviousUploads();
  if (previousUploads.length > 0) upload.resumeFromPreviousUpload(previousUploads[0]);
  upload.start();
  return previousUploads.length > 0;
}
