"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@egocapture/ui/lib/i18n";

export function UploadActions({ uploadPublicId, canPreview }: { uploadPublicId: string; canPreview: boolean }) {
  const router = useRouter();
  const i18n = useI18n();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  async function preview() {
    setBusy("preview"); setError("");
    const response = await fetch(`/api/admin/uploads/${uploadPublicId}/signed-url`);
    const payload = await response.json() as { data?: { signedUrl: string }; error?: { code?: string } };
    if (!response.ok || !payload.data) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.previewFailed"));
    else window.open(payload.data.signedUrl, "_blank", "noopener,noreferrer");
    setBusy("");
  }
  async function retryMetadata() {
    if (reason.trim().length < 10 || reason.trim().length > 500) { setError(i18n.t("adminUi.retryReasonLengthError")); return; }
    setBusy("metadata"); setError("");
    const response = await fetch(`/api/uploads/${uploadPublicId}/extract-metadata`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.metadataRetryFailed"));
    else { setReason(""); router.refresh(); }
    setBusy("");
  }
  return <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><Input aria-label={i18n.t("adminUi.retryReason")} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder={i18n.t("adminUi.retryReason")} className="border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm" /><Button disabled={!canPreview || Boolean(busy)} onClick={() => void preview()} className="bg-[var(--ink)] px-5 py-3 font-bold text-[var(--paper)] disabled:opacity-40">{i18n.t("adminUi.fiveMinutePreview")}</Button><Button variant="outline" disabled={!canPreview || Boolean(busy)} onClick={() => void retryMetadata()} className="border-[var(--teal)] px-5 py-3 font-bold text-[var(--teal)] disabled:opacity-40">{i18n.t("adminUi.retryMetadata")}</Button>{error ? <Alert role="alert" className="text-sm text-[var(--signal-dark)] sm:col-span-3"><AlertDescription>{error}</AlertDescription></Alert> : null}</div>;
}
