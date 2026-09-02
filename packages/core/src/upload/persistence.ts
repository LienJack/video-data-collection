"use client";

export type PersistedUpload = {
  version: 2;
  uploadPublicId: string;
  attemptPublicId: string;
  objectKey: string;
  originalFilename: string;
  sizeBytes: number;
  contentType: string;
  lastModified: number;
  fingerprintV1: string;
  sourceSha256: string;
  claimedSessionPublicId: string | null;
  unableToDetermine: boolean;
  acceptedBytes: number;
  status: "preparing" | "uploading" | "paused" | "failed";
  attemptExpiresAt: string;
  savedAt: string;
};

type LegacyPersistedUpload = Pick<
  PersistedUpload,
  | "uploadPublicId"
  | "attemptPublicId"
  | "objectKey"
  | "originalFilename"
  | "sizeBytes"
  | "fingerprintV1"
  | "claimedSessionPublicId"
  | "unableToDetermine"
  | "savedAt"
>;

const PREFIX = "egocapture-upload-v2:";
const LEGACY_PREFIX = "egocapture-upload-v1:";
const RECOVERABLE_STATUSES = new Set<PersistedUpload["status"]>([
  "preparing",
  "uploading",
  "paused",
  "failed",
]);

function storage() {
  return window.localStorage;
}

function isPersistedUpload(value: unknown): value is PersistedUpload {
  if (!value || typeof value !== "object") return false;
  const upload = value as Partial<PersistedUpload>;
  return upload.version === 2
    && typeof upload.uploadPublicId === "string"
    && typeof upload.attemptPublicId === "string"
    && typeof upload.objectKey === "string"
    && typeof upload.originalFilename === "string"
    && Number.isSafeInteger(upload.sizeBytes)
    && upload.sizeBytes! > 0
    && typeof upload.contentType === "string"
    && Number.isSafeInteger(upload.lastModified)
    && /^[a-f0-9]{64}$/.test(upload.fingerprintV1 ?? "")
    && /^[a-f0-9]{64}$/.test(upload.sourceSha256 ?? "")
    && Number.isSafeInteger(upload.acceptedBytes)
    && upload.acceptedBytes! >= 0
    && upload.acceptedBytes! <= upload.sizeBytes!
    && RECOVERABLE_STATUSES.has(upload.status as PersistedUpload["status"])
    && typeof upload.attemptExpiresAt === "string"
    && typeof upload.savedAt === "string";
}

function parsePersistedUpload(value: string | null): PersistedUpload | null {
  try {
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    return isPersistedUpload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseLegacyPersistedUpload(value: string | null): LegacyPersistedUpload | null {
  try {
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<LegacyPersistedUpload>;
    return typeof parsed.uploadPublicId === "string"
      && typeof parsed.attemptPublicId === "string"
      && typeof parsed.objectKey === "string"
      && typeof parsed.originalFilename === "string"
      && Number.isSafeInteger(parsed.sizeBytes)
      && parsed.sizeBytes! > 0
      && /^[a-f0-9]{64}$/.test(parsed.fingerprintV1 ?? "")
      && (parsed.claimedSessionPublicId === null || typeof parsed.claimedSessionPublicId === "string")
      && typeof parsed.unableToDetermine === "boolean"
      && typeof parsed.savedAt === "string"
      ? parsed as LegacyPersistedUpload
      : null;
  } catch {
    return null;
  }
}

export function persistedUpload(sourceSha256: string): PersistedUpload | null {
  return parsePersistedUpload(storage().getItem(`${PREFIX}${sourceSha256}`));
}

export function persistedUploads(): PersistedUpload[] {
  const keys = Array.from({ length: storage().length }, (_, index) => storage().key(index))
    .filter((key): key is string => key !== null);
  return keys
    .filter((key) => key.startsWith(PREFIX))
    .map((key) => parsePersistedUpload(storage().getItem(key)))
    .filter((upload): upload is PersistedUpload => upload !== null)
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

export function legacyPersistedUploadCount() {
  return Array.from({ length: storage().length }, (_, index) => storage().key(index))
    .filter((key): key is string => key?.startsWith(LEGACY_PREFIX) ?? false)
    .filter((key) => parseLegacyPersistedUpload(storage().getItem(key)) !== null)
    .length;
}

export function migrateLegacyPersistedUpload(
  fingerprintV1: string,
  input: Pick<
    PersistedUpload,
    "contentType" | "lastModified" | "sourceSha256" | "originalFilename" | "sizeBytes"
  >,
) {
  const legacy = parseLegacyPersistedUpload(storage().getItem(`${LEGACY_PREFIX}${fingerprintV1}`));
  if (!legacy
    || legacy.originalFilename !== input.originalFilename
    || legacy.sizeBytes !== input.sizeBytes) return null;
  const migrated: PersistedUpload = {
    ...legacy,
    ...input,
    version: 2,
    acceptedBytes: 0,
    status: "paused",
    attemptExpiresAt: new Date(0).toISOString(),
  };
  persistUpload(migrated);
  storage().removeItem(`${LEGACY_PREFIX}${fingerprintV1}`);
  return migrated;
}

export function persistUpload(upload: PersistedUpload) {
  storage().setItem(`${PREFIX}${upload.sourceSha256}`, JSON.stringify(upload));
}

export function updatePersistedUpload(
  sourceSha256: string,
  patch: Partial<Pick<PersistedUpload, "acceptedBytes" | "status" | "attemptPublicId" | "attemptExpiresAt">>,
) {
  const current = persistedUpload(sourceSha256);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    acceptedBytes: Math.max(current.acceptedBytes, patch.acceptedBytes ?? current.acceptedBytes),
  } satisfies PersistedUpload;
  persistUpload(next);
  return next;
}

export function removePersistedUpload(sourceSha256: string) {
  storage().removeItem(`${PREFIX}${sourceSha256}`);
}
