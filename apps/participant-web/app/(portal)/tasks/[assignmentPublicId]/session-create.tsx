"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Device = { publicId: string; manufacturer: string; model: string; isDefault: boolean };

export function SessionCreate({ assignmentPublicId, devices }: { assignmentPublicId: string; devices: Device[] }) {
  const router = useRouter();
  const [devicePublicId, setDevicePublicId] = useState(devices.find((device) => device.isDefault)?.publicId || devices[0]?.publicId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    if (!devicePublicId) { setError("请先联系管理员登记 Device"); return; }
    setBusy(true); setError("");
    const response = await fetch("/api/participant/sessions", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ assignmentPublicId, devicePublicId }),
    });
    const payload = await response.json() as { data?: { sessionPublicId?: string }; error?: { message?: string } };
    if (!response.ok || !payload.data?.sessionPublicId) setError(payload.error?.message || "Session 创建失败");
    else router.push(`/sessions/${payload.data.sessionPublicId}`);
    setBusy(false);
  }
  return <div className="mt-8 border border-[var(--line)] bg-white/40 p-5"><h2 className="display text-2xl font-semibold">创建 Recording Session</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">选择实际用于本次录制的设备；Participant 和 TaskVersion 由服务端根据 Assignment 推导。</p><select value={devicePublicId} onChange={(event) => setDevicePublicId(event.target.value)} className="mt-4 w-full border border-[var(--line)] bg-[var(--paper)] px-4 py-3">{devices.map((device) => <option key={device.publicId} value={device.publicId}>{device.manufacturer} {device.model} · {device.publicId}{device.isDefault ? " · Default" : ""}</option>)}</select><button onClick={create} disabled={busy || devices.length === 0} className="mt-4 w-full bg-[var(--ink)] px-5 py-4 font-bold text-[var(--paper)] disabled:opacity-50">{busy ? "创建中…" : "创建 Session 并显示 Marker"}</button>{error ? <p role="alert" className="mt-3 border-l-4 border-[var(--signal)] px-4 py-3 text-sm">{error}</p> : null}</div>;
}
