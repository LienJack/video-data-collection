"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@egocapture/ui/components/collapsible";
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
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
      <CollapsibleTrigger asChild><Button variant="ghost" size="sm">{open ? "收起" : "关闭 Session"}</Button></CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="关闭原因，至少 10 字符" />
        <Button variant="destructive" size="sm" onClick={close} disabled={busy}>{busy ? "关闭中…" : "确认关闭"}</Button>
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
