"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RegionalPreferencesFields } from "@/app/_components/regional-preferences-fields";

type Device = {
  publicId: string;
  manufacturer: string;
  model: string;
  deviceType: string;
  firmwareVersion: string | null;
  status: string;
  assignedAt: string;
  isDefault: boolean;
  updatedAt: string;
};

type ParticipantProfile = {
  displayAlias: string;
  managementEmail: string | null;
  locale: string;
  timezone: string;
  countryRegion: string | null;
  notes: string | null;
  updatedAt: string;
};

export function ParticipantControls({
  participantPublicId,
  status,
  isFixture,
  fixtureProtected,
  profile,
  invitationStatus,
  invitationExpiresAt,
  devices,
}: {
  participantPublicId: string;
  status: string;
  isFixture: boolean;
  fixtureProtected: boolean;
  profile: ParticipantProfile;
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
    else { formElement.reset(); router.refresh(); }
    setBusy("");
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("profile"); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/participants/${participantPublicId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayAlias: form.get("displayAlias"),
        managementEmail: form.get("managementEmail") || null,
        locale: form.get("locale"),
        timezone: form.get("timezone"),
        countryRegion: form.get("countryRegion") || null,
        notes: form.get("notes") || null,
        expectedUpdatedAt: profile.updatedAt,
      }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "Participant 更新失败");
    else router.refresh();
    setBusy("");
  }

  async function updateDevice(event: FormEvent<HTMLFormElement>, device: Device) {
    event.preventDefault(); setBusy(`edit-${device.publicId}`); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/devices/${device.publicId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firmwareVersion: form.get("firmwareVersion") || null,
        status: form.get("status"),
        reason: form.get("reason"),
        expectedUpdatedAt: device.updatedAt,
      }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "Device 更新失败");
    else router.refresh();
    setBusy("");
  }

  const field = "w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 outline-none focus:border-[var(--teal)]";
  return (
    <div className="space-y-8">
      <section className="border border-[var(--line)] bg-white/30 p-6">
        <h2 className="display text-2xl font-semibold">Participant 资料</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">管理邮箱仅作内部记录，不发送真实邮件。Notes 不得填写敏感信息。</p>
        <form onSubmit={updateProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold uppercase tracking-[0.12em]">Display Alias<input name="displayAlias" required maxLength={120} defaultValue={profile.displayAlias} className={`mt-2 ${field}`} /></label>
          <label className="text-xs font-bold uppercase tracking-[0.12em]">Management Email<input name="managementEmail" type="email" defaultValue={profile.managementEmail ?? ""} className={`mt-2 ${field}`} /></label>
          <RegionalPreferencesFields
            defaultCountry={profile.countryRegion}
            defaultLocale={profile.locale}
            defaultTimezone={profile.timezone}
            fieldClassName={`mt-2 ${field}`}
            labelClassName="text-xs font-bold uppercase tracking-[0.12em]"
          />
          <label className="text-xs font-bold uppercase tracking-[0.12em] sm:col-span-2">Notes<textarea name="notes" maxLength={500} defaultValue={profile.notes ?? ""} className={`mt-2 min-h-24 ${field}`} /><span className="mt-1 block font-normal normal-case text-[var(--muted)]">最多 500 字；请勿写姓名、住址、证件号等敏感信息。</span></label>
          <button disabled={Boolean(busy) || fixtureProtected} className="bg-[var(--teal)] px-4 py-3 font-bold text-white sm:col-span-2">{busy === "profile" ? "保存中…" : "保存 Participant 资料"}</button>
        </form>
      </section>
      <section className="border border-[var(--line)] bg-white/30 p-6">
        <h2 className="display text-2xl font-semibold">邀请与状态</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">邀请链接只显示一次；数据库仅保存 SHA-256 hash。</p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          当前邀请：{currentInvitationStatus || "尚未生成"}
          {invitationExpiresAt && ["generated", "opened"].includes(currentInvitationStatus || "")
            ? ` · ${new Date(invitationExpiresAt).toLocaleString("zh-CN")}`
            : ""}
        </p>
        {isFixture ? <p className="mt-4 border-l-4 border-[var(--yellow)] px-3 text-sm">Demo Fixture{fixtureProtected ? " 受保护，公开管理员不能修改。" : "。"}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {["draft", "invited", "expired"].includes(status) ? <button disabled={Boolean(busy) || fixtureProtected} onClick={generateInvitation} className="bg-[var(--signal)] px-4 py-2.5 font-bold text-white">{busy === "invite" ? "生成中…" : "生成 / 重发邀请"}</button> : null}
        </div>
        {invitationUrl ? <div className="mt-4 break-all border border-[var(--teal)] bg-[var(--teal-soft)] p-4 text-sm"><p className="font-bold">一次性邀请 URL</p><p className="mt-2">{invitationUrl}</p><div className="mt-3 flex gap-4"><button className="border-b border-[var(--ink)] font-bold" onClick={() => navigator.clipboard.writeText(invitationUrl)}>复制链接</button><a href={invitationUrl} target="_blank" rel="noreferrer" className="border-b border-[var(--ink)] font-bold">新窗口打开</a></div></div> : null}
        {status !== "withdrawn" ? <div className="mt-6"><label className="text-xs font-bold uppercase tracking-[0.14em]">操作原因<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="至少 10 个字符" className={`mt-2 ${field}`} /></label><div className="mt-3 flex flex-wrap gap-2">{["generated", "opened"].includes(currentInvitationStatus || "") ? <button disabled={Boolean(busy) || fixtureProtected} onClick={revokeCurrentInvitation} className="border border-[var(--signal)] px-3 py-2 font-bold text-[var(--signal)]">撤销邀请</button> : null}{status === "active" ? <button disabled={Boolean(busy) || fixtureProtected} onClick={() => changeStatus("suspend")} className="border border-[var(--ink)] px-3 py-2 font-bold">暂停</button> : null}{status === "suspended" ? <button disabled={Boolean(busy) || fixtureProtected} onClick={() => changeStatus("reactivate")} className="border border-[var(--teal)] px-3 py-2 font-bold text-[var(--teal)]">恢复</button> : null}<button disabled={Boolean(busy) || fixtureProtected} onClick={() => changeStatus("withdraw")} className="border border-[var(--signal)] px-3 py-2 font-bold text-[var(--signal)]">退出研究</button></div></div> : null}
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
          <button disabled={Boolean(busy) || fixtureProtected} className="bg-[var(--ink)] px-4 py-3 font-bold text-[var(--paper)]">{busy === "device" ? "登记中…" : "登记设备"}</button>
        </form>
        <div className="mt-6 space-y-3">{devices.map((device) => <article key={device.publicId} className="border-t border-[var(--line)] py-4 text-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{device.manufacturer} {device.model}</p><p className="mt-1 text-xs text-[var(--muted)]">{device.publicId} · {device.deviceType}{device.isDefault ? " · Default" : ""}</p></div><span className="font-bold uppercase">{device.status}</span></div><form onSubmit={(event) => void updateDevice(event, device)} className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px_1.5fr_auto]"><input name="firmwareVersion" defaultValue={device.firmwareVersion ?? ""} placeholder="Firmware" className={field} /><select name="status" defaultValue={device.status} disabled={device.status === "retired"} className={field}><option value="active">Active</option><option value="shared">Shared</option><option value="lost">Lost</option><option value="retired">Retired</option></select><input name="reason" required minLength={10} maxLength={500} placeholder="修改原因（10～500 字符）" className={field} /><button disabled={Boolean(busy) || fixtureProtected} className="border border-[var(--teal)] px-4 py-2 font-bold text-[var(--teal)]">{busy === `edit-${device.publicId}` ? "保存中…" : "更新"}</button></form></article>)}{devices.length === 0 ? <p className="text-sm text-[var(--muted)]">尚未登记设备。</p> : null}</div>
      </section>
      {error ? <p className="border-l-4 border-[var(--signal)] bg-white/50 px-4 py-3 text-sm" role="alert">{error}</p> : null}
    </div>
  );
}
