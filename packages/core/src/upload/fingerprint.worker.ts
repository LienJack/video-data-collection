/// <reference lib="webworker" />

import { sha256Hex } from "@egocapture/core/upload/fingerprint-digest";

const ONE_MIB = 1024 * 1024;

self.onmessage = async (event: MessageEvent<{ id: string; file: File }>) => {
  const { id, file } = event.data;
  try {
    const first = new Uint8Array(await file.slice(0, Math.min(file.size, ONE_MIB)).arrayBuffer());
    const last = new Uint8Array(await file.slice(Math.max(0, file.size - ONE_MIB)).arrayBuffer());
    const payload = new Uint8Array(8 + first.byteLength + last.byteLength);
    new DataView(payload.buffer).setBigUint64(0, BigInt(file.size), false);
    payload.set(first, 8);
    payload.set(last, 8 + first.byteLength);
    const [fingerprintV1, sourceSha256] = await Promise.all([
      sha256Hex(payload),
      file.arrayBuffer().then((buffer) => sha256Hex(new Uint8Array(buffer))),
    ]);
    self.postMessage({ id, fingerprintV1, sourceSha256 });
  } catch {
    self.postMessage({ id, error: "FINGERPRINT_FAILED" });
  }
};

export {};
