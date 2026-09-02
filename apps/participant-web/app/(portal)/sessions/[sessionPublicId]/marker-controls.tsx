"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "Marker 操作失败");
    else router.refresh();
    setBusy("");
  }
  return <div className="mt-6 grid gap-3 sm:grid-cols-2"><a href={qrDataUrl} download={`${sessionPublicId}-marker.png`} className="border border-[var(--ink)] px-5 py-3 text-center font-bold">下载二维码</a>{sessionStatus === "open" ? <button onClick={() => mutate("regenerate")} disabled={Boolean(busy)} className="border border-[var(--teal)] px-5 py-3 font-bold text-[var(--teal)]">{busy === "regenerate" ? "生成中…" : "重新生成 Marker"}</button> : null}{sessionStatus === "open" && !markerAcknowledgedAt ? <button onClick={() => mutate("ack")} disabled={Boolean(busy)} className="bg-[var(--signal)] px-5 py-4 font-bold text-white sm:col-span-2">{busy === "ack" ? "确认中…" : "我已拍摄二维码"}</button> : <p className="border-l-4 border-[var(--teal)] px-4 py-3 text-sm sm:col-span-2">{markerAcknowledgedAt ? `已确认：${new Date(markerAcknowledgedAt).toLocaleString("zh-CN")}` : "Session 已关闭"}</p>}{error ? <p role="alert" className="border-l-4 border-[var(--signal)] px-4 py-3 text-sm sm:col-span-2">{error}</p> : null}</div>;
}
