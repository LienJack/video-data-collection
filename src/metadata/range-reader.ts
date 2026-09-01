export const MAX_METADATA_RANGE_REQUESTS = 24;
export const MAX_METADATA_BYTES = 16 * 1024 * 1024;

export type MetadataRangeErrorCode =
  | "range_budget_exceeded"
  | "range_request_failed"
  | "range_response_invalid"
  | "range_not_supported"
  | "range_read_aborted";

export class MetadataRangeError extends Error {
  constructor(readonly code: MetadataRangeErrorCode) {
    super(code);
    this.name = "MetadataRangeError";
  }
}

export class BudgetedRangeReader {
  private fullObject: Uint8Array | null = null;
  rangeRequestCount = 0;
  bytesRead = 0;

  constructor(
    private readonly signedUrl: string,
    readonly objectSize: number,
    private readonly signal: AbortSignal,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async read(size: number, offset: number): Promise<Uint8Array> {
    if (this.signal.aborted) throw new MetadataRangeError("range_read_aborted");
    if (!Number.isSafeInteger(size) || !Number.isSafeInteger(offset) || size < 0 || offset < 0) {
      throw new MetadataRangeError("range_response_invalid");
    }
    // MediaInfo uses a zero-length read at EOF as a normal completion sentinel.
    if (size === 0) return new Uint8Array();
    if (offset >= this.objectSize) return new Uint8Array();
    const boundedSize = Math.min(size, this.objectSize - offset);
    if (this.fullObject) return this.fullObject.slice(offset, offset + boundedSize);
    if (this.rangeRequestCount >= MAX_METADATA_RANGE_REQUESTS) {
      throw new MetadataRangeError("range_budget_exceeded");
    }
    this.rangeRequestCount += 1;
    let response: Response;
    try {
      response = await this.fetcher(this.signedUrl, {
        headers: { range: `bytes=${offset}-${offset + boundedSize - 1}` },
        cache: "no-store",
        signal: this.signal,
      });
    } catch {
      throw new MetadataRangeError(this.signal.aborted ? "range_read_aborted" : "range_request_failed");
    }
    if (response.status === 200) {
      if (this.objectSize > MAX_METADATA_BYTES) throw new MetadataRangeError("range_not_supported");
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.byteLength !== this.objectSize || this.bytesRead + body.byteLength > MAX_METADATA_BYTES) {
        throw new MetadataRangeError("range_response_invalid");
      }
      this.bytesRead += body.byteLength;
      this.fullObject = body;
      return body.slice(offset, offset + boundedSize);
    }
    if (response.status !== 206) throw new MetadataRangeError("range_request_failed");
    const expectedContentRange = `bytes ${offset}-${offset + boundedSize - 1}/${this.objectSize}`;
    if (response.headers.get("content-range") !== expectedContentRange) {
      throw new MetadataRangeError("range_response_invalid");
    }
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength !== boundedSize) throw new MetadataRangeError("range_response_invalid");
    if (this.bytesRead + body.byteLength > MAX_METADATA_BYTES) {
      throw new MetadataRangeError("range_budget_exceeded");
    }
    this.bytesRead += body.byteLength;
    return body;
  }
}
