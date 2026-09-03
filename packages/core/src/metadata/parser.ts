import "server-only";

import mediaInfoFactory, { type MediaInfoResult } from "mediainfo.js";
import { createFile, type Movie, type MP4BoxBuffer } from "mp4box";
import { resolveMediaInfoWasmUrl } from "@egocapture/core/metadata/mediainfo-wasm";
import { normalizeMediaInfo } from "@egocapture/core/metadata/normalize";
import { MetadataRangeError, type BudgetedRangeReader } from "@egocapture/core/metadata/range-reader";
import type { MetadataEvidence, Mp4Supplement, NormalizedMetadata } from "@egocapture/core/metadata/types";

const MEDIAINFO_PACKAGE_VERSION = "0.3.7";
const MP4BOX_PACKAGE_VERSION = "2.4.1";
// A 1 MiB chunk keeps an ordinary 5–20 second Demo clip below both independent
// budgets: at most 24 Range requests and at most 16 MiB read. The parser may
// still seek instead of reading sequentially for containers with a trailing moov.
const MEDIAINFO_CHUNK_SIZE = 1024 * 1024;
const MP4BOX_CHUNK_SIZE = 512 * 1024;

export type MetadataParseResult = {
  metadata: NormalizedMetadata;
  evidence: MetadataEvidence[];
  parserName: "mediainfo.js+mp4box";
  parserVersion: string;
  status: "extracted" | "partial";
  warningCode: string | null;
};

function movieSupplement(movie: Movie): Mp4Supplement {
  const video = movie.videoTracks[0];
  const audio = movie.audioTracks[0];
  const durationMs = movie.timescale > 0 ? Math.round((movie.duration / movie.timescale) * 1000) : undefined;
  return {
    durationMs,
    videoCodec: video?.codec,
    width: video?.video?.width ?? video?.track_width,
    height: video?.video?.height ?? video?.track_height,
    audioCodec: audio?.codec,
    audioChannels: audio?.audio?.channel_count,
  };
}

async function parseMp4(reader: BudgetedRangeReader): Promise<Mp4Supplement | null> {
  const file = createFile();
  let ready: Movie | null = null;
  let parserError: Error | null = null;
  file.onReady = (movie) => { ready = movie; };
  file.onError = (_module, message) => { parserError = new Error(message); };
  let offset = 0;
  for (let reads = 0; reads < 12 && offset < reader.objectSize && !ready; reads += 1) {
    const requested = Math.min(MP4BOX_CHUNK_SIZE, reader.objectSize - offset);
    const bytes = await reader.read(requested, offset);
    if (bytes.byteLength === 0) break;
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as MP4BoxBuffer;
    arrayBuffer.fileStart = offset;
    const next = file.appendBuffer(arrayBuffer, offset + bytes.byteLength >= reader.objectSize);
    if (ready) break;
    offset = Number.isSafeInteger(next) && next > offset && next < reader.objectSize
      ? next
      : offset + bytes.byteLength;
  }
  if (!ready) file.flush();
  if (parserError && !ready) throw parserError;
  return ready ? movieSupplement(ready) : null;
}

export async function parseMetadata(input: {
  reader: BudgetedRangeReader;
  extension: "mp4" | "mov" | "insv";
  localModifiedAt: string | null;
  serialHmacKey: string;
}): Promise<MetadataParseResult> {
  const mediaInfo = await mediaInfoFactory({
    format: "object",
    chunkSize: MEDIAINFO_CHUNK_SIZE,
    full: false,
    coverData: false,
    locateFile: (filename) => filename === "MediaInfoModule.wasm" ? resolveMediaInfoWasmUrl() : filename,
  });
  let result: MediaInfoResult;
  try {
    result = await mediaInfo.analyzeData(
      input.reader.objectSize,
      async (size, offset) => await input.reader.read(size, offset),
    );
  } finally {
    mediaInfo.close();
  }
  const tracks = result.media?.track ?? [];
  const hasRecognizedMedia = tracks.some((track) =>
    track["@type"] === "General" && Boolean(track.Format),
  );
  if (!hasRecognizedMedia) throw new Error("parser_no_recognized_container");

  let mp4: Mp4Supplement | null = null;
  let warningCode: string | null = null;
  if (input.extension === "mp4" || input.extension === "mov") {
    try {
      mp4 = await parseMp4(input.reader);
      if (!mp4) warningCode = "mp4box_no_moov";
    } catch (error) {
      warningCode = error instanceof MetadataRangeError ? error.code : "mp4box_parse_failed";
    }
  }
  const normalized = normalizeMediaInfo({
    result,
    expectedFileSize: input.reader.objectSize,
    localModifiedAt: input.localModifiedAt,
    serialHmacKey: input.serialHmacKey,
    mp4,
  });
  const libraryVersion = result.creatingLibrary?.version ?? "unknown";
  const hasVideo = Boolean(normalized.metadata.videoCodec || normalized.metadata.width || normalized.metadata.height);
  return {
    ...normalized,
    parserName: "mediainfo.js+mp4box",
    parserVersion: `mediainfo.js@${MEDIAINFO_PACKAGE_VERSION}/MediaInfoLib@${libraryVersion}+mp4box@${MP4BOX_PACKAGE_VERSION}`,
    status: warningCode || !hasVideo ? "partial" : "extracted",
    warningCode,
  };
}
