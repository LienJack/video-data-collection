import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadQueue } from "../../apps/participant-web/app/(portal)/uploads/upload-queue";

const mocks = vi.hoisted(() => ({
  fingerprintFile: vi.fn(),
  persistUpload: vi.fn(),
  persistedUpload: vi.fn(),
  persistedUploads: vi.fn(),
  removePersistedUpload: vi.fn(),
  createTusUpload: vi.fn(),
  startOrResumeTus: vi.fn(),
}));

vi.mock("@egocapture/core/upload/fingerprint", () => ({
  fingerprintFile: mocks.fingerprintFile,
}));

vi.mock("@egocapture/core/upload/persistence", () => ({
  legacyPersistedUploadCount: vi.fn(() => 0),
  migrateLegacyPersistedUpload: vi.fn(() => null),
  persistUpload: mocks.persistUpload,
  persistedUpload: mocks.persistedUpload,
  persistedUploads: mocks.persistedUploads,
  removePersistedUpload: mocks.removePersistedUpload,
  updatePersistedUpload: vi.fn(),
}));

vi.mock("@egocapture/core/upload/tus", () => ({
  createTusUpload: mocks.createTusUpload,
  startOrResumeTus: mocks.startOrResumeTus,
}));

const sessions = [{
  publicId: "RS-OPEN0001",
  assignmentPublicId: "AS-00000001",
  taskTitle: "厨房收纳",
  deviceLabel: "Insta360 GO 3",
}];

const credential = {
  uploadPublicId: "UP-00000001",
  attemptPublicId: "UA-00000001",
  objectKey: "raw/object.mp4",
  tusEndpoint: "https://storage.example.test/upload/resumable",
  signedUploadToken: "signed-token",
  expiresAt: "2030-01-01T00:00:00.000Z",
  attemptExpiresAt: "2030-01-01T00:00:00.000Z",
  chunkSizeBytes: 6_291_456,
  authMode: "official_signed",
  duplicateCandidate: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function selectVideo() {
  const file = new File(["video"], "capture.mp4", {
    type: "video/mp4",
    lastModified: 1_700_000_000_000,
  });
  fireEvent.change(screen.getByLabelText(/选择设备或 SSD 中的视频/), {
    target: { files: [file] },
  });
}

beforeEach(() => {
  mocks.fingerprintFile.mockReset().mockResolvedValue({
    fingerprintV1: "fingerprint-v1",
    sourceSha256: "a".repeat(64),
  });
  mocks.persistUpload.mockReset();
  mocks.persistedUpload.mockReset().mockReturnValue(null);
  mocks.persistedUploads.mockReset().mockReturnValue([]);
  mocks.removePersistedUpload.mockReset();
  mocks.createTusUpload.mockReset();
  mocks.startOrResumeTus.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("participant upload queue async lifecycle", () => {
  it("aborts a credential that arrives after the user cancels preparing", async () => {
    const intent = deferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (input === "/api/upload-batches") {
        return new Response(JSON.stringify({ data: { batchPublicId: "UB-00000001" } }), { status: 200 });
      }
      if (input === "/api/upload-intents") return await intent.promise;
      if (input === "/api/uploads/UP-00000001/abort") {
        return new Response(JSON.stringify({ data: { transferStatus: "aborted" } }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UploadQueue sessions={sessions} lockedSessionPublicId="RS-OPEN0001" />);
    selectVideo();
    const card = await screen.findByRole("article");
    fireEvent.click(await within(card).findByRole("button", { name: "开始直传 Storage" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload-intents",
      expect.objectContaining({ method: "POST" }),
    ));
    fireEvent.click(within(card).getByRole("button", { name: "取消" }));
    expect(within(card).getByText("aborted")).toBeInTheDocument();

    await act(async () => {
      intent.resolve(new Response(JSON.stringify({ data: credential }), { status: 200 }));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/uploads/UP-00000001/abort",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(mocks.persistUpload).not.toHaveBeenCalled();
    expect(mocks.createTusUpload).not.toHaveBeenCalled();
    expect(mocks.startOrResumeTus).not.toHaveBeenCalled();
  });

  it("aborts a credential that arrives after the queue unmounts", async () => {
    const intent = deferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (input === "/api/upload-batches") {
        return new Response(JSON.stringify({ data: { batchPublicId: "UB-00000002" } }), { status: 200 });
      }
      if (input === "/api/upload-intents") return await intent.promise;
      if (input === "/api/uploads/UP-00000001/abort") {
        return new Response(JSON.stringify({ data: { transferStatus: "aborted" } }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(<UploadQueue sessions={sessions} lockedSessionPublicId="RS-OPEN0001" />);
    selectVideo();
    const card = await screen.findByRole("article");
    fireEvent.click(await within(card).findByRole("button", { name: "开始直传 Storage" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload-intents",
      expect.objectContaining({ method: "POST" }),
    ));
    view.unmount();

    await act(async () => {
      intent.resolve(new Response(JSON.stringify({ data: credential }), { status: 200 }));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/uploads/UP-00000001/abort",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(mocks.persistUpload).not.toHaveBeenCalled();
    expect(mocks.createTusUpload).not.toHaveBeenCalled();
  });
});
