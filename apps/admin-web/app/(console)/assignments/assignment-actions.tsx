"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@egocapture/ui/components/collapsible";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@egocapture/ui/lib/i18n";

export function AssignmentActions({ assignmentPublicId, status }: { assignmentPublicId: string; status: string }) {
  const router = useRouter();
  const i18n = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function mutate(action: "extend" | "cancel") {
    if (reason.trim().length < 10) { setError(i18n.t("adminUi.reasonMinError")); return; }
    if (action === "extend" && !dueAt) { setError(i18n.t("adminUi.extendNeedsDue")); return; }
    setBusy(action); setError("");
    const response = await fetch(`/api/admin/assignments/${assignmentPublicId}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "extend" ? { reason, dueAt: new Date(dueAt).toISOString() } : { reason }),
    });
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.operationFailed"));
    else { setOpen(false); setReason(""); router.refresh(); }
    setBusy("");
  }
  if (["accepted", "canceled"].includes(status)) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger asChild><Button variant="ghost" size="sm">{open ? i18n.t("adminUi.collapse") : i18n.t("adminUi.manage")}</Button></CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2 border-t pt-3">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={i18n.t("adminUi.operationReasonMin")} />
        <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => mutate("extend")}>{i18n.t("adminUi.extend")}</Button>
          <Button variant="destructive" size="sm" disabled={Boolean(busy)} onClick={() => mutate("cancel")}>{i18n.t("common.cancel")}</Button>
        </div>
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
