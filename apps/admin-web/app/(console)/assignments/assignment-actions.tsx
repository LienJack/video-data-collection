"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@egocapture/ui/components/collapsible";
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
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger asChild><Button variant="ghost" size="sm">{open ? "收起" : "管理"}</Button></CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2 border-t pt-3">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="操作原因，至少 10 字符" />
        <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => mutate("extend")}>延期</Button>
          <Button variant="destructive" size="sm" disabled={Boolean(busy)} onClick={() => mutate("cancel")}>取消</Button>
        </div>
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
