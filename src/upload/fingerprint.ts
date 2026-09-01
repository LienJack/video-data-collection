"use client";

export async function fingerprintFile(file: File): Promise<string> {
  const worker = new Worker(new URL("./fingerprint.worker.ts", import.meta.url));
  const id = crypto.randomUUID();
  return await new Promise<string>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<{ id: string; fingerprint?: string; error?: string }>) => {
      if (event.data.id !== id) return;
      worker.terminate();
      if (event.data.fingerprint) resolve(event.data.fingerprint);
      else reject(new Error(event.data.error || "FINGERPRINT_FAILED"));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("FINGERPRINT_WORKER_FAILED"));
    };
    worker.postMessage({ id, file });
  });
}
