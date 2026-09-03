"use client";

import { assign, createActor, setup, type ActorRefFrom } from "xstate";

export type QueueStatus =
  | "hashing"
  | "ready"
  | "preparing"
  | "uploading"
  | "paused"
  | "reconciling"
  | "verified"
  | "failed"
  | "aborted";

export type QueueItem = {
  id: string;
  file: File;
  extension: "mp4" | "mov" | "insv";
  contentType: "video/mp4" | "video/quicktime" | "application/octet-stream";
  fingerprintV1: string | null;
  sourceSha256: string | null;
  sessionChoice: string;
  note: string;
  status: QueueStatus;
  progress: number;
  acceptedBytes: number;
  uploadPublicId: string | null;
  attemptPublicId: string | null;
  error: string;
  resourceExpired: boolean;
  duplicateCandidate: boolean;
  resumed: boolean;
};

export type UploadItemEvent =
  | { type: "hashSucceeded" }
  | { type: "prepareRequested" }
  | { type: "retryRequested" }
  | { type: "uploadStarted" }
  | { type: "pauseRequested" }
  | { type: "resumeRequested" }
  | { type: "reconcileRequested" }
  | { type: "reconcileSucceeded" }
  | { type: "failed" }
  | { type: "abortRequested" };

export const uploadItemMachine = setup({
  types: {} as { events: UploadItemEvent },
}).createMachine({
  id: "participant-upload-item",
  initial: "hashing",
  states: {
    hashing: { on: { hashSucceeded: "ready", failed: "failed", abortRequested: "aborted" } },
    ready: { on: { prepareRequested: "preparing", failed: "failed", abortRequested: "aborted" } },
    preparing: { on: { uploadStarted: "uploading", failed: "failed", abortRequested: "aborted" } },
    uploading: { on: { pauseRequested: "paused", reconcileRequested: "reconciling", failed: "failed", abortRequested: "aborted" } },
    paused: { on: { resumeRequested: "uploading", reconcileRequested: "reconciling", failed: "failed", abortRequested: "aborted" } },
    reconciling: { on: { reconcileSucceeded: "verified", failed: "failed", abortRequested: "aborted" } },
    failed: { on: { retryRequested: "preparing", abortRequested: "aborted" } },
    verified: { type: "final" },
    aborted: { type: "final" },
  },
});

type UploadItemRef = ActorRefFrom<typeof uploadItemMachine>;
type UploadQueueContext = {
  items: QueueItem[];
  actors: Record<string, UploadItemRef>;
};
type UploadQueueEvent =
  | { type: "enqueue"; items: QueueItem[] }
  | { type: "patch"; id: string; patch: Partial<QueueItem>; itemEvent?: UploadItemEvent };

export const uploadQueueMachine = setup({
  types: {} as {
    context: UploadQueueContext;
    events: UploadQueueEvent;
  },
  guards: {
    acceptsPatch: ({ context, event }) => {
      if (event.type !== "patch" || !event.itemEvent) return true;
      return context.actors[event.id]?.getSnapshot().can(event.itemEvent) ?? false;
    },
  },
  actions: {
    forwardItemEvent: ({ context, event }) => {
      if (event.type === "patch" && event.itemEvent) {
        context.actors[event.id]?.send(event.itemEvent);
      }
    },
  },
  actors: {
    uploadItem: uploadItemMachine,
  },
}).createMachine({
  id: "participant-upload-queue",
  context: { items: [], actors: {} },
  on: {
    enqueue: {
      actions: assign(({ context, event, spawn }) => ({
        items: [...context.items, ...event.items],
        actors: {
          ...context.actors,
          ...Object.fromEntries(event.items.map((item) => [
            item.id,
            spawn("uploadItem", { id: `upload-item-${item.id}` }),
          ])),
        },
      })),
    },
    patch: {
      guard: "acceptsPatch",
      actions: [
        "forwardItemEvent",
        assign(({ context, event }) => ({
          items: context.items.map((item) => item.id === event.id ? { ...item, ...event.patch } : item),
        })),
      ],
    },
  },
});

export type UploadQueueRef = ActorRefFrom<typeof uploadQueueMachine>;

export function createUploadQueueActor() {
  return createActor(uploadQueueMachine);
}

function eventForStatus(current: QueueStatus, target: QueueStatus): UploadItemEvent | undefined {
  if (current === target) return undefined;
  switch (target) {
    case "ready": return { type: "hashSucceeded" };
    case "preparing": return { type: current === "failed" ? "retryRequested" : "prepareRequested" };
    case "uploading": return { type: current === "paused" ? "resumeRequested" : "uploadStarted" };
    case "paused": return { type: "pauseRequested" };
    case "reconciling": return { type: "reconcileRequested" };
    case "verified": return { type: "reconcileSucceeded" };
    case "failed": return { type: "failed" };
    case "aborted": return { type: "abortRequested" };
    case "hashing": return undefined;
  }
}

export function patchUploadQueueItem(
  actor: UploadQueueRef,
  id: string,
  patch: Partial<QueueItem>,
) {
  const current = actor.getSnapshot().context.items.find((item) => item.id === id);
  if (!current) return;
  const itemEvent = patch.status ? eventForStatus(current.status, patch.status) : undefined;
  actor.send({ type: "patch", id, patch, itemEvent });
}

export function uploadQueueItemCapabilities(actor: UploadQueueRef, id: string) {
  const snapshot = actor.getSnapshot().context.actors[id]?.getSnapshot();
  return {
    canPrepare: snapshot?.can({ type: "prepareRequested" }) ?? false,
    canRetry: snapshot?.can({ type: "retryRequested" }) ?? false,
    canPause: snapshot?.can({ type: "pauseRequested" }) ?? false,
    canResume: snapshot?.can({ type: "resumeRequested" }) ?? false,
    canAbort: snapshot?.can({ type: "abortRequested" }) ?? false,
  };
}
