import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MEDIAINFO_WASM_RELATIVE_PATH = path.join(
  "node_modules",
  "mediainfo.js",
  "dist",
  "MediaInfoModule.wasm",
);

export function resolveMediaInfoWasmUrl(
  runtimeRoot = process.cwd(),
  fileExists: (candidate: string) => boolean = existsSync,
): string {
  const candidates = [
    path.join(runtimeRoot, MEDIAINFO_WASM_RELATIVE_PATH),
    path.join(runtimeRoot, "apps", "participant-web", MEDIAINFO_WASM_RELATIVE_PATH),
    path.join(runtimeRoot, "apps", "admin-web", MEDIAINFO_WASM_RELATIVE_PATH),
  ];
  const wasmPath = candidates.find(fileExists);
  if (!wasmPath) throw new Error("mediainfo_wasm_missing");
  return pathToFileURL(wasmPath).href;
}
