"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@egocapture/ui/lib/i18n";

export function MarkerControls({
  sessionPublicId,
  qrDataUrl,
  markerAcknowledgedAt,
  sessionStatus,
}: {
  sessionPublicId: string;
  qrDataUrl: string;
  markerAcknowledgedAt: string | null;
  sessionStatus: string;
}) {
  const router = useRouter();
  const i18n = useI18n();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function mutate(action: "ack" | "regenerate") {
    setBusy(action); setError("");
    const response = await fetch(
      action === "ack"
        ? `/api/participant/sessions/${sessionPublicId}/marker-acknowledgement`
        : `/api/participant/sessions/${sessionPublicId}/marker`,
      {
        method: "POST",
        headers: action === "regenerate" ? { "idempotency-key": crypto.randomUUID() } : undefined,
      },
    );
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("participantUi.markerActionFailed"));
    else router.refresh();
    setBusy("");
  }
  return <div className="mt-6 grid gap-3 sm:grid-cols-2"><a href={qrDataUrl} download={`${sessionPublicId}-marker.png`} className={buttonVariants({ variant: "outline", className: "border-[var(--ink)] px-5 py-3 text-center font-bold" })}>{i18n.t("participantUi.downloadQr")}</a>{sessionStatus === "open" ? <Button variant="outline" onClick={() => mutate("regenerate")} disabled={Boolean(busy)} className="border-[var(--teal)] px-5 py-3 font-bold text-[var(--teal)]">{busy === "regenerate" ? i18n.t("participantUi.generating") : i18n.t("participantUi.regenerateMarker")}</Button> : null}{sessionStatus === "open" && !markerAcknowledgedAt ? <Button onClick={() => mutate("ack")} disabled={Boolean(busy)} className="bg-[var(--signal)] px-5 py-4 font-bold text-white sm:col-span-2">{busy === "ack" ? i18n.t("participantUi.markerConfirming") : i18n.t("participantUi.markerCaptured")}</Button> : <p className="border-l-4 border-[var(--teal)] px-4 py-3 text-sm sm:col-span-2">{markerAcknowledgedAt ? i18n.t("participantUi.markerConfirmedAt", { date: i18n.date(markerAcknowledgedAt, { dateStyle: "medium", timeStyle: "short" }) }) : i18n.t("participantUi.sessionClosed")}</p>}{error ? <Alert role="alert" className="border-l-4 border-[var(--signal)] px-4 py-3 text-sm sm:col-span-2"><AlertDescription>{error}</AlertDescription></Alert> : null}</div>;
}
