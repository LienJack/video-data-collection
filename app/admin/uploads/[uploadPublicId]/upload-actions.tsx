"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UploadActions({ uploadPublicId, canPreview }: { uploadPublicId: string; canPreview: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function preview() {
    setBusy("preview"); setError("");
    const response = await fetch(`/api/admin/uploads/${uploadPublicId}/signed-url`);
    const payload = await response.json() as { data?: { signedUrl: string }; error?: { message?: string } };
    if (!response.ok || !payload.data) setError(payload.error?.message || "无法创建预览链接");
    else window.open(payload.data.signedUrl, "_blank", "noopener,noreferrer");
    setBusy("");
  }
  async function retryMetadata() {
    setBusy("metadata"); setError("");
    const response = await fetch(`/api/uploads/${uploadPublicId}/extract-metadata`, { method: "POST" });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "Metadata 重试失败");
    else router.refresh();
    setBusy("");
  }
  return <div className="mt-6 flex flex-wrap gap-3"><button disabled={!canPreview || Boolean(busy)} onClick={() => void preview()} className="bg-[var(--ink)] px-5 py-3 font-bold text-[var(--paper)] disabled:opacity-40">5 分钟私有预览</button><button disabled={!canPreview || Boolean(busy)} onClick={() => void retryMetadata()} className="border border-[var(--teal)] px-5 py-3 font-bold text-[var(--teal)] disabled:opacity-40">Retry Metadata</button>{error ? <p role="alert" className="w-full text-sm text-[var(--signal-dark)]">{error}</p> : null}</div>;
}
