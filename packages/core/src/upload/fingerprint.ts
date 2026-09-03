"use client";

export type FileFingerprints = {
  fingerprintV1: string;
  sourceSha256: string;
};

export async function fingerprintFile(file: File): Promise<FileFingerprints> {
  const worker = new Worker(new URL("./fingerprint.worker.ts", import.meta.url));
  const id = crypto.randomUUID();
  return await new Promise<FileFingerprints>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<{
      id: string;
      fingerprintV1?: string;
      sourceSha256?: string;
      error?: string;
    }>) => {
      if (event.data.id !== id) return;
      worker.terminate();
      if (event.data.fingerprintV1 && event.data.sourceSha256) {
        resolve({
          fingerprintV1: event.data.fingerprintV1,
          sourceSha256: event.data.sourceSha256,
        });
      }
      else reject(new Error(event.data.error || "FINGERPRINT_FAILED"));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("FINGERPRINT_WORKER_FAILED"));
    };
    worker.postMessage({ id, file });
  });
}
