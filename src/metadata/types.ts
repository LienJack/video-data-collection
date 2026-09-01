export type CaptureTimeSource =
  | "quicktime_with_timezone"
  | "container"
  | "track"
  | "local_modified"
  | "unknown";

export type CaptureTimeConfidence = "high" | "medium" | "low" | "unknown";

export type DeviceConsistency =
  | "matched"
  | "partial_match"
  | "metadata_unavailable"
  | "model_mismatch"
  | "serial_mismatch"
  | "metadata_conflict";

export type Mp4Supplement = {
  durationMs?: number;
  videoCodec?: string;
  width?: number;
  height?: number;
  audioCodec?: string;
  audioChannels?: number;
};

export type NormalizedMetadata = {
  containerFormat: string | null;
  durationMs: number | null;
  fileSizeBytes: number | null;
  videoCodec: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  bitrate: number | null;
  audioCodec: string | null;
  audioChannels: number | null;
  normalizedCaptureTime: string | null;
  captureTimeSource: CaptureTimeSource;
  captureTimeConfidence: CaptureTimeConfidence;
  timezoneOffset: string | null;
  cameraManufacturer: string | null;
  cameraModel: string | null;
  cameraSerialHash: string | null;
  gpsMetadataPresent: boolean;
  projectionType: string | null;
  is360: boolean | null;
};

export type MetadataEvidence = {
  fieldName: keyof NormalizedMetadata;
  normalizedValue: string | number | boolean;
  source: string;
};

export type DeclaredDevice = {
  manufacturer: string | null;
  model: string | null;
  serialHmac: string | null;
};

export type ExtractedDevice = {
  manufacturer: string | null;
  model: string | null;
  serialHash: string | null;
};
