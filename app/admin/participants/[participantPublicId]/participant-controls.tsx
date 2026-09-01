"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Device = {
  publicId: string;
  manufacturer: string;
  model: string;
  deviceType: string;
  firmwareVersion: string | null;
  status: string;
  assignedAt: string;
  isDefault: boolean;
};

export function ParticipantControls({
  participantPublicId,
  status,
  isFixture,
  invitationStatus,
  invitationExpiresAt,
  devices,
}: {
  participantPublicId: string;
  status: string;
  isFixture: boolean;
  invitationStatus: string | null;
  invitationExpiresAt: string | null;
  devices: Device[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reason, setReason] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [currentInvitationStatus, setCurrentInvitationStatus] = useState(invitationStatus);

  async function generateInvitation() {
    setBusy("invite"); setError("");
    const response = await fetch(`/api/admin/participants/${participantPublicId}/invitations`, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
    });
    const payload = await response.json() as { data?: { invitationUrl?: string }; error?: { message?: string } };
    if (!response.ok || !payload.data?.invitationUrl) setError(payload.error?.message || "邀请生成失败");
    else {
      setInvitationUrl(payload.data.invitationUrl);
      setCurrentInvitationStatus("generated");
      router.refresh();
    }
    setBusy("");
  }

  async function revokeCurrentInvitation() {
    if (reason.trim().length < 10) { setError("撤销原因至少 10 个字符"); return; }
    setBusy("revoke-invitation"); setError("");
    const response = await fetch(
      `/api/admin/participants/${participantPublicId}/invitations/revoke`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "邀请撤销失败");
    else {
      setInvitationUrl("");
      setCurrentInvitationStatus("revoked");
      setReason("");
      router.refresh();
    }
    setBusy("");
  }

  async function changeStatus(action: "suspend" | "reactivate" | "withdraw") {
    if (reason.trim().length < 10) { setError("状态变更原因至少 10 个字符"); return; }
    setBusy(action); setError("");
    const response = await fetch(`/api/admin/participants/${participantPublicId}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "状态变更失败");
    else { setReason(""); router.refresh(); }
    setBusy("");
  }

  async function addDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("device"); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/participants/${participantPublicId}/devices`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        manufacturer: form.get("manufacturer"), model: form.get("model"),
        deviceType: form.get("deviceType"), serial: form.get("serial") || null,
        firmwareVersion: form.get("firmwareVersion") || null, status: form.get("status"),
        setAsDefault: form.get("setAsDefault") === "on",
      }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "设备登记失败");
    else { event.currentTarget.reset(); router.refresh(); }
    setBusy("");
  }

  const field = "w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 outline-none focus:border-[var(--teal)]";
  return (
    <div className="space-y-8">
      <section className="border border-[var(--line)] bg-white/30 p-6">
        <h2 className="display text-2xl font-semibold">邀请与状态</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">邀请链接只显示一次；数据库仅保存 SHA-256 hash。</p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          当前邀请：{currentInvitationStatus || "尚未生成"}
          {invitationExpiresAt && ["generated", "opened"].includes(currentInvitationStatus || "")
            ? ` · ${new Date(invitationExpiresAt).toLocaleString("zh-CN")}`
            : ""}
        </p>
        {isFixture ? <p className="mt-4 border-l-4 border-[var(--yellow)] px-3 text-sm">Demo Fixture 受保护，公开管理员不能改变状态。</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {["draft", "invited", "expired"].includes(status) ? <button disabled={Boolean(busy)} onClick={generateInvitation} className="bg-[var(--signal)] px-4 py-2.5 font-bold text-white">{busy === "invite" ? "生成中…" : "生成 / 重发邀请"}</button> : null}
        </div>
        {invitationUrl ? <div className="mt-4 break-all border border-[var(--teal)] bg-[var(--teal-soft)] p-4 text-sm"><p className="font-bold">一次性邀请 URL</p><p className="mt-2">{invitationUrl}</p><div className="mt-3 flex gap-4"><button className="border-b border-[var(--ink)] font-bold" onClick={() => navigator.clipboard.writeText(invitationUrl)}>复制链接</button><a href={invitationUrl} target="_blank" rel="noreferrer" className="border-b border-[var(--ink)] font-bold">新窗口打开</a></div></div> : null}
        {status !== "withdrawn" ? <div className="mt-6"><label className="text-xs font-bold uppercase tracking-[0.14em]">操作原因<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="至少 10 个字符" className={`mt-2 ${field}`} /></label><div className="mt-3 flex flex-wrap gap-2">{["generated", "opened"].includes(currentInvitationStatus || "") ? <button disabled={Boolean(busy)} onClick={revokeCurrentInvitation} className="border border-[var(--signal)] px-3 py-2 font-bold text-[var(--signal)]">撤销邀请</button> : null}{status === "active" ? <button disabled={Boolean(busy)} onClick={() => changeStatus("suspend")} className="border border-[var(--ink)] px-3 py-2 font-bold">暂停</button> : null}{status === "suspended" ? <button disabled={Boolean(busy)} onClick={() => changeStatus("reactivate")} className="border border-[var(--teal)] px-3 py-2 font-bold text-[var(--teal)]">恢复</button> : null}<button disabled={Boolean(busy)} onClick={() => changeStatus("withdraw")} className="border border-[var(--signal)] px-3 py-2 font-bold text-[var(--signal)]">退出研究</button></div></div> : null}
      </section>

      <section className="border border-[var(--line)] bg-white/30 p-6">
        <h2 className="display text-2xl font-semibold">登记设备</h2>
        <form onSubmit={addDevice} className="mt-5 grid gap-3 sm:grid-cols-2">
          <input name="manufacturer" required placeholder="Manufacturer" className={field} />
          <input name="model" required placeholder="Model" className={field} />
          <select name="deviceType" className={field}><option value="phone">Phone</option><option value="action_camera">Action Camera</option><option value="camera">Camera</option><option value="other">Other</option></select>
          <select name="status" className={field}><option value="active">Active</option><option value="shared">Shared</option></select>
          <input name="serial" placeholder="Serial（只保存 HMAC）" className={field} />
          <input name="firmwareVersion" placeholder="Firmware" className={field} />
          <label className="flex items-center gap-2 text-sm"><input name="setAsDefault" type="checkbox" defaultChecked />设为 Default Device</label>
          <button disabled={Boolean(busy)} className="bg-[var(--ink)] px-4 py-3 font-bold text-[var(--paper)]">{busy === "device" ? "登记中…" : "登记设备"}</button>
        </form>
        <div className="mt-6 space-y-2">{devices.map((device) => <article key={device.publicId} className="flex flex-wrap justify-between gap-3 border-t border-[var(--line)] py-4 text-sm"><div><p className="font-bold">{device.manufacturer} {device.model}</p><p className="mt-1 text-xs text-[var(--muted)]">{device.publicId} · {device.deviceType}{device.isDefault ? " · Default" : ""}</p></div><span>{device.status}</span></article>)}{devices.length === 0 ? <p className="text-sm text-[var(--muted)]">尚未登记设备。</p> : null}</div>
      </section>
      {error ? <p className="border-l-4 border-[var(--signal)] bg-white/50 px-4 py-3 text-sm" role="alert">{error}</p> : null}
    </div>
  );
}
