import { describe, expect, it } from "vitest";
import { sha256Hex } from "@egocapture/core/upload/fingerprint-digest";

describe("upload source fingerprint", () => {
  it("hashes the complete source bytes with SHA-256", async () => {
    expect(await sha256Hex(new Uint8Array([1, 2, 3]))).toBe(
      "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
    );
  });
});
