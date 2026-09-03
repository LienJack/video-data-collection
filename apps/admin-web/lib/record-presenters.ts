export type RecordHealthTone = "ready" | "progress" | "attention";
import { createTranslator, type Translator } from "@egocapture/core/i18n";

const defaultI18n = createTranslator("zh-CN");

const unhealthyTransfers = new Set(["failed", "aborted", "expired"]);
const unhealthyMetadata = new Set(["partial", "unsupported", "failed"]);

export function transferStatusLabel(status: string | null | undefined, i18n: Translator = defaultI18n) {
  return status ? i18n.state("upload_intent.transfer_status", status) : i18n.state("upload_intent.transfer_status", "created");
}

export function metadataStatusLabel(status: string | null | undefined, i18n: Translator = defaultI18n) {
  return i18n.state("upload_intent.metadata_status", status ?? "pending");
}

export function matchDecisionLabel(status: string | null | undefined, i18n: Translator = defaultI18n) {
  return i18n.label("matchDecision", status ?? "pending");
}

export function sessionStatusLabel(status: string | null | undefined, i18n: Translator = defaultI18n) {
  return i18n.state("recording_session.status", status ?? "open");
}

export function resolvedSessionForDisplay(decisionType: string | null | undefined, resolvedSessionPublicId: string | null | undefined) {
  return decisionType === "rejected" ? null : resolvedSessionPublicId ?? null;
}

export function auditActionLabel(action: string, i18n: Translator = defaultI18n) {
  return i18n.label("auditAction", action);
}

export function auditEntityLabel(entityType: string, i18n: Translator = defaultI18n) {
  return i18n.label("entity", entityType);
}

export function isUnhealthyTransferStatus(status: string) {
  return unhealthyTransfers.has(status);
}

export function isUnhealthyMetadataStatus(status: string) {
  return unhealthyMetadata.has(status);
}

export function recordHealth(input: {
  transferStatus: string;
  metadataStatus: string;
  decisionType?: string | null;
  reviewCount: number;
}, i18n: Translator = defaultI18n) {
  if (isUnhealthyTransferStatus(input.transferStatus) || isUnhealthyMetadataStatus(input.metadataStatus) || input.reviewCount > 0 || input.decisionType === "unmatched" || input.decisionType === "rejected") {
    return { label: i18n.label("recordHealth", "attention"), tone: "attention" as const };
  }
  if (input.transferStatus === "verified" && input.metadataStatus === "extracted" && input.decisionType) {
    return { label: i18n.label("recordHealth", "ready"), tone: "ready" as const };
  }
  return { label: i18n.label("recordHealth", "progress"), tone: "progress" as const };
}

export function changedAuditFields(beforeValues: Record<string, unknown> | null, afterValues: Record<string, unknown> | null, i18n: Translator = defaultI18n) {
  const keys = new Set([...Object.keys(beforeValues ?? {}), ...Object.keys(afterValues ?? {})]);
  return [...keys]
    .filter((key) => JSON.stringify(beforeValues?.[key]) !== JSON.stringify(afterValues?.[key]))
    .map((key) => i18n.label("field", key));
}

export function formatRecordDate(value: string | Date, i18n: Translator = defaultI18n) {
  return i18n.date(value, { dateStyle: "medium", timeStyle: "short" });
}

export function formatRecordBytes(bytes: number, i18n: Translator = defaultI18n) {
  return i18n.bytes(bytes);
}

export function formatRecordDuration(durationMs: number | null, i18n: Translator = defaultI18n) {
  return durationMs === null ? i18n.t("common.notAvailable") : i18n.duration(durationMs / 1000);
}
