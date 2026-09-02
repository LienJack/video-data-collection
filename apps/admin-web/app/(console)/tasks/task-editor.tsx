"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Study = { publicId: string; name: string };

export function TaskEditor({
  mode,
  studies,
  taskPublicId,
  initialInstructions,
  initialUpdatedAt,
}: {
  mode: "create" | "edit";
  studies: Study[];
  taskPublicId?: string;
  initialInstructions: string;
  initialUpdatedAt?: string;
}) {
  const router = useRouter();
  const [json, setJson] = useState(initialInstructions);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save"); setError("");
    let instructions: unknown;
    try {
      instructions = JSON.parse(json);
    } catch {
      setError("TaskInstructions 不是合法 JSON"); setBusy(""); return;
    }
    const form = new FormData(event.currentTarget);
    const response = await fetch(
      mode === "create" ? "/api/admin/tasks" : `/api/admin/tasks/${taskPublicId}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "content-type": "application/json",
          ...(mode === "create" ? { "idempotency-key": crypto.randomUUID() } : {}),
        },
        body: JSON.stringify(mode === "create"
          ? { studyPublicId: form.get("studyPublicId"), instructions }
          : { instructions, expectedUpdatedAt: updatedAt }),
      },
    );
    const payload = await response.json() as {
      data?: { taskPublicId?: string; updatedAt?: string };
      error?: { message?: string };
    };
    if (!response.ok || !payload.data) setError(payload.error?.message || "Task 保存失败");
    else if (mode === "create" && payload.data.taskPublicId) {
      router.push(`/tasks/${payload.data.taskPublicId}`);
      return;
    } else {
      if (payload.data.updatedAt) setUpdatedAt(payload.data.updatedAt);
      setDirty(false);
      router.refresh();
    }
    setBusy("");
  }

  async function publish() {
    if (!taskPublicId || dirty) return;
    setBusy("publish"); setError("");
    const response = await fetch(`/api/admin/tasks/${taskPublicId}/publish`, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
    });
    const payload = await response.json() as {
      data?: { version: number; contentHash: string; updatedAt: string };
      error?: { message?: string };
    };
    if (!response.ok || !payload.data) setError(payload.error?.message || "Task 发布失败");
    else {
      setUpdatedAt(payload.data.updatedAt);
      router.refresh();
    }
    setBusy("");
  }

  return (
    <form onSubmit={save} className="mt-8 space-y-5 border border-[var(--line)] bg-white/30 p-6">
      {mode === "create" ? (
        <label className="block text-sm font-bold">Study
          <select name="studyPublicId" required className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
            {studies.map((study) => <option key={study.publicId} value={study.publicId}>{study.name} · {study.publicId}</option>)}
          </select>
        </label>
      ) : null}
      <label className="block text-sm font-bold">TaskInstructions · ego-task/1
        <textarea
          value={json}
          onChange={(event) => { setJson(event.target.value); setDirty(true); }}
          rows={30}
          spellCheck={false}
          className="mt-2 w-full border border-[var(--line)] bg-[var(--ink)] px-4 py-4 font-mono text-xs leading-6 text-[var(--paper)] outline-none focus:border-[var(--signal)]"
        />
      </label>
      <p className="text-xs leading-6 text-[var(--muted)]">发布后版本不可修改或删除。`future_cv` 会显示“本 MVP 未自动检查”。</p>
      {error ? <p role="alert" className="border-l-4 border-[var(--signal)] px-4 py-3 text-sm">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button disabled={Boolean(busy) || studies.length === 0} className="bg-[var(--ink)] px-5 py-3 font-bold text-[var(--paper)] disabled:opacity-50">
          {busy === "save" ? "保存中…" : mode === "create" ? "创建 Draft" : "保存 Draft"}
        </button>
        {mode === "edit" ? (
          <button type="button" onClick={publish} disabled={Boolean(busy) || dirty} className="bg-[var(--signal)] px-5 py-3 font-bold text-white disabled:opacity-40">
            {busy === "publish" ? "发布中…" : dirty ? "先保存 Draft" : "发布新版本"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
