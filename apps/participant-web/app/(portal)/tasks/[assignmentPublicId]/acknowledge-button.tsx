"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button } from "@egocapture/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@egocapture/ui/lib/i18n";

export function AcknowledgeButton({ assignmentPublicId, contentHash }: { assignmentPublicId: string; contentHash: string }) {
  const router = useRouter();
  const i18n = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function acknowledge() {
    setBusy(true); setError("");
    const response = await fetch(`/api/participant/assignments/${assignmentPublicId}/acknowledge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentHash }),
    });
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("participantUi.acknowledgementFailed"));
    else router.refresh();
    setBusy(false);
  }
  return <div className="mt-8"><Button disabled={busy} onClick={acknowledge} className="w-full bg-[var(--signal)] px-5 py-4 font-bold text-white disabled:opacity-50">{busy ? i18n.t("participantUi.acknowledging") : i18n.t("participantUi.acknowledgeVersion")}</Button>{error ? <Alert role="alert" className="mt-3 border-l-4 border-[var(--signal)] px-4 py-3 text-sm"><AlertDescription>{error}</AlertDescription></Alert> : null}</div>;
}
