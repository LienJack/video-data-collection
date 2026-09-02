"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@egocapture/ui/components/collapsible";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@egocapture/ui/lib/i18n";

export function SessionClose({ sessionPublicId }: { sessionPublicId: string }) {
  const router = useRouter();
  const i18n = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function close() {
    if (reason.trim().length < 10) { setError(i18n.t("adminUi.closeReasonError")); return; }
    setBusy(true); setError("");
    const response = await fetch(`/api/admin/sessions/${sessionPublicId}/close`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.closeSessionFailed"));
    else router.refresh();
    setBusy(false);
  }
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
      <CollapsibleTrigger asChild><Button variant="ghost" size="sm">{open ? i18n.t("adminUi.collapse") : i18n.t("adminUi.closeSession")}</Button></CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder={i18n.t("adminUi.closeReason")} />
        <Button variant="destructive" size="sm" onClick={close} disabled={busy}>{busy ? i18n.t("adminUi.closing") : i18n.t("adminUi.confirmClose")}</Button>
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
