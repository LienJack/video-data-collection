"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button } from "@egocapture/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcknowledgeButton({ assignmentPublicId, contentHash }: { assignmentPublicId: string; contentHash: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function acknowledge() {
    setBusy(true); setError("");
    const response = await fetch(`/api/participant/assignments/${assignmentPublicId}/acknowledge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentHash }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "确认失败");
    else router.refresh();
    setBusy(false);
  }
  return <div className="mt-8"><Button disabled={busy} onClick={acknowledge} className="w-full bg-[var(--signal)] px-5 py-4 font-bold text-white disabled:opacity-50">{busy ? "确认中…" : "我已阅读并确认这个版本"}</Button>{error ? <Alert role="alert" className="mt-3 border-l-4 border-[var(--signal)] px-4 py-3 text-sm"><AlertDescription>{error}</AlertDescription></Alert> : null}</div>;
}
