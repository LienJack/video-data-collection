import { describe, expect, it } from "vitest";
import {
  createUploadQueueActor,
  patchUploadQueueItem,
  uploadQueueItemCapabilities,
  type QueueItem,
} from "../../apps/participant-web/app/(portal)/uploads/upload-queue-machine";

function fixture(id: string): QueueItem {
  return {
    id,
    file: new File([id], `${id}.mp4`, { type: "video/mp4" }),
    extension: "mp4",
    contentType: "video/mp4",
    fingerprintV1: null,
    sourceSha256: null,
    sessionChoice: "",
    note: "",
    status: "hashing",
    progress: 0,
    acceptedBytes: 0,
    uploadPublicId: null,
    attemptPublicId: null,
    error: "",
    resourceExpired: false,
    duplicateCandidate: false,
    resumed: false,
  };
}

describe("participant upload queue actor", () => {
  it("owns two independent child upload actors", () => {
    const queue = createUploadQueueActor().start();
    queue.send({ type: "enqueue", items: [fixture("first"), fixture("second")] });
    patchUploadQueueItem(queue, "first", { status: "ready" });
    patchUploadQueueItem(queue, "second", { status: "failed", error: "hash failed" });

    expect(queue.getSnapshot().context.items.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "first", status: "ready" },
      { id: "second", status: "failed" },
    ]);
    expect(queue.getSnapshot().context.actors.first.getSnapshot().value).toBe("ready");
    expect(queue.getSnapshot().context.actors.second.getSnapshot().value).toBe("failed");
  });

  it("rejects a stale completion after cancellation", () => {
    const queue = createUploadQueueActor().start();
    queue.send({ type: "enqueue", items: [fixture("clip")] });
    patchUploadQueueItem(queue, "clip", { status: "aborted" });
    patchUploadQueueItem(queue, "clip", { status: "verified", progress: 100 });
    expect(queue.getSnapshot().context.items[0]).toMatchObject({ status: "aborted", progress: 0 });
  });

  it("supports prepare, upload, pause, resume and reconciliation", () => {
    const queue = createUploadQueueActor().start();
    queue.send({ type: "enqueue", items: [fixture("clip")] });
    for (const status of ["ready", "preparing", "uploading", "paused", "uploading", "reconciling", "verified"] as const) {
      patchUploadQueueItem(queue, "clip", { status });
    }
    expect(queue.getSnapshot().context.items[0].status).toBe("verified");
    expect(uploadQueueItemCapabilities(queue, "clip")).toEqual({
      canPrepare: false,
      canRetry: false,
      canPause: false,
      canResume: false,
      canAbort: false,
    });
  });

  it("derives action capabilities from the child actor", () => {
    const queue = createUploadQueueActor().start();
    queue.send({ type: "enqueue", items: [fixture("clip")] });
    patchUploadQueueItem(queue, "clip", { status: "ready" });
    expect(uploadQueueItemCapabilities(queue, "clip")).toMatchObject({
      canPrepare: true,
      canRetry: false,
      canAbort: true,
    });
    patchUploadQueueItem(queue, "clip", { status: "failed" });
    expect(uploadQueueItemCapabilities(queue, "clip")).toMatchObject({
      canPrepare: false,
      canRetry: true,
      canAbort: true,
    });
  });
});
