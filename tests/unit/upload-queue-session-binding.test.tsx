import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadQueue } from "../../apps/participant-web/app/(portal)/uploads/upload-queue";

const mocks = vi.hoisted(() => ({
  fingerprintFile: vi.fn(),
  persistUpload: vi.fn(),
  persistedUpload: vi.fn(),
  persistedUploads: vi.fn(),
  createTusUpload: vi.fn(),
  startOrResumeTus: vi.fn(),
  abortUpload: vi.fn(),
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
  removePersistedUpload: vi.fn(),
  updatePersistedUpload: vi.fn(),
}));

vi.mock("@egocapture/core/upload/tus", () => ({
  createTusUpload: mocks.createTusUpload,
  startOrResumeTus: mocks.startOrResumeTus,
}));

const sessions = [
  {
    publicId: "RS-OPEN0001",
    assignmentPublicId: "AS-00000001",
    taskTitle: "厨房收纳",
    deviceLabel: "Insta360 GO 3",
  },
  {
    publicId: "RS-OPEN0002",
    assignmentPublicId: "AS-00000002",
    taskTitle: "桌面整理",
    deviceLabel: "Synthetic Phone",
  },
];

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
  mocks.abortUpload.mockReset().mockResolvedValue(undefined);
  mocks.createTusUpload.mockReset().mockReturnValue({ start: vi.fn(), abort: mocks.abortUpload });
  mocks.startOrResumeTus.mockReset().mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("participant upload queue Session binding", () => {
  it("keeps manual Session and Unable to Determine choices on generic /uploads", async () => {
    render(<UploadQueue sessions={sessions} />);
    selectVideo();

    const card = await screen.findByRole("article");
    const selector = within(card).getByRole("combobox", { name: "Recording Session" });
    expect(selector).toHaveValue("");
    expect(within(selector).getByRole("option", { name: "Unable to Determine" })).toBeInTheDocument();
  });

  it("locks new files and sends the locked Session in the UploadIntent request", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (input === "/api/upload-batches") {
        return new Response(JSON.stringify({ data: { batchPublicId: "UB-00000001" } }), { status: 200 });
      }
      if (input === "/api/upload-intents") {
        return new Response(JSON.stringify({
          data: {
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
          },
        }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(<UploadQueue sessions={sessions} lockedSessionPublicId="RS-OPEN0001" />);
    expect(screen.getByLabelText("已绑定 Recording Session")).toHaveTextContent("RS-OPEN0001");
    selectVideo();

    const card = await screen.findByRole("article");
    expect(within(card).queryByRole("combobox", { name: "Recording Session" })).not.toBeInTheDocument();
    expect(within(card).getByLabelText("锁定的 Recording Session")).toHaveTextContent("RS-OPEN0001 · 已锁定");
    fireEvent.click(await within(card).findByRole("button", { name: "开始直传 Storage" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload-intents",
      expect.objectContaining({ method: "POST" }),
    ));
    const uploadIntentCall = fetchMock.mock.calls.find(([input]) => input === "/api/upload-intents");
    const request = uploadIntentCall?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      claimedSessionPublicId: "RS-OPEN0001",
      unableToDetermine: false,
    });
    expect(mocks.persistUpload).toHaveBeenCalledWith(expect.objectContaining({
      claimedSessionPublicId: "RS-OPEN0001",
      unableToDetermine: false,
    }));
    view.unmount();
    await waitFor(() => expect(mocks.abortUpload).toHaveBeenCalledWith(false));
  });

  it("rejects a pending upload that is already bound to another Session", async () => {
    const savedForAnotherSession = {
      version: 2 as const,
      uploadPublicId: "UP-00000002",
      attemptPublicId: "UA-00000002",
      objectKey: "raw/other-session.mp4",
      originalFilename: "capture.mp4",
      sizeBytes: 5,
      contentType: "video/mp4",
      lastModified: 1_700_000_000_000,
      fingerprintV1: "fingerprint-v1",
      sourceSha256: "a".repeat(64),
      claimedSessionPublicId: "RS-OPEN0002",
      unableToDetermine: false,
      acceptedBytes: 0,
      status: "paused" as const,
      attemptExpiresAt: "2030-01-01T00:00:00.000Z",
      savedAt: "2026-09-02T00:00:00.000Z",
    };
    mocks.persistedUpload.mockReturnValue(savedForAnotherSession);
    mocks.persistedUploads.mockReturnValue([savedForAnotherSession]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<UploadQueue sessions={sessions} lockedSessionPublicId="RS-OPEN0001" />);
    selectVideo();

    const card = await screen.findByRole("article");
    await waitFor(() => expect(within(card).getByRole("alert")).toHaveTextContent(
      "该文件已有绑定其他 Session 的待恢复上传",
    ));
    expect(within(card).queryByRole("button", { name: "开始直传 Storage" })).not.toBeInTheDocument();
    expect(screen.queryByText("待恢复上传（1）")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
