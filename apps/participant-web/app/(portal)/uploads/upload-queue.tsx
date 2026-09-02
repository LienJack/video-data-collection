"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Badge } from "@egocapture/ui/components/badge";
import { Card } from "@egocapture/ui/components/card";
import { Label } from "@egocapture/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { Progress } from "@egocapture/ui/components/progress";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@egocapture/ui/lib/i18n";
import { useActorRef, useSelector } from "@xstate/react";
import type { Upload } from "tus-js-client";
import { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_BATCH } from "@egocapture/core/domain/constants";
import { fingerprintFile } from "@egocapture/core/upload/fingerprint";
import {
  legacyPersistedUploadCount,
  migrateLegacyPersistedUpload,
  persistUpload,
  persistedUpload,
  persistedUploads,
  removePersistedUpload,
  updatePersistedUpload,
  type PersistedUpload,
} from "@egocapture/core/upload/persistence";
import {
  createTusUpload,
  startOrResumeTus,
  type TusCredential,
} from "@egocapture/core/upload/tus";
import {
  patchUploadQueueItem,
  uploadQueueItemCapabilities,
  uploadQueueMachine,
  type QueueItem,
  type QueueStatus,
} from "./upload-queue-machine";

type SessionOption = {
  publicId: string;
  assignmentPublicId: string;
  taskTitle: string;
  deviceLabel: string;
};

type ApiPayload<T> = { data?: T; error?: { code?: string; message?: string } };
type RestorableUpload = PersistedUpload & { attemptExpired: boolean };
type UploadCredential = TusCredential & { duplicateCandidate?: boolean };

class ApiClientError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, message: string) {
    super(message);
  }
}

const expectedFileType: Record<string, QueueItem["contentType"]> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  insv: "application/octet-stream",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload = await response.json() as ApiPayload<T>;
  if (!response.ok || !payload.data) {
    throw new ApiClientError(response.status, payload.error?.code, payload.error?.message || "REQUEST_FAILED");
  }
  return payload.data;
}

export function UploadQueue({
  sessions,
  lockedSessionPublicId,
}: {
  sessions: SessionOption[];
  lockedSessionPublicId?: string;
}) {
  const i18n = useI18n();
  const queue = useActorRef(uploadQueueMachine);
  const items = useSelector(queue, (snapshot) => snapshot.context.items);
  const lockedSession = lockedSessionPublicId
    ? sessions.find((session) => session.publicId === lockedSessionPublicId)
    : undefined;
  const [selectionError, setSelectionError] = useState("");
  const [restorableUploads, setRestorableUploads] = useState<RestorableUpload[]>([]);
  const [legacyRestorableCount, setLegacyRestorableCount] = useState(0);
  const uploads = useRef(new Map<string, Upload>());
  const operationTokens = useRef(new Map<string, symbol>());
  const mounted = useRef(false);
  const progressReports = useRef(new Map<string, Promise<void>>());
  const batchPublicId = useRef<string | null>(null);
  const batchPromise = useRef<Promise<string> | null>(null);

  useEffect(() => {
    const activeOperations = operationTokens.current;
    const activeUploads = uploads.current;
    const activeProgressReports = progressReports.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeOperations.clear();
      for (const upload of activeUploads.values()) {
        void Promise.resolve(upload.abort(false)).catch(() => undefined);
      }
      activeUploads.clear();
      activeProgressReports.clear();
    };
  }, []);

  function restorableUploadsForContext() {
    return persistedUploads()
      .filter((upload) => !lockedSessionPublicId || (
        !upload.unableToDetermine && upload.claimedSessionPublicId === lockedSessionPublicId
      ))
      .map((upload) => ({
        ...upload,
        attemptExpired: new Date(upload.attemptExpiresAt).getTime() <= Date.now(),
      }));
  }

  useEffect(() => {
    queueMicrotask(() => {
      setRestorableUploads(restorableUploadsForContext());
      setLegacyRestorableCount(lockedSessionPublicId ? 0 : legacyPersistedUploadCount());
    });
    // The persisted upload snapshot only needs to be refreshed when the route's
    // locked Session context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedSessionPublicId]);
  useEffect(() => {
    const active = items.some((item) => item.status === "uploading" || item.status === "reconciling");
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [items]);

  function update(id: string, patch: Partial<QueueItem>) {
    patchUploadQueueItem(queue, id, patch);
  }

  function currentItem(id: string) {
    return queue.getSnapshot().context.items.find((item) => item.id === id);
  }

  function itemHasStatus(id: string, statuses: QueueStatus[]) {
    const status = currentItem(id)?.status;
    return status !== undefined && statuses.includes(status);
  }

  function beginOperation(id: string) {
    const token = Symbol(id);
    operationTokens.current.set(id, token);
    return token;
  }

  function isCurrentOperation(id: string, token: symbol) {
    return mounted.current && operationTokens.current.get(id) === token;
  }

  async function abortCredential(credential: TusCredential) {
    try {
      await api(`/api/uploads/${credential.uploadPublicId}/abort`, { method: "POST" });
    } catch {
      // The server abort is idempotent; local cleanup must still finish.
    }
  }

  function refreshRestorableUploads() {
    setRestorableUploads(restorableUploadsForContext());
  }

  async function ensureBatch() {
    if (batchPublicId.current) return batchPublicId.current;
    batchPromise.current ??= api<{ batchPublicId: string }>("/api/upload-batches", {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
    }).then((result) => {
      batchPublicId.current = result.batchPublicId;
      return result.batchPublicId;
    }).finally(() => { batchPromise.current = null; });
    return await batchPromise.current;
  }

  function queueItemFor(file: File): QueueItem | null {
    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
    if (!(extension in expectedFileType)) {
      setSelectionError(i18n.t("participantUi.queue.invalidType", { file: file.name }));
      return null;
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE_BYTES) {
      setSelectionError(i18n.t("participantUi.queue.invalidSize", { file: file.name }));
      return null;
    }
    const expected = expectedFileType[extension];
    if (file.type && file.type !== expected && !(extension === "insv" && file.type === "")) {
      setSelectionError(i18n.t("participantUi.queue.mimeMismatch", { file: file.name }));
      return null;
    }
    return {
      id: crypto.randomUUID(),
      file,
      extension: extension as QueueItem["extension"],
      contentType: expected,
      fingerprintV1: null,
      sourceSha256: null,
      sessionChoice: lockedSessionPublicId ?? "",
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

  async function hashQueueItem(item: QueueItem, expectedSaved?: PersistedUpload) {
    try {
      const fingerprints = await fingerprintFile(item.file);
      let discovered = expectedSaved ?? persistedUpload(fingerprints.sourceSha256) ?? undefined;
      if (!discovered && !expectedSaved) {
        discovered = migrateLegacyPersistedUpload(fingerprints.fingerprintV1, {
          contentType: item.contentType,
          lastModified: item.file.lastModified,
          sourceSha256: fingerprints.sourceSha256,
          originalFilename: item.file.name,
          sizeBytes: item.file.size,
        }) ?? undefined;
        if (discovered && !lockedSessionPublicId) setLegacyRestorableCount(legacyPersistedUploadCount());
      }
      const saved = discovered
        && discovered.sourceSha256 === fingerprints.sourceSha256
        && discovered.sizeBytes === item.file.size
        && discovered.originalFilename === item.file.name
        ? discovered
        : undefined;
      if (saved && lockedSessionPublicId && (
        saved.unableToDetermine || saved.claimedSessionPublicId !== lockedSessionPublicId
      )) {
        update(item.id, {
          fingerprintV1: fingerprints.fingerprintV1,
          sourceSha256: fingerprints.sourceSha256,
          status: "failed",
          error: i18n.t("participantUi.queue.boundElsewhere"),
        });
        return;
      }
      if (expectedSaved && !saved) {
        update(item.id, {
          fingerprintV1: fingerprints.fingerprintV1,
          sourceSha256: fingerprints.sourceSha256,
          status: "failed",
          error: i18n.t("participantUi.queue.restoreMismatch"),
        });
        return;
      }
      update(item.id, {
        fingerprintV1: fingerprints.fingerprintV1,
        sourceSha256: fingerprints.sourceSha256,
        status: "ready",
        progress: saved && saved.sizeBytes > 0
          ? Math.round((saved.acceptedBytes / saved.sizeBytes) * 1000) / 10
          : 0,
        acceptedBytes: saved?.acceptedBytes ?? 0,
        sessionChoice: saved
          ? (saved.unableToDetermine ? "unable" : saved.claimedSessionPublicId ?? "")
          : lockedSessionPublicId ?? "",
        uploadPublicId: saved?.uploadPublicId ?? null,
        attemptPublicId: saved?.attemptPublicId ?? null,
      });
      if (saved) {
        setRestorableUploads((current) => current.filter((upload) => upload.sourceSha256 !== saved.sourceSha256));
      }
    } catch {
      update(item.id, { status: "failed", error: i18n.t("participantUi.queue.hashFailed") });
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setSelectionError("");
    if (files.length > MAX_FILES_PER_BATCH) {
      setSelectionError(i18n.t("participantUi.queue.batchLimit", { count: MAX_FILES_PER_BATCH }));
      return;
    }
    const next = [...files].map(queueItemFor).filter((item): item is QueueItem => item !== null);
    queue.send({ type: "enqueue", items: next });
    await Promise.all(next.map((item) => hashQueueItem(item)));
  }

  async function onRestoreFile(saved: PersistedUpload, file: File | undefined) {
    if (!file) return;
    setSelectionError("");
    const item = queueItemFor(file);
    if (!item) return;
    queue.send({ type: "enqueue", items: [item] });
    await hashQueueItem(item, saved);
  }

  async function credentialFor(item: QueueItem, forceNew: boolean): Promise<UploadCredential> {
    if (!item.fingerprintV1 || !item.sourceSha256) throw new Error(i18n.t("participantUi.queue.hashingPending"));
    const saved = persistedUpload(item.sourceSha256);
    if (saved && lockedSessionPublicId && (
      saved.unableToDetermine || saved.claimedSessionPublicId !== lockedSessionPublicId
    )) {
      throw new Error(i18n.t("participantUi.queue.boundElsewhere"));
    }
    if (saved && saved.sizeBytes === item.file.size && saved.originalFilename === item.file.name) {
      try {
        const status = await api<{ transferStatus: string }>(`/api/uploads/${saved.uploadPublicId}`);
        if (!["verified", "aborted", "expired"].includes(status.transferStatus)) {
          const credential = await api<TusCredential & { resumedExistingAttempt: boolean }>(
            `/api/uploads/${saved.uploadPublicId}/attempts`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                forceNew,
                reasonCode: forceNew ? "tus_expired" : "resume",
              }),
            },
          );
          return credential;
        }
        removePersistedUpload(item.sourceSha256);
        refreshRestorableUploads();
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          removePersistedUpload(item.sourceSha256);
          refreshRestorableUploads();
        } else {
          throw error;
        }
      }
    }
    const batch = await ensureBatch();
    const sessionChoice = lockedSessionPublicId ?? item.sessionChoice;
    const unableToDetermine = !lockedSessionPublicId && sessionChoice === "unable";
    const credential = await api<TusCredential & { duplicateCandidate: boolean }>("/api/upload-intents", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        batchPublicId: batch,
        originalFilename: item.file.name,
        sizeBytes: item.file.size,
        contentType: item.contentType,
        extension: item.extension,
        localModifiedAt: Number.isFinite(item.file.lastModified)
          ? new Date(item.file.lastModified).toISOString()
          : null,
        claimedSessionPublicId: unableToDetermine ? null : sessionChoice,
        unableToDetermine,
        fingerprintV1: item.fingerprintV1,
        participantNote: item.note.trim() || null,
      }),
    });
    return credential;
  }

  function reportAttemptProgress(
    itemId: string,
    uploadPublicId: string,
    attemptPublicId: string,
    status: "uploading" | "paused",
    bytesUploaded: number,
  ) {
    const previous = progressReports.current.get(itemId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await api(`/api/uploads/${uploadPublicId}/attempts/${attemptPublicId}/progress`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status, bytesUploaded }),
        });
      })
      .catch(() => undefined);
    progressReports.current.set(itemId, next);
    void next.finally(() => {
      if (progressReports.current.get(itemId) === next) progressReports.current.delete(itemId);
    });
    return next;
  }

  async function start(item: QueueItem, forceNew = false) {
    const capabilities = uploadQueueItemCapabilities(queue, item.id);
    if (!(capabilities.canPrepare || capabilities.canRetry)) return;
    const sessionChoice = lockedSessionPublicId ?? item.sessionChoice;
    if (!sessionChoice) {
      update(item.id, { error: i18n.t("participantUi.queue.chooseSession") });
      return;
    }
    const operationToken = beginOperation(item.id);
    update(item.id, { status: "preparing", error: "", resourceExpired: false });
    let credential: UploadCredential | undefined;
    try {
      const sourceSha256 = item.sourceSha256!;
      const savedBefore = persistedUpload(sourceSha256);
      credential = await credentialFor(item, forceNew);
      if (!isCurrentOperation(item.id, operationToken)) {
        await abortCredential(credential);
        return;
      }
      const activeCredential = credential;
      update(item.id, {
        uploadPublicId: activeCredential.uploadPublicId,
        attemptPublicId: activeCredential.attemptPublicId,
        duplicateCandidate: activeCredential.duplicateCandidate ?? item.duplicateCandidate,
      });
      const fingerprint = item.fingerprintV1!;
      const resumesSameAttempt = savedBefore?.uploadPublicId === activeCredential.uploadPublicId
        && savedBefore.attemptPublicId === activeCredential.attemptPublicId;
      const acceptedBytes = resumesSameAttempt ? savedBefore.acceptedBytes : 0;
      persistUpload({
        version: 2,
        uploadPublicId: activeCredential.uploadPublicId,
        attemptPublicId: activeCredential.attemptPublicId,
        objectKey: activeCredential.objectKey,
        originalFilename: item.file.name,
        sizeBytes: item.file.size,
        contentType: item.contentType,
        lastModified: item.file.lastModified,
        fingerprintV1: fingerprint,
        sourceSha256,
        claimedSessionPublicId: sessionChoice === "unable" ? null : sessionChoice,
        unableToDetermine: sessionChoice === "unable",
        acceptedBytes,
        status: "preparing",
        attemptExpiresAt: activeCredential.attemptExpiresAt,
        savedAt: new Date().toISOString(),
      });
      update(item.id, { acceptedBytes });
      const tus = createTusUpload(item.file, activeCredential, fingerprint, item.contentType, {
        onProgress: (uploaded, total) => {
          if (!isCurrentOperation(item.id, operationToken)
            || !itemHasStatus(item.id, ["preparing", "uploading"])) return;
          update(item.id, {
            status: "uploading",
            progress: total > 0 ? Math.round((uploaded / total) * 1000) / 10 : 0,
          });
        },
        onChunkComplete: (_chunkSize, bytesAccepted, bytesTotal) => {
          if (!isCurrentOperation(item.id, operationToken)
            || !itemHasStatus(item.id, ["preparing", "uploading"])) return;
          update(item.id, {
            status: "uploading",
            acceptedBytes: bytesAccepted,
            progress: bytesTotal > 0 ? Math.round((bytesAccepted / bytesTotal) * 1000) / 10 : 0,
          });
          updatePersistedUpload(sourceSha256, { acceptedBytes: bytesAccepted, status: "uploading" });
          void reportAttemptProgress(
            item.id,
            activeCredential.uploadPublicId,
            activeCredential.attemptPublicId,
            "uploading",
            bytesAccepted,
          );
        },
        onError: (error, resourceExpired) => {
          if (!isCurrentOperation(item.id, operationToken)) return;
          updatePersistedUpload(sourceSha256, { status: "failed" });
          update(item.id, {
            status: "failed",
            error: resourceExpired
              ? i18n.t("participantUi.queue.resourceExpired")
              : i18n.t("participantUi.queue.uploadFailed", { message: i18n.t("participantUi.queue.requestFailed") }),
            resourceExpired,
          });
          operationTokens.current.delete(item.id);
        },
        onSuccess: async () => {
          if (!isCurrentOperation(item.id, operationToken)
            || !itemHasStatus(item.id, ["uploading", "paused"])) return;
          update(item.id, { status: "reconciling", progress: 100 });
          try {
            await (progressReports.current.get(item.id) ?? Promise.resolve());
            if (!isCurrentOperation(item.id, operationToken)) return;
            await api(`/api/uploads/${activeCredential.uploadPublicId}/complete`, { method: "POST" });
            if (!isCurrentOperation(item.id, operationToken)) return;
            removePersistedUpload(sourceSha256);
            uploads.current.delete(item.id);
            progressReports.current.delete(item.id);
            update(item.id, { status: "verified", error: "" });
            operationTokens.current.delete(item.id);
            try {
              await api(`/api/uploads/${activeCredential.uploadPublicId}/extract-metadata`, { method: "POST" });
            } catch (error) {
              if (!mounted.current || !itemHasStatus(item.id, ["verified"])) return;
              update(item.id, {
                status: "verified",
                error: i18n.t("participantUi.queue.metadataFailed", { message: error instanceof ApiClientError && error.code ? i18n.error(error.code) : i18n.t("participantUi.queue.parseFailed") }),
              });
            }
          } catch (error) {
            if (!isCurrentOperation(item.id, operationToken)) return;
            update(item.id, { status: "failed", error: error instanceof ApiClientError && error.code ? i18n.error(error.code) : i18n.t("participantUi.queue.reconcileFailed") });
            operationTokens.current.delete(item.id);
          }
        },
      });
      uploads.current.set(item.id, tus);
      const resumed = await startOrResumeTus(tus, {
        requirePrevious: resumesSameAttempt,
        discardPrevious: Boolean(savedBefore && !resumesSameAttempt),
        shouldStart: () => isCurrentOperation(item.id, operationToken),
      });
      if (!isCurrentOperation(item.id, operationToken)) return;
      update(item.id, { status: "uploading", resumed });
    } catch (error) {
      if (!isCurrentOperation(item.id, operationToken)) {
        if (credential) await abortCredential(credential);
        if (item.sourceSha256) removePersistedUpload(item.sourceSha256);
        return;
      }
      const missingSavedResource = error instanceof Error && error.message === "TUS_SAVED_RESOURCE_MISSING";
      if (item.sourceSha256) updatePersistedUpload(item.sourceSha256, { status: "failed" });
      update(item.id, {
        status: "failed",
        error: missingSavedResource
          ? i18n.t("participantUi.queue.savedResourceMissing")
          : error instanceof ApiClientError && error.code ? i18n.error(error.code) : i18n.t("participantUi.queue.prepareFailed"),
        resourceExpired: missingSavedResource,
      });
      operationTokens.current.delete(item.id);
    }
  }

  async function pause(item: QueueItem) {
    if (!uploadQueueItemCapabilities(queue, item.id).canPause) return;
    update(item.id, { status: "paused" });
    await uploads.current.get(item.id)?.abort(false);
    const acceptedBytes = item.sourceSha256
      ? persistedUpload(item.sourceSha256)?.acceptedBytes ?? item.acceptedBytes
      : item.acceptedBytes;
    if (item.sourceSha256) updatePersistedUpload(item.sourceSha256, { acceptedBytes, status: "paused" });
    if (item.uploadPublicId && item.attemptPublicId) {
      await reportAttemptProgress(item.id, item.uploadPublicId, item.attemptPublicId, "paused", acceptedBytes);
    }
    update(item.id, { acceptedBytes });
  }

  async function resume(item: QueueItem) {
    const acceptedBytes = item.sourceSha256
      ? persistedUpload(item.sourceSha256)?.acceptedBytes ?? item.acceptedBytes
      : item.acceptedBytes;
    if (item.sourceSha256) updatePersistedUpload(item.sourceSha256, { status: "uploading" });
    if (item.uploadPublicId && item.attemptPublicId) {
      await reportAttemptProgress(item.id, item.uploadPublicId, item.attemptPublicId, "uploading", acceptedBytes);
    }
    uploads.current.get(item.id)?.start();
    update(item.id, { status: "uploading", error: "" });
  }

  async function cancel(item: QueueItem) {
    operationTokens.current.delete(item.id);
    const latest = currentItem(item.id) ?? item;
    update(item.id, { status: "aborted", error: "" });
    try { await uploads.current.get(item.id)?.abort(true); } catch { /* Server state is still aborted below. */ }
    if (latest.uploadPublicId) {
      try { await api(`/api/uploads/${latest.uploadPublicId}/abort`, { method: "POST" }); } catch { /* Keep local terminal state. */ }
    }
    if (latest.sourceSha256) removePersistedUpload(latest.sourceSha256);
    uploads.current.delete(item.id);
    progressReports.current.delete(item.id);
  }

  return (
    <section className="mt-8">
      {lockedSession ? (
        <div aria-label={i18n.t("participantUi.queue.boundSessionAria")} className="mb-5 border-l-4 border-[var(--teal)] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{i18n.t("participantUi.queue.boundSession")}</p>
          <p className="mt-2 font-bold">{lockedSession.publicId} · {lockedSession.taskTitle}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{lockedSession.deviceLabel}</p>
        </div>
      ) : null}
      <Label className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl block cursor-pointer border-dashed p-8 text-center transition hover:border-[var(--signal)] hover:bg-white sm:p-12">
        <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-[var(--teal-soft)] text-xl text-[var(--signal)]">＋</span>
        <span className="display block text-2xl font-semibold">{i18n.t("participantUi.queue.chooseFiles")}</span>
        <span className="mt-2 block text-sm leading-6 text-[var(--muted)]">{i18n.t("participantUi.queue.fileLimits")}</span>
        <Input
          type="file"
          multiple
          accept=".mp4,.mov,.insv,video/mp4,video/quicktime,application/octet-stream"
          onChange={(event) => void onFiles(event.target.files)}
          className="mt-5 block w-full text-sm"
        />
      </Label>
      {restorableUploads.length > 0 ? (
        <section className="mt-5 space-y-3" aria-labelledby="restorable-uploads-title">
          <div className="border-l-4 border-[var(--yellow)] px-4 py-3">
            <h2 id="restorable-uploads-title" className="font-bold">{i18n.t("participantUi.queue.restorable", { count: restorableUploads.length })}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{i18n.t("participantUi.queue.restoreHelp")}</p>
          </div>
          {restorableUploads.map((saved) => {
            const progress = saved.sizeBytes > 0
              ? Math.round((saved.acceptedBytes / saved.sizeBytes) * 1000) / 10
              : 0;
            return (
              <Card as="article" key={saved.sourceSha256} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold break-all">{saved.originalFilename}</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {i18n.t("participantUi.queue.acceptedSaved", { accepted: i18n.bytes(saved.acceptedBytes), total: i18n.bytes(saved.sizeBytes), date: i18n.date(saved.savedAt, { dateStyle: "medium", timeStyle: "short" }) })}
                    </p>
                  </div>
                  <Badge>{saved.attemptExpired ? i18n.t("participantUi.queue.mayBeExpired") : i18n.state("upload_attempt.status", saved.status)}</Badge>
                </div>
                <Progress className="mt-4" value={progress} aria-label={i18n.t("participantUi.queue.restoreProgress", { progress: progress.toFixed(1) })} />
                <Label className="mt-4 block text-sm font-bold">{i18n.t("participantUi.queue.chooseOriginal")}
                  <Input
                    type="file"
                    accept={`.${saved.originalFilename.split(".").at(-1)?.toLowerCase() ?? "mp4"}`}
                    onChange={(event) => void onRestoreFile(saved, event.target.files?.[0])}
                    className="mt-2 block w-full text-sm font-normal"
                  />
                </Label>
              </Card>
            );
          })}
        </section>
      ) : null}
      {legacyRestorableCount > 0 ? (
        <p className="mt-4 border-l-4 border-[var(--yellow)] px-4 py-3 text-sm">
          {i18n.t("participantUi.queue.legacyRestore", { count: legacyRestorableCount })}
        </p>
      ) : null}
      {selectionError ? <Alert role="alert" className="mt-4 border-l-4 border-[var(--signal)] px-4 py-3 text-sm"><AlertDescription>{selectionError}</AlertDescription></Alert> : null}
      <div className="mt-6 space-y-5">
        {items.map((item) => {
          const capabilities = uploadQueueItemCapabilities(queue, item.id);
          return (
          <Card as="article" key={item.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-bold break-all">{item.file.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">{i18n.bytes(item.file.size)} · {item.contentType} · {i18n.t("participantUi.queue.modifiedAt", { date: i18n.date(item.file.lastModified, { dateStyle: "medium", timeStyle: "short" }) })}</p></div>
              <Badge>{item.status === "hashing" ? i18n.t("participantUi.queue.hashing") : item.status === "ready" ? i18n.t("participantUi.previewReady") : item.status === "preparing" ? i18n.t("common.loading") : i18n.state("upload_intent.transfer_status", item.status)}</Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {lockedSession ? <div className="text-sm"><p className="font-bold">{i18n.t("participantUi.queue.recordingSession")}</p><p className="mt-2 border border-[var(--line)] bg-[var(--paper)] px-3 py-3" aria-label={i18n.t("participantUi.queue.lockedSessionAria")}>{lockedSession.publicId} · {i18n.t("participantUi.queue.locked")}</p></div> : <Label className="text-sm font-bold">{i18n.t("participantUi.queue.recordingSession")}
                <NativeSelect
                  value={item.sessionChoice}
                  disabled={!(["ready", "failed"].includes(item.status)) || Boolean(item.uploadPublicId)}
                  onChange={(event) => update(item.id, { sessionChoice: event.target.value, error: "" })}
                  className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 font-normal"
                >
                  <NativeSelectOption value="">{i18n.t("participantUi.queue.choose")}</NativeSelectOption>
                  {sessions.map((session) => <NativeSelectOption key={session.publicId} value={session.publicId}>{session.publicId} · {session.taskTitle} · {session.deviceLabel}</NativeSelectOption>)}
                  <NativeSelectOption value="unable">{i18n.t("participantUi.unableDetermine")}</NativeSelectOption>
                </NativeSelect>
              </Label>}
              <Label className="text-sm font-bold">{i18n.t("participantUi.queue.note")}
                <Input value={item.note} disabled={Boolean(item.uploadPublicId)} onChange={(event) => update(item.id, { note: event.target.value.slice(0, 500) })} className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 font-normal" placeholder={i18n.t("participantUi.queue.notePlaceholder")} />
              </Label>
            </div>
            <Progress className="mt-5" value={item.progress} aria-label={i18n.t("participantUi.queue.uploadProgress", { progress: item.progress.toFixed(1) })} />
            <div className="mt-2 flex justify-between text-xs text-[var(--muted)]"><span>{item.sourceSha256 ? `SHA-256 ${item.sourceSha256.slice(0, 12)}…` : i18n.t("participantUi.queue.hashing")}</span><span>{item.progress.toFixed(1)}%</span></div>
            {item.resumed ? <p className="mt-3 text-xs font-bold text-[var(--teal)]">{i18n.t("participantUi.queue.resumed")}</p> : null}
            {item.duplicateCandidate ? <p className="mt-3 border-l-4 border-[var(--yellow)] px-3 text-xs">{i18n.t("participantUi.queue.duplicate")}</p> : null}
            {item.error ? <Alert role="alert" className="mt-3 border-l-4 border-[var(--signal)] px-3 text-sm"><AlertDescription>{item.error}</AlertDescription></Alert> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {capabilities.canPrepare ? <Button onClick={() => void start(item)}>{i18n.t("participantUi.queue.start")}</Button> : null}
              {capabilities.canPause ? <Button variant="outline" onClick={() => void pause(item)} className="border-[var(--ink)] px-4 py-3 text-sm font-bold">{i18n.t("participantUi.queue.pause")}</Button> : null}
              {capabilities.canResume ? <Button onClick={() => void resume(item)}>{i18n.t("participantUi.queue.resume")}</Button> : null}
              {capabilities.canRetry && item.uploadPublicId ? <Button onClick={() => void start(item, item.resourceExpired)} className="bg-[var(--signal)] px-4 py-3 text-sm font-bold text-white">{item.resourceExpired ? i18n.t("participantUi.queue.newAttemptRetry") : i18n.t("participantUi.queue.resumeRetry")}</Button> : null}
              {capabilities.canAbort ? <Button variant="outline" onClick={() => void cancel(item)} className="border-[var(--signal)] px-4 py-3 text-sm font-bold text-[var(--signal)]">{i18n.t("participantUi.queue.abort")}</Button> : null}
              {item.uploadPublicId ? <Link href={`/uploads/${item.uploadPublicId}`} className="border border-[var(--line)] px-4 py-3 text-sm font-bold">{i18n.t("participantUi.queue.serverStatus")}</Link> : null}
            </div>
          </Card>
          );
        })}
      </div>
    </section>
  );
}
