"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Upload } from "tus-js-client";
import { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_BATCH } from "@/src/domain/constants";
import { fingerprintFile } from "@/src/upload/fingerprint";
import {
  persistUpload,
  persistedUpload,
  persistedUploadCount,
  removePersistedUpload,
} from "@/src/upload/persistence";
import {
  createTusUpload,
  startOrResumeTus,
  type TusCredential,
} from "@/src/upload/tus";

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
  sessionChoice: string;
  note: string;
  status: QueueStatus;
  progress: number;
  uploadPublicId: string | null;
  attemptPublicId: string | null;
  error: string;
  resourceExpired: boolean;
  duplicateCandidate: boolean;
  resumed: boolean;
};

type ApiPayload<T> = { data?: T; error?: { code?: string; message?: string } };

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

export function UploadQueue({ sessions }: { sessions: SessionOption[] }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selectionError, setSelectionError] = useState("");
  const [restorableCount, setRestorableCount] = useState(0);
  const uploads = useRef(new Map<string, Upload>());
  const batchPublicId = useRef<string | null>(null);
  const batchPromise = useRef<Promise<string> | null>(null);

  useEffect(() => {
    queueMicrotask(() => setRestorableCount(persistedUploadCount()));
  }, []);
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

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setSelectionError("");
    if (files.length > MAX_FILES_PER_BATCH) {
      setSelectionError(`每批最多选择 ${MAX_FILES_PER_BATCH} 个文件`);
      return;
    }
    const next: QueueItem[] = [];
    for (const file of [...files]) {
      const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
      if (!(extension in expectedFileType)) {
        setSelectionError(`${file.name} 不是 MP4、MOV 或 INSV`);
        continue;
      }
      if (file.size < 1 || file.size > MAX_FILE_SIZE_BYTES) {
        setSelectionError(`${file.name} 超过 50,000,000 bytes 或为空文件`);
        continue;
      }
      const expected = expectedFileType[extension];
      if (file.type && file.type !== expected && !(extension === "insv" && file.type === "")) {
        setSelectionError(`${file.name} 的浏览器 MIME 与扩展名不匹配`);
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        extension: extension as QueueItem["extension"],
        contentType: expected,
        fingerprintV1: null,
        sessionChoice: "",
        note: "",
        status: "hashing",
        progress: 0,
        uploadPublicId: null,
        attemptPublicId: null,
        error: "",
        resourceExpired: false,
        duplicateCandidate: false,
        resumed: false,
      });
    }
    setItems(next);
    await Promise.all(next.map(async (item) => {
      try {
        const fingerprintV1 = await fingerprintFile(item.file);
        const saved = persistedUpload(fingerprintV1);
        update(item.id, {
          fingerprintV1,
          status: "ready",
          sessionChoice: saved
            ? (saved.unableToDetermine ? "unable" : saved.claimedSessionPublicId ?? "")
            : "",
          uploadPublicId: saved?.uploadPublicId ?? null,
          attemptPublicId: saved?.attemptPublicId ?? null,
        });
      } catch {
        update(item.id, { status: "failed", error: "无法计算本地文件指纹" });
      }
    }));
  }

  async function credentialFor(item: QueueItem, forceNew: boolean): Promise<TusCredential> {
    if (!item.fingerprintV1) throw new Error("文件指纹尚未完成");
    const saved = persistedUpload(item.fingerprintV1);
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
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          removePersistedUpload(item.fingerprintV1);
        } else {
          throw error;
        }
      }
    }
    const batch = await ensureBatch();
    const unableToDetermine = item.sessionChoice === "unable";
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
        claimedSessionPublicId: unableToDetermine ? null : item.sessionChoice,
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

  async function start(item: QueueItem, forceNew = false) {
    if (!item.sessionChoice) {
      update(item.id, { error: "请为这个文件选择 Recording Session 或 Unable to Determine" });
      return;
    }
    update(item.id, { status: "preparing", error: "", resourceExpired: false });
    try {
      const credential = await credentialFor(item, forceNew);
      const fingerprint = item.fingerprintV1!;
      persistUpload({
        uploadPublicId: credential.uploadPublicId,
        attemptPublicId: credential.attemptPublicId,
        objectKey: credential.objectKey,
        originalFilename: item.file.name,
        sizeBytes: item.file.size,
        fingerprintV1: fingerprint,
        claimedSessionPublicId: item.sessionChoice === "unable" ? null : item.sessionChoice,
        unableToDetermine: item.sessionChoice === "unable",
        savedAt: new Date().toISOString(),
      });
      setRestorableCount(persistedUploadCount());
      const tus = createTusUpload(item.file, credential, fingerprint, item.contentType, {
        onProgress: (uploaded, total) => update(item.id, {
          status: "uploading",
          progress: total > 0 ? Math.round((uploaded / total) * 1000) / 10 : 0,
        }),
        onError: (error, resourceExpired) => update(item.id, {
          status: "failed",
          error: resourceExpired
            ? "TUS 资源已过期；重试会创建新的 UploadAttempt"
            : `上传失败：${error.message}`,
          resourceExpired,
        }),
        onSuccess: async () => {
          update(item.id, { status: "reconciling", progress: 100 });
          try {
            await api(`/api/uploads/${credential.uploadPublicId}/complete`, { method: "POST" });
            removePersistedUpload(fingerprint);
            uploads.current.delete(item.id);
            setRestorableCount(persistedUploadCount());
            update(item.id, { status: "verified", error: "" });
          } catch (error) {
            update(item.id, { status: "failed", error: error instanceof Error ? error.message : "对象对账失败" });
          }
        },
      });
      uploads.current.set(item.id, tus);
      const resumed = await startOrResumeTus(tus);
      update(item.id, { status: "uploading", resumed });
    } catch (error) {
      update(item.id, { status: "failed", error: error instanceof Error ? error.message : "上传准备失败" });
    }
  }

  async function pause(item: QueueItem) {
    await uploads.current.get(item.id)?.abort(false);
    update(item.id, { status: "paused" });
  }

  function resume(item: QueueItem) {
    uploads.current.get(item.id)?.start();
    update(item.id, { status: "uploading", error: "" });
  }

  async function cancel(item: QueueItem) {
    try { await uploads.current.get(item.id)?.abort(true); } catch { /* Server state is still aborted below. */ }
    if (item.uploadPublicId) {
      try { await api(`/api/uploads/${item.uploadPublicId}/abort`, { method: "POST" }); } catch { /* Keep local terminal state. */ }
    }
    if (item.fingerprintV1) removePersistedUpload(item.fingerprintV1);
    uploads.current.delete(item.id);
    setRestorableCount(persistedUploadCount());
    update(item.id, { status: "aborted", error: "" });
  }

  return (
    <section className="mt-8">
      <label className="block border-2 border-dashed border-[var(--line)] bg-white/35 p-8 text-center">
        <span className="display block text-2xl font-semibold">选择设备或 SSD 中的视频</span>
        <span className="mt-2 block text-sm leading-6 text-[var(--muted)]">MP4 / MOV / INSV · 每批最多 5 个 · 单文件最多 50,000,000 bytes</span>
        <input
          type="file"
          multiple
          accept=".mp4,.mov,.insv,video/mp4,video/quicktime,application/octet-stream"
          onChange={(event) => void onFiles(event.target.files)}
          className="mt-5 block w-full text-sm"
        />
      </label>
      {restorableCount > 0 ? <p className="mt-4 border-l-4 border-[var(--yellow)] px-4 py-3 text-sm">浏览器保留了 {restorableCount} 个未完成上传。重新选择同一文件后会尝试恢复原 TUS 资源。</p> : null}
      {selectionError ? <p role="alert" className="mt-4 border-l-4 border-[var(--signal)] px-4 py-3 text-sm">{selectionError}</p> : null}
      <div className="mt-6 space-y-5">
        {items.map((item) => (
          <article key={item.id} className="border border-[var(--line)] bg-white/45 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-bold break-all">{item.file.name}</h2><p className="mt-1 text-xs text-[var(--muted)]">{formatBytes(item.file.size)} · {item.contentType} · 修改于 {new Date(item.file.lastModified).toLocaleString("zh-CN")}</p></div>
              <span className="bg-[var(--ink)] px-3 py-1 text-xs font-bold uppercase text-[var(--paper)]">{item.status}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">Recording Session
                <select
                  value={item.sessionChoice}
                  disabled={!(["ready", "failed"].includes(item.status)) || Boolean(item.uploadPublicId)}
                  onChange={(event) => update(item.id, { sessionChoice: event.target.value, error: "" })}
                  className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 font-normal"
                >
                  <option value="">请选择…</option>
                  {sessions.map((session) => <option key={session.publicId} value={session.publicId}>{session.publicId} · {session.taskTitle} · {session.deviceLabel}</option>)}
                  <option value="unable">Unable to Determine</option>
                </select>
              </label>
              <label className="text-sm font-bold">备注（可选）
                <input value={item.note} disabled={Boolean(item.uploadPublicId)} onChange={(event) => update(item.id, { note: event.target.value.slice(0, 500) })} className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 font-normal" placeholder="不要填写敏感信息" />
              </label>
            </div>
            <div className="mt-5 h-2 overflow-hidden bg-[var(--paper-deep)]"><div className="h-full bg-[var(--teal)] transition-[width]" style={{ width: `${item.progress}%` }} /></div>
            <div className="mt-2 flex justify-between text-xs text-[var(--muted)]"><span>{item.fingerprintV1 ? `fingerprint ${item.fingerprintV1.slice(0, 12)}…` : "正在计算 fingerprint_v1…"}</span><span>{item.progress.toFixed(1)}%</span></div>
            {item.resumed ? <p className="mt-3 text-xs font-bold text-[var(--teal)]">已从浏览器保存的 TUS offset 恢复</p> : null}
            {item.duplicateCandidate ? <p className="mt-3 border-l-4 border-[var(--yellow)] px-3 text-xs">Duplicate Candidate：仅进入人工复核，不会自动删除或拒绝。</p> : null}
            {item.error ? <p role="alert" className="mt-3 border-l-4 border-[var(--signal)] px-3 text-sm">{item.error}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {item.status === "ready" ? <button onClick={() => void start(item)} className="bg-[var(--ink)] px-4 py-3 text-sm font-bold text-[var(--paper)]">开始直传 Storage</button> : null}
              {item.status === "uploading" ? <button onClick={() => void pause(item)} className="border border-[var(--ink)] px-4 py-3 text-sm font-bold">暂停</button> : null}
              {item.status === "paused" ? <button onClick={() => resume(item)} className="bg-[var(--teal)] px-4 py-3 text-sm font-bold text-white">继续</button> : null}
              {item.status === "failed" && item.uploadPublicId ? <button onClick={() => void start(item, item.resourceExpired)} className="bg-[var(--signal)] px-4 py-3 text-sm font-bold text-white">{item.resourceExpired ? "创建新 Attempt 并重试" : "恢复并重试"}</button> : null}
              {["preparing", "uploading", "paused", "failed"].includes(item.status) ? <button onClick={() => void cancel(item)} className="border border-[var(--signal)] px-4 py-3 text-sm font-bold text-[var(--signal)]">取消</button> : null}
              {item.uploadPublicId ? <Link href={`/participant/uploads/${item.uploadPublicId}`} className="border border-[var(--line)] px-4 py-3 text-sm font-bold">查看服务端状态</Link> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
