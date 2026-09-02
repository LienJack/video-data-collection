"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function UploadActions({ uploadPublicId, canPreview }: { uploadPublicId: string; canPreview: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  async function preview() {
    setBusy("preview"); setError("");
    const response = await fetch(`/api/admin/uploads/${uploadPublicId}/signed-url`);
    const payload = await response.json() as { data?: { signedUrl: string }; error?: { message?: string } };
    if (!response.ok || !payload.data) setError(payload.error?.message || "无法创建预览链接");
    else window.open(payload.data.signedUrl, "_blank", "noopener,noreferrer");
    setBusy("");
  }
  async function retryMetadata() {
    if (reason.trim().length < 10 || reason.trim().length > 500) { setError("Retry Reason 必须为 10～500 个字符"); return; }
    setBusy("metadata"); setError("");
    const response = await fetch(`/api/uploads/${uploadPublicId}/extract-metadata`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "Metadata 重试失败");
    else { setReason(""); router.refresh(); }
    setBusy("");
  }
  return <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><Input aria-label="Retry Metadata Reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Retry 原因（10～500 字符）" className="border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm" /><Button disabled={!canPreview || Boolean(busy)} onClick={() => void preview()} className="bg-[var(--ink)] px-5 py-3 font-bold text-[var(--paper)] disabled:opacity-40">5 分钟私有预览</Button><Button variant="outline" disabled={!canPreview || Boolean(busy)} onClick={() => void retryMetadata()} className="border-[var(--teal)] px-5 py-3 font-bold text-[var(--teal)] disabled:opacity-40">Retry Metadata</Button>{error ? <Alert role="alert" className="text-sm text-[var(--signal-dark)] sm:col-span-3"><AlertDescription>{error}</AlertDescription></Alert> : null}</div>;
}
