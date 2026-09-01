"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AssignmentActions({ assignmentPublicId, status }: { assignmentPublicId: string; status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function mutate(action: "extend" | "cancel") {
    if (reason.trim().length < 10) { setError("原因至少 10 个字符"); return; }
    if (action === "extend" && !dueAt) { setError("延期必须选择新的 Due At"); return; }
    setBusy(action); setError("");
    const response = await fetch(`/api/admin/assignments/${assignmentPublicId}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "extend" ? { reason, dueAt: new Date(dueAt).toISOString() } : { reason }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "操作失败");
    else { setOpen(false); setReason(""); router.refresh(); }
    setBusy("");
  }
  if (["accepted", "canceled"].includes(status)) return null;
  return <div className="mt-3"><button onClick={() => setOpen((value) => !value)} className="text-xs font-bold text-[var(--teal)]">{open ? "收起" : "管理"}</button>{open ? <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="操作原因，至少 10 字符" className="w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs" /><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs" /><div className="flex gap-2"><button disabled={Boolean(busy)} onClick={() => mutate("extend")} className="border border-[var(--teal)] px-3 py-1.5 text-xs font-bold text-[var(--teal)]">延期</button><button disabled={Boolean(busy)} onClick={() => mutate("cancel")} className="border border-[var(--signal)] px-3 py-1.5 text-xs font-bold text-[var(--signal)]">取消</button></div>{error ? <p role="alert" className="text-xs text-[var(--signal-dark)]">{error}</p> : null}</div> : null}</div>;
}
