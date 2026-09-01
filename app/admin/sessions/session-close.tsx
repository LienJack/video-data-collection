"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SessionClose({ sessionPublicId }: { sessionPublicId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function close() {
    if (reason.trim().length < 10) { setError("关闭原因至少 10 个字符"); return; }
    setBusy(true); setError("");
    const response = await fetch(`/api/admin/sessions/${sessionPublicId}/close`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "Session 关闭失败");
    else router.refresh();
    setBusy(false);
  }
  return <div className="mt-4"><button onClick={() => setOpen((value) => !value)} className="text-xs font-bold text-[var(--signal)]">{open ? "收起" : "关闭 Session"}</button>{open ? <div className="mt-3 space-y-2"><input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="关闭原因，至少 10 字符" className="w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs" /><button onClick={close} disabled={busy} className="border border-[var(--signal)] px-3 py-2 text-xs font-bold text-[var(--signal)]">{busy ? "关闭中…" : "确认关闭"}</button>{error ? <p role="alert" className="text-xs text-[var(--signal-dark)]">{error}</p> : null}</div> : null}</div>;
}
