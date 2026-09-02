import { describe, expect, it, vi } from "vitest";
import type { MediaInfoResult } from "mediainfo.js";
import { compareDeviceConsistency, normalizeManufacturer } from "@egocapture/core/metadata/device-consistency";
import { resolveMediaInfoWasmUrl } from "@egocapture/core/metadata/mediainfo-wasm";
import { normalizeMediaInfo } from "@egocapture/core/metadata/normalize";
import { BudgetedRangeReader, MAX_METADATA_BYTES, MetadataRangeError } from "@egocapture/core/metadata/range-reader";

describe("metadata normalization", () => {
  it("uses a timezone-bearing QuickTime date before container, track and local times", () => {
    const result = {
      media: {
        "@ref": "",
        track: [
          { "@type": "General", Format: "MPEG-4", FileSize: "42", Encoded_Date: "2026-01-01 00:00:00 UTC", extra: { "com.apple.quicktime.creationdate": "2026-02-03T04:05:06+08:00" } },
          { "@type": "Video", Format: "AVC", Width: 1920, Height: 1080, Encoded_Date: "2026-01-02 00:00:00 UTC" },
        ],
      },
    } as MediaInfoResult;
    const normalized = normalizeMediaInfo({ result, expectedFileSize: 42, localModifiedAt: "2026-03-01T00:00:00Z", serialHmacKey: "x".repeat(32) });
    expect(normalized.metadata.normalizedCaptureTime).toBe("2026-02-02T20:05:06.000Z");
    expect(normalized.metadata.captureTimeSource).toBe("quicktime_with_timezone");
    expect(normalized.metadata.captureTimeConfidence).toBe("high");
    expect(normalized.metadata.timezoneOffset).toBe("+08:00");
  });

  it("stores only a serial HMAC and GPS presence, never sensitive raw values", () => {
    const secretSerial = "SERIAL-VERY-SECRET";
    const result = {
      media: {
        "@ref": "",
        track: [{
          "@type": "General",
          Format: "MPEG-4",
          extra: {
            "camera_serial_number": secretSerial,
            "com.apple.quicktime.location.ISO6709": "+22.3000+114.1000/",
            Comment: "private comment",
            Artist: "private person",
          },
        }],
      },
    } as MediaInfoResult;
    const normalized = normalizeMediaInfo({ result, expectedFileSize: 99, localModifiedAt: null, serialHmacKey: "h".repeat(32) });
    expect(normalized.metadata.cameraSerialHash).toMatch(/^[a-f0-9]{64}$/);
    expect(normalized.metadata.cameraSerialHash).not.toContain(secretSerial);
    expect(normalized.metadata.gpsMetadataPresent).toBe(true);
    const serialized = JSON.stringify(normalized);
    expect(serialized).not.toContain(secretSerial);
    expect(serialized).not.toContain("22.3000");
    expect(serialized).not.toContain("private comment");
    expect(serialized).not.toContain("private person");
  });

  it("normalizes an allowlisted equirectangular projection as 360 evidence", () => {
    const result = {
      media: {
        "@ref": "",
        track: [{
          "@type": "General",
          Format: "MPEG-4",
          extra: { projection: "equirectangular" },
        }],
      },
    } as MediaInfoResult;
    const normalized = normalizeMediaInfo({ result, expectedFileSize: 100, localModifiedAt: null, serialHmacKey: "x".repeat(32) });
    expect(normalized.metadata.projectionType).toBe("equirectangular");
    expect(normalized.metadata.is360).toBe(true);
    expect(normalized.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "projectionType", normalizedValue: "equirectangular" }),
      expect.objectContaining({ fieldName: "is360", normalizedValue: true }),
    ]));
  });
});

describe("MediaInfo WASM runtime location", () => {
  it.each([
    ["app-root", "/var/task/node_modules/mediainfo.js/dist/MediaInfoModule.wasm"],
    ["participant-monorepo", "/var/task/apps/participant-web/node_modules/mediainfo.js/dist/MediaInfoModule.wasm"],
    ["admin-monorepo", "/var/task/apps/admin-web/node_modules/mediainfo.js/dist/MediaInfoModule.wasm"],
  ])("resolves the %s traced layout", (_layout, expectedPath) => {
    const url = resolveMediaInfoWasmUrl("/var/task", (candidate) => candidate === expectedPath);
    expect(url).toBe(`file://${expectedPath}`);
  });

  it("fails with a stable code when no traced asset exists", () => {
    expect(() => resolveMediaInfoWasmUrl("/var/task", () => false)).toThrow("mediainfo_wasm_missing");
  });
});

describe("device consistency", () => {
  it("normalizes common manufacturers and exact normalized models", () => {
    expect(normalizeManufacturer("Apple Computer, Inc.")).toBe("apple");
    expect(compareDeviceConsistency(
      { manufacturer: "Apple Inc.", model: "iPhone 15 Pro", serialHmac: null },
      { manufacturer: "APPLE", model: "iphone15 pro", serialHash: null },
    )).toBe("matched");
  });

  it("does not turn missing metadata into a mismatch", () => {
    expect(compareDeviceConsistency(
      { manufacturer: "Insta360", model: "X4", serialHmac: "a".repeat(64) },
      { manufacturer: "Insta360", model: null, serialHash: null },
    )).toBe("partial_match");
    expect(compareDeviceConsistency(
      { manufacturer: "Insta360", model: "X4", serialHmac: null },
      { manufacturer: null, model: null, serialHash: null },
    )).toBe("metadata_unavailable");
  });

  it("reports exact model and serial conflicts", () => {
    expect(compareDeviceConsistency(
      { manufacturer: "Insta360", model: "X4", serialHmac: null },
      { manufacturer: "Insta360", model: "X3", serialHash: null },
    )).toBe("model_mismatch");
    expect(compareDeviceConsistency(
      { manufacturer: "Apple", model: null, serialHmac: "a".repeat(64) },
      { manufacturer: "Apple", model: null, serialHash: "b".repeat(64) },
    )).toBe("serial_mismatch");
  });
});

describe("budgeted range reader", () => {
  it("accepts an exact 206 response and accounts actual bytes", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: { "content-range": "bytes 2-4/10" },
    }));
    const reader = new BudgetedRangeReader("https://storage.invalid/object", 10, new AbortController().signal, fetcher as typeof fetch);
    expect([...await reader.read(3, 2)]).toEqual([1, 2, 3]);
    expect(reader.rangeRequestCount).toBe(1);
    expect(reader.bytesRead).toBe(3);
  });

  it("allows a full 200 response only when the object is within budget", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([0, 1, 2, 3]), { status: 200 }));
    const reader = new BudgetedRangeReader("https://storage.invalid/object", 4, new AbortController().signal, fetcher as typeof fetch);
    expect([...await reader.read(2, 1)]).toEqual([1, 2]);
    expect([...await reader.read(2, 2)]).toEqual([2, 3]);
    expect(fetcher).toHaveBeenCalledTimes(1);

    const oversized = new BudgetedRangeReader("https://storage.invalid/object", MAX_METADATA_BYTES + 1, new AbortController().signal, fetcher as typeof fetch);
    await expect(oversized.read(1, 0)).rejects.toMatchObject({ code: "range_not_supported" } satisfies Partial<MetadataRangeError>);
  });

  it("rejects a misleading Content-Range", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1]), {
      status: 206,
      headers: { "content-range": "bytes 0-0/999" },
    }));
    const reader = new BudgetedRangeReader("https://storage.invalid/object", 1, new AbortController().signal, fetcher as typeof fetch);
    await expect(reader.read(1, 0)).rejects.toMatchObject({ code: "range_response_invalid" } satisfies Partial<MetadataRangeError>);
  });
});
