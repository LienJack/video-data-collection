import type { DeclaredDevice, DeviceConsistency, ExtractedDevice } from "@/src/metadata/types";

const MANUFACTURER_ALIASES: Record<string, string> = {
  applecomputerinc: "apple",
  appleinc: "apple",
  insta360: "insta360",
  arashivisioninc: "insta360",
  samsungelectronics: "samsung",
};

export function normalizeDeviceText(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized || null;
}

export function normalizeManufacturer(value: string | null): string | null {
  const normalized = normalizeDeviceText(value);
  return normalized ? MANUFACTURER_ALIASES[normalized] ?? normalized : null;
}

export function compareDeviceConsistency(
  declared: DeclaredDevice | null,
  extracted: ExtractedDevice,
): DeviceConsistency {
  if (!declared) return "metadata_unavailable";
  const declaredManufacturer = normalizeManufacturer(declared.manufacturer);
  const extractedManufacturer = normalizeManufacturer(extracted.manufacturer);
  const declaredModel = normalizeDeviceText(declared.model);
  const extractedModel = normalizeDeviceText(extracted.model);
  const hasExtractedIdentity = Boolean(extractedManufacturer || extractedModel || extracted.serialHash);
  if (!hasExtractedIdentity) return "metadata_unavailable";

  const manufacturerConflict = Boolean(declaredManufacturer && extractedManufacturer && declaredManufacturer !== extractedManufacturer);
  const modelConflict = Boolean(declaredModel && extractedModel && declaredModel !== extractedModel);
  const serialConflict = Boolean(declared.serialHmac && extracted.serialHash && declared.serialHmac !== extracted.serialHash);
  const conflictCount = [manufacturerConflict, modelConflict, serialConflict].filter(Boolean).length;
  if (conflictCount > 1 || manufacturerConflict) return "metadata_conflict";
  if (serialConflict) return "serial_mismatch";
  if (modelConflict) return "model_mismatch";

  const expected = [declaredManufacturer, declaredModel, declared.serialHmac].filter(Boolean).length;
  const compared = [
    Boolean(declaredManufacturer && extractedManufacturer),
    Boolean(declaredModel && extractedModel),
    Boolean(declared.serialHmac && extracted.serialHash),
  ].filter(Boolean).length;
  return expected > 0 && compared === expected ? "matched" : "partial_match";
}
