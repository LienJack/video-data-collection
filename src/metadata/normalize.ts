import { createHmac } from "node:crypto";
import type { MediaInfoResult, Track } from "mediainfo.js";
import type {
  CaptureTimeConfidence,
  CaptureTimeSource,
  MetadataEvidence,
  Mp4Supplement,
  NormalizedMetadata,
} from "@/src/metadata/types";

type TrackRecord = Track & Record<string, unknown>;

type ValueEvidence = {
  value: string;
  source: string;
};

const SAFE_EVIDENCE_FIELDS = new Set<keyof NormalizedMetadata>([
  "containerFormat",
  "durationMs",
  "fileSizeBytes",
  "videoCodec",
  "width",
  "height",
  "frameRate",
  "bitrate",
  "audioCodec",
  "audioChannels",
  "normalizedCaptureTime",
  "captureTimeSource",
  "captureTimeConfidence",
  "timezoneOffset",
  "cameraManufacturer",
  "cameraModel",
  "cameraSerialHash",
  "gpsMetadataPresent",
  "projectionType",
  "is360",
]);

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanText(value: unknown, maximum = 160): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maximum) : null;
}

function finiteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function positiveInteger(value: unknown): number | null {
  const numeric = finiteNumber(value);
  return numeric !== null && numeric > 0 ? Math.round(numeric) : null;
}

function firstTrack(result: MediaInfoResult, type: Track["@type"]): TrackRecord | undefined {
  return result.media?.track.find((track) => track["@type"] === type) as TrackRecord | undefined;
}

function allTaggedValues(result: MediaInfoResult): Array<{ key: string; normalizedKey: string; value: string; source: string }> {
  const values: Array<{ key: string; normalizedKey: string; value: string; source: string }> = [];
  for (const track of result.media?.track ?? []) {
    const sourcePrefix = `mediainfo.${track["@type"].toLowerCase()}`;
    for (const [key, rawValue] of Object.entries(track as TrackRecord)) {
      if (key === "extra" || key.startsWith("@")) continue;
      const value = cleanText(rawValue);
      if (value) values.push({ key, normalizedKey: normalizedKey(key), value, source: `${sourcePrefix}.${key}` });
    }
    for (const [key, rawValue] of Object.entries(track.extra ?? {})) {
      const value = cleanText(rawValue);
      if (value) values.push({ key, normalizedKey: normalizedKey(key), value, source: `${sourcePrefix}.extra.${key}` });
    }
  }
  return values;
}

function taggedValue(
  values: ReturnType<typeof allTaggedValues>,
  keys: string[],
): ValueEvidence | null {
  const wanted = keys.map(normalizedKey);
  const match = values.find((candidate) => wanted.includes(candidate.normalizedKey));
  return match ? { value: match.value, source: match.source } : null;
}

function parseDate(value: string): { iso: string; timezoneOffset: string | null } | null {
  const compact = value.trim();
  const offsetMatch = compact.match(/(?:^|\s)(UTC)$/i) ?? compact.match(/(Z|[+-]\d{2}:?\d{2})$/i);
  const timezoneOffset = offsetMatch
    ? offsetMatch[1].toUpperCase() === "UTC" || offsetMatch[1].toUpperCase() === "Z"
      ? "+00:00"
      : offsetMatch[1].length === 5
        ? `${offsetMatch[1].slice(0, 3)}:${offsetMatch[1].slice(3)}`
        : offsetMatch[1]
    : null;
  const normalized = compact
    .replace(/^UTC\s+/i, "")
    .replace(/\s+UTC$/i, "Z")
    .replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, "$1T$2");
  const milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds)) return null;
  return { iso: new Date(milliseconds).toISOString(), timezoneOffset };
}

function captureTime(
  result: MediaInfoResult,
  values: ReturnType<typeof allTaggedValues>,
  localModifiedAt: string | null,
): {
  value: string | null;
  source: CaptureTimeSource;
  confidence: CaptureTimeConfidence;
  timezoneOffset: string | null;
  evidenceSource: string;
} {
  const quickTime = values.find((candidate) =>
    candidate.normalizedKey.includes("quicktimecreationdate")
    && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(candidate.value),
  );
  if (quickTime) {
    const parsed = parseDate(quickTime.value);
    if (parsed) return { value: parsed.iso, source: "quicktime_with_timezone", confidence: "high", timezoneOffset: parsed.timezoneOffset, evidenceSource: quickTime.source };
  }

  const general = firstTrack(result, "General");
  for (const key of ["Recorded_Date", "Encoded_Date", "File_Created_Date", "Tagged_Date"] as const) {
    const raw = cleanText(general?.[key]);
    const parsed = raw ? parseDate(raw) : null;
    if (parsed) return { value: parsed.iso, source: "container", confidence: "medium", timezoneOffset: parsed.timezoneOffset, evidenceSource: `mediainfo.general.${key}` };
  }

  for (const trackType of ["Video", "Audio"] as const) {
    const track = firstTrack(result, trackType);
    for (const key of ["Recorded_Date", "Encoded_Date", "Tagged_Date"] as const) {
      const raw = cleanText(track?.[key]);
      const parsed = raw ? parseDate(raw) : null;
      if (parsed) return { value: parsed.iso, source: "track", confidence: "low", timezoneOffset: parsed.timezoneOffset, evidenceSource: `mediainfo.${trackType.toLowerCase()}.${key}` };
    }
  }

  const local = localModifiedAt ? parseDate(localModifiedAt) : null;
  if (local) return { value: local.iso, source: "local_modified", confidence: "low", timezoneOffset: local.timezoneOffset, evidenceSource: "upload_intent.local_modified_at" };
  return { value: null, source: "unknown", confidence: "unknown", timezoneOffset: null, evidenceSource: "none" };
}

function projection(values: ReturnType<typeof allTaggedValues>): ValueEvidence | null {
  const candidate = values.find((item) => /projection|spherical|equirectangular|stitching/.test(item.normalizedKey));
  if (!candidate) return null;
  const value = candidate.normalizedKey.includes("equirectangular")
    ? "equirectangular"
    : candidate.normalizedKey.includes("spherical")
      ? "spherical"
      : cleanText(candidate.value, 80);
  return value ? { value: value.toLowerCase(), source: candidate.source } : null;
}

function hasGps(values: ReturnType<typeof allTaggedValues>): boolean {
  return values.some((candidate) => /gps|latitude|longitude|locationiso6709/.test(candidate.normalizedKey));
}

export function normalizeMediaInfo(input: {
  result: MediaInfoResult;
  expectedFileSize: number;
  localModifiedAt: string | null;
  serialHmacKey: string;
  mp4?: Mp4Supplement | null;
}): { metadata: NormalizedMetadata; evidence: MetadataEvidence[] } {
  const general = firstTrack(input.result, "General");
  const video = firstTrack(input.result, "Video");
  const audio = firstTrack(input.result, "Audio");
  const values = allTaggedValues(input.result);
  const make = taggedValue(values, [
    "com.apple.quicktime.make",
    "camera_make",
    "make",
    "manufacturer",
    "Encoded_Hardware_CompanyName",
  ]);
  const model = taggedValue(values, [
    "com.apple.quicktime.model",
    "camera_model",
    "model",
    "Encoded_Hardware_Name",
  ]);
  const serial = taggedValue(values, ["com.apple.quicktime.serial", "camera_serial_number", "serial_number", "serial"]);
  const projectionValue = projection(values);
  const time = captureTime(input.result, values, input.localModifiedAt);
  const durationSeconds = finiteNumber(general?.Duration) ?? finiteNumber(video?.Duration);
  const parsedFileSize = positiveInteger(general?.FileSize);
  const projectionText = projectionValue?.value ?? null;
  const is360 = projectionText
    ? /equirectangular|spherical|360/.test(projectionText)
    : null;
  const metadata: NormalizedMetadata = {
    containerFormat: cleanText(general?.Format, 80),
    durationMs: durationSeconds !== null ? Math.round(durationSeconds * 1000) : input.mp4?.durationMs ?? null,
    fileSizeBytes: parsedFileSize ?? input.expectedFileSize,
    videoCodec: cleanText(video?.Format ?? video?.CodecID, 80) ?? input.mp4?.videoCodec ?? null,
    width: positiveInteger(video?.Width) ?? input.mp4?.width ?? null,
    height: positiveInteger(video?.Height) ?? input.mp4?.height ?? null,
    frameRate: finiteNumber(video?.FrameRate),
    bitrate: positiveInteger(video?.BitRate ?? general?.OverallBitRate),
    audioCodec: cleanText(audio?.Format ?? audio?.CodecID, 80) ?? input.mp4?.audioCodec ?? null,
    audioChannels: positiveInteger(audio?.Channels) ?? input.mp4?.audioChannels ?? null,
    normalizedCaptureTime: time.value,
    captureTimeSource: time.source,
    captureTimeConfidence: time.confidence,
    timezoneOffset: time.timezoneOffset,
    cameraManufacturer: make?.value ?? null,
    cameraModel: model?.value ?? null,
    cameraSerialHash: serial
      ? createHmac("sha256", input.serialHmacKey).update(serial.value.trim().toUpperCase()).digest("hex")
      : null,
    gpsMetadataPresent: hasGps(values),
    projectionType: projectionText,
    is360,
  };

  const sourceByField: Partial<Record<keyof NormalizedMetadata, string>> = {
    containerFormat: "mediainfo.general.Format",
    durationMs: general?.Duration !== undefined ? "mediainfo.general.Duration" : input.mp4?.durationMs !== undefined ? "mp4box.movie.duration" : "mediainfo.video.Duration",
    fileSizeBytes: parsedFileSize ? "mediainfo.general.FileSize" : "stored_object.size_bytes",
    videoCodec: video?.Format || video?.CodecID ? "mediainfo.video.codec" : "mp4box.video.codec",
    width: video?.Width ? "mediainfo.video.Width" : "mp4box.video.width",
    height: video?.Height ? "mediainfo.video.Height" : "mp4box.video.height",
    frameRate: "mediainfo.video.FrameRate",
    bitrate: video?.BitRate ? "mediainfo.video.BitRate" : "mediainfo.general.OverallBitRate",
    audioCodec: audio?.Format || audio?.CodecID ? "mediainfo.audio.codec" : "mp4box.audio.codec",
    audioChannels: audio?.Channels ? "mediainfo.audio.Channels" : "mp4box.audio.channel_count",
    normalizedCaptureTime: time.evidenceSource,
    captureTimeSource: time.evidenceSource,
    captureTimeConfidence: time.evidenceSource,
    timezoneOffset: time.evidenceSource,
    cameraManufacturer: make?.source,
    cameraModel: model?.source,
    cameraSerialHash: serial?.source,
    gpsMetadataPresent: "mediainfo.allowlisted_key_presence",
    projectionType: projectionValue?.source,
    is360: projectionValue?.source,
  };
  const evidence: MetadataEvidence[] = [];
  for (const [fieldName, normalizedValue] of Object.entries(metadata) as Array<[keyof NormalizedMetadata, NormalizedMetadata[keyof NormalizedMetadata]]>) {
    if (!SAFE_EVIDENCE_FIELDS.has(fieldName) || normalizedValue === null) continue;
    evidence.push({
      fieldName,
      normalizedValue,
      source: (sourceByField[fieldName] ?? "normalized_allowlist").slice(0, 160),
    });
  }
  return { metadata, evidence };
}
