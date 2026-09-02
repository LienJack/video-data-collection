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

type SessionOption = {
  publicId: string;
  assignmentPublicId: string;
  taskTitle: string;
  deviceLabel: string;
};

type QueueStatus =
  | "hashing"
  | "ready"
  | "preparing"
  | "uploading"
  | "paused"
  | "reconciling"
  | "verified"
  | "failed"
  | "aborted";

type QueueItem = {
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

type ApiPayload<T> = { data?: T; error?: { code?: string; message?: string } };
type RestorableUpload = PersistedUpload & { attemptExpired: boolean };

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
    throw new ApiClientError(response.status, payload.error?.code, payload.error?.message || "请求失败");
  }
  return payload.data;
}

function formatBytes(value: number) {
  return value < 1024 * 1024
    ? `${(value / 1024).toFixed(1)} KiB`
    : `${(value / 1024 / 1024).toFixed(1)} MiB`;
}

export function UploadQueue({
  sessions,
  lockedSessionPublicId,
}: {
  sessions: SessionOption[];
  lockedSessionPublicId?: string;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const lockedSession = lockedSessionPublicId
    ? sessions.find((session) => session.publicId === lockedSessionPublicId)
    : undefined;
  const [selectionError, setSelectionError] = useState("");
  const [restorableUploads, setRestorableUploads] = useState<RestorableUpload[]>([]);
  const [legacyRestorableCount, setLegacyRestorableCount] = useState(0);
  const uploads = useRef(new Map<string, Upload>());
  const progressReports = useRef(new Map<string, Promise<void>>());
  const batchPublicId = useRef<string | null>(null);
  const batchPromise = useRef<Promise<string> | null>(null);

  useEffect(() => () => {
    for (const upload of uploads.current.values()) {
      void Promise.resolve(upload.abort(false)).catch(() => undefined);
    }
    uploads.current.clear();
    progressReports.current.clear();
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
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
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
      setSelectionError(`${file.name} 不是 MP4、MOV 或 INSV`);
      return null;
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE_BYTES) {
      setSelectionError(`${file.name} 超过 50,000,000 bytes 或为空文件`);
      return null;
    }
    const expected = expectedFileType[extension];
    if (file.type && file.type !== expected && !(extension === "insv" && file.type === "")) {
      setSelectionError(`${file.name} 的浏览器 MIME 与扩展名不匹配`);
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
          error: "该文件已有绑定其他 Session 的待恢复上传，请从通用上传页恢复或选择其他文件",
        });
        return;
      }
      if (expectedSaved && !saved) {
        update(item.id, {
          fingerprintV1: fingerprints.fingerprintV1,
          sourceSha256: fingerprints.sourceSha256,
          status: "failed",
          error: "所选文件与待恢复任务的原始文件不一致，请重新选择",
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
      update(item.id, { status: "failed", error: "无法计算完整文件 SHA-256" });
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setSelectionError("");
    if (files.length > MAX_FILES_PER_BATCH) {
      setSelectionError(`每批最多选择 ${MAX_FILES_PER_BATCH} 个文件`);
      return;
    }
    const next = [...files].map(queueItemFor).filter((item): item is QueueItem => item !== null);
    setItems((current) => [...current, ...next]);
    await Promise.all(next.map((item) => hashQueueItem(item)));
  }

  async function onRestoreFile(saved: PersistedUpload, file: File | undefined) {
    if (!file) return;
    setSelectionError("");
    const item = queueItemFor(file);
    if (!item) return;
    setItems((current) => [...current, item]);
    await hashQueueItem(item, saved);
  }

  async function credentialFor(item: QueueItem, forceNew: boolean): Promise<TusCredential> {
    if (!item.fingerprintV1 || !item.sourceSha256) throw new Error("文件指纹尚未完成");
    const saved = persistedUpload(item.sourceSha256);
    if (saved && lockedSessionPublicId && (
      saved.unableToDetermine || saved.claimedSessionPublicId !== lockedSessionPublicId
    )) {
      throw new Error("该文件已有绑定其他 Session 的待恢复上传，请从通用上传页恢复或选择其他文件");
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
          update(item.id, {
            uploadPublicId: credential.uploadPublicId,
            attemptPublicId: credential.attemptPublicId,
          });
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
    update(item.id, {
      uploadPublicId: credential.uploadPublicId,
      attemptPublicId: credential.attemptPublicId,
      duplicateCandidate: credential.duplicateCandidate,
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
    const sessionChoice = lockedSessionPublicId ?? item.sessionChoice;
    if (!sessionChoice) {
      update(item.id, { error: "请为这个文件选择 Recording Session 或 Unable to Determine" });
      return;
    }
    update(item.id, { status: "preparing", error: "", resourceExpired: false });
    try {
      const sourceSha256 = item.sourceSha256!;
      const savedBefore = persistedUpload(sourceSha256);
      const credential = await credentialFor(item, forceNew);
      const fingerprint = item.fingerprintV1!;
      const resumesSameAttempt = savedBefore?.uploadPublicId === credential.uploadPublicId
        && savedBefore.attemptPublicId === credential.attemptPublicId;
      const acceptedBytes = resumesSameAttempt ? savedBefore.acceptedBytes : 0;
      persistUpload({
        version: 2,
        uploadPublicId: credential.uploadPublicId,
        attemptPublicId: credential.attemptPublicId,
        objectKey: credential.objectKey,
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
        attemptExpiresAt: credential.attemptExpiresAt,
        savedAt: new Date().toISOString(),
      });
      update(item.id, { acceptedBytes });
      const tus = createTusUpload(item.file, credential, fingerprint, item.contentType, {
        onProgress: (uploaded, total) => update(item.id, {
          status: "uploading",
          progress: total > 0 ? Math.round((uploaded / total) * 1000) / 10 : 0,
        }),
        onChunkComplete: (_chunkSize, bytesAccepted, bytesTotal) => {
          update(item.id, {
            status: "uploading",
            acceptedBytes: bytesAccepted,
            progress: bytesTotal > 0 ? Math.round((bytesAccepted / bytesTotal) * 1000) / 10 : 0,
          });
          updatePersistedUpload(sourceSha256, { acceptedBytes: bytesAccepted, status: "uploading" });
          void reportAttemptProgress(
            item.id,
            credential.uploadPublicId,
            credential.attemptPublicId,
            "uploading",
            bytesAccepted,
          );
        },
        onError: (error, resourceExpired) => {
          updatePersistedUpload(sourceSha256, { status: "failed" });
          update(item.id, {
            status: "failed",
            error: resourceExpired
              ? "TUS 资源已过期；重试会创建新的 UploadAttempt"
              : `上传失败：${error.message}`,
            resourceExpired,
          });
        },
        onSuccess: async () => {
          update(item.id, { status: "reconciling", progress: 100 });
          try {
            await (progressReports.current.get(item.id) ?? Promise.resolve());
            await api(`/api/uploads/${credential.uploadPublicId}/complete`, { method: "POST" });
            removePersistedUpload(sourceSha256);
            uploads.current.delete(item.id);
            progressReports.current.delete(item.id);
            update(item.id, { status: "verified", error: "" });
            try {
              await api(`/api/uploads/${credential.uploadPublicId}/extract-metadata`, { method: "POST" });
            } catch (error) {
              update(item.id, {
                status: "verified",
                error: `视频已完成并通过对象对账；Metadata ${error instanceof Error ? error.message : "解析失败"}`,
              });
            }
          } catch (error) {
            update(item.id, { status: "failed", error: error instanceof Error ? error.message : "对象对账失败" });
          }
        },
      });
      uploads.current.set(item.id, tus);
      const resumed = await startOrResumeTus(tus, {
        requirePrevious: resumesSameAttempt,
        discardPrevious: Boolean(savedBefore && !resumesSameAttempt),
      });
      update(item.id, { status: "uploading", resumed });
    } catch (error) {
      const missingSavedResource = error instanceof Error && error.message === "TUS_SAVED_RESOURCE_MISSING";
      if (item.sourceSha256) updatePersistedUpload(item.sourceSha256, { status: "failed" });
      update(item.id, {
        status: "failed",
        error: missingSavedResource
          ? "浏览器中的 TUS 资源地址已丢失；请创建新 Attempt 后重试"
          : error instanceof Error ? error.message : "上传准备失败",
        resourceExpired: missingSavedResource,
      });
    }
  }

  async function pause(item: QueueItem) {
    await uploads.current.get(item.id)?.abort(false);
    const acceptedBytes = item.sourceSha256
      ? persistedUpload(item.sourceSha256)?.acceptedBytes ?? item.acceptedBytes
      : item.acceptedBytes;
    if (item.sourceSha256) updatePersistedUpload(item.sourceSha256, { acceptedBytes, status: "paused" });
    if (item.uploadPublicId && item.attemptPublicId) {
      await reportAttemptProgress(item.id, item.uploadPublicId, item.attemptPublicId, "paused", acceptedBytes);
    }
    update(item.id, { status: "paused", acceptedBytes });
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
    try { await uploads.current.get(item.id)?.abort(true); } catch { /* Server state is still aborted below. */ }
    if (item.uploadPublicId) {
      try { await api(`/api/uploads/${item.uploadPublicId}/abort`, { method: "POST" }); } catch { /* Keep local terminal state. */ }
    }
    if (item.sourceSha256) removePersistedUpload(item.sourceSha256);
    uploads.current.delete(item.id);
    progressReports.current.delete(item.id);
    update(item.id, { status: "aborted", error: "" });
  }

  return (
    <section className="mt-8">
      {lockedSession ? (
        <div aria-label="已绑定 Recording Session" className="mb-5 border-l-4 border-[var(--teal)] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">已绑定 Session，上传时不可切换</p>
          <p className="mt-2 font-bold">{lockedSession.publicId} · {lockedSession.taskTitle}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{lockedSession.deviceLabel}</p>
        </div>
      ) : null}
      <Label className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl block cursor-pointer border-dashed p-8 text-center transition hover:border-[var(--signal)] hover:bg-white sm:p-12">
        <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-[var(--teal-soft)] text-xl text-[var(--signal)]">＋</span>
        <span className="display block text-2xl font-semibold">选择设备或 SSD 中的视频</span>
        <span className="mt-2 block text-sm leading-6 text-[var(--muted)]">MP4 / MOV / INSV · 每批最多 5 个 · 单文件最多 50,000,000 bytes</span>
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
            <h2 id="restorable-uploads-title" className="font-bold">待恢复上传（{restorableUploads.length}）</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">出于浏览器安全限制，请重新选择原文件；完整 SHA-256 一致后才会恢复 TUS offset。</p>
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
                      已确认 {formatBytes(saved.acceptedBytes)} / {formatBytes(saved.sizeBytes)} · 保存于 {new Date(saved.savedAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <Badge>{saved.attemptExpired ? "资源可能已过期" : saved.status}</Badge>
                </div>
                <Progress className="mt-4" value={progress} aria-label={`待恢复上传进度 ${progress.toFixed(1)}%`} />
                <Label className="mt-4 block text-sm font-bold">选择原文件以恢复
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
          另有 {legacyRestorableCount} 个旧版恢复记录。请从上方重新选择原文件，验证后会自动迁移并恢复。
        </p>
      ) : null}
      {selectionError ? <Alert role="alert" className="mt-4 border-l-4 border-[var(--signal)] px-4 py-3 text-sm"><AlertDescription>{selectionError}</AlertDescription></Alert> : null}
      <div className="mt-6 space-y-5">
        {items.map((item) => (
          <Card as="article" key={item.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-bold break-all">{item.file.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">{formatBytes(item.file.size)} · {item.contentType} · 修改于 {new Date(item.file.lastModified).toLocaleString("zh-CN")}</p></div>
              <Badge>{item.status}</Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {lockedSession ? <div className="text-sm"><p className="font-bold">Recording Session</p><p className="mt-2 border border-[var(--line)] bg-[var(--paper)] px-3 py-3" aria-label="锁定的 Recording Session">{lockedSession.publicId} · 已锁定</p></div> : <Label className="text-sm font-bold">Recording Session
                <NativeSelect
                  value={item.sessionChoice}
                  disabled={!(["ready", "failed"].includes(item.status)) || Boolean(item.uploadPublicId)}
                  onChange={(event) => update(item.id, { sessionChoice: event.target.value, error: "" })}
                  className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 font-normal"
                >
                  <NativeSelectOption value="">请选择…</NativeSelectOption>
                  {sessions.map((session) => <NativeSelectOption key={session.publicId} value={session.publicId}>{session.publicId} · {session.taskTitle} · {session.deviceLabel}</NativeSelectOption>)}
                  <NativeSelectOption value="unable">Unable to Determine</NativeSelectOption>
                </NativeSelect>
              </Label>}
              <Label className="text-sm font-bold">备注（可选）
                <Input value={item.note} disabled={Boolean(item.uploadPublicId)} onChange={(event) => update(item.id, { note: event.target.value.slice(0, 500) })} className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 font-normal" placeholder="不要填写敏感信息" />
              </Label>
            </div>
            <Progress className="mt-5" value={item.progress} aria-label={`上传进度 ${item.progress.toFixed(1)}%`} />
            <div className="mt-2 flex justify-between text-xs text-[var(--muted)]"><span>{item.sourceSha256 ? `SHA-256 ${item.sourceSha256.slice(0, 12)}…` : "正在计算完整文件 SHA-256…"}</span><span>{item.progress.toFixed(1)}%</span></div>
            {item.resumed ? <p className="mt-3 text-xs font-bold text-[var(--teal)]">已从浏览器保存的 TUS offset 恢复</p> : null}
            {item.duplicateCandidate ? <p className="mt-3 border-l-4 border-[var(--yellow)] px-3 text-xs">Duplicate Candidate：仅进入人工复核，不会自动删除或拒绝。</p> : null}
            {item.error ? <Alert role="alert" className="mt-3 border-l-4 border-[var(--signal)] px-3 text-sm"><AlertDescription>{item.error}</AlertDescription></Alert> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {item.status === "ready" ? <Button onClick={() => void start(item)}>开始直传 Storage</Button> : null}
              {item.status === "uploading" ? <Button variant="outline" onClick={() => void pause(item)} className="border-[var(--ink)] px-4 py-3 text-sm font-bold">暂停</Button> : null}
              {item.status === "paused" ? <Button onClick={() => void resume(item)}>继续</Button> : null}
              {item.status === "failed" && item.uploadPublicId ? <Button onClick={() => void start(item, item.resourceExpired)} className="bg-[var(--signal)] px-4 py-3 text-sm font-bold text-white">{item.resourceExpired ? "创建新 Attempt 并重试" : "恢复并重试"}</Button> : null}
              {["preparing", "uploading", "paused", "failed"].includes(item.status) ? <Button variant="outline" onClick={() => void cancel(item)} className="border-[var(--signal)] px-4 py-3 text-sm font-bold text-[var(--signal)]">取消</Button> : null}
              {item.uploadPublicId ? <Link href={`/uploads/${item.uploadPublicId}`} className="border border-[var(--line)] px-4 py-3 text-sm font-bold">查看服务端状态</Link> : null}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
