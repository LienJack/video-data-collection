"use client";

import { Card } from "@egocapture/ui/components/card";
import { Label } from "@egocapture/ui/components/label";
import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Textarea } from "@egocapture/ui/components/textarea";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { Checkbox } from "@egocapture/ui/components/checkbox";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RegionalPreferencesFields } from "@/app/_components/regional-preferences-fields";
import { useI18n } from "@egocapture/ui/lib/i18n";

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
  const i18n = useI18n();
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
    const payload = await response.json() as { data?: { invitationUrl?: string }; error?: { code?: string } };
    if (!response.ok || !payload.data?.invitationUrl) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.invitationCreateFailed"));
    else {
      setInvitationUrl(payload.data.invitationUrl);
      setCurrentInvitationStatus("generated");
      router.refresh();
    }
    setBusy("");
  }

  async function revokeCurrentInvitation() {
    if (reason.trim().length < 10) { setError(i18n.t("adminUi.reasonMinError")); return; }
    setBusy("revoke-invitation"); setError("");
    const response = await fetch(
      `/api/admin/participants/${participantPublicId}/invitations/revoke`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.invitationRevokeFailed"));
    else {
      setInvitationUrl("");
      setCurrentInvitationStatus("revoked");
      setReason("");
      router.refresh();
    }
    setBusy("");
  }

  async function changeStatus(action: "suspend" | "reactivate" | "withdraw") {
    if (reason.trim().length < 10) { setError(i18n.t("adminUi.statusChangeReasonError")); return; }
    setBusy(action); setError("");
    const response = await fetch(`/api/admin/participants/${participantPublicId}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.statusChangeFailed"));
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
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.deviceCreateFailed"));
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
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.participantUpdateFailed"));
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
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.deviceUpdateFailed"));
    else router.refresh();
    setBusy("");
  }

  const field = "w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 outline-none focus:border-[var(--teal)]";
  return (
    <div className="space-y-8">
      <section className="border border-[var(--line)] bg-white/30 p-6">
        <h2 className="display text-2xl font-semibold">{i18n.t("adminUi.participantProfile")}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{i18n.t("adminUi.participantProfileHelp")}</p>
        <form onSubmit={updateProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
          <Label className="text-xs font-bold uppercase tracking-[0.12em]">{i18n.t("adminUi.displayAlias")}<Input name="displayAlias" required maxLength={120} defaultValue={profile.displayAlias} className={`mt-2 ${field}`} /></Label>
          <Label className="text-xs font-bold uppercase tracking-[0.12em]">{i18n.t("adminUi.managementEmail")}<Input name="managementEmail" type="email" defaultValue={profile.managementEmail ?? ""} className={`mt-2 ${field}`} /></Label>
          <RegionalPreferencesFields
            defaultCountry={profile.countryRegion}
            defaultLocale={profile.locale}
            defaultTimezone={profile.timezone}
            fieldClassName={`mt-2 ${field}`}
            labelClassName="text-xs font-bold uppercase tracking-[0.12em]"
          />
          <Label className="text-xs font-bold uppercase tracking-[0.12em] sm:col-span-2">{i18n.t("common.notes")}<Textarea name="notes" maxLength={500} defaultValue={profile.notes ?? ""} className={`mt-2 min-h-24 ${field}`} /><span className="mt-1 block font-normal normal-case text-[var(--muted)]">{i18n.t("adminUi.sensitiveNotesHelp")}</span></Label>
          <Button disabled={Boolean(busy) || fixtureProtected} className="bg-[var(--teal)] px-4 py-3 font-bold text-white sm:col-span-2">{busy === "profile" ? i18n.t("common.saving") : i18n.t("adminUi.saveParticipant")}</Button>
        </form>
      </section>
      <section className="border border-[var(--line)] bg-white/30 p-6">
        <h2 className="display text-2xl font-semibold">{i18n.t("adminUi.invitationAndStatus")}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{i18n.t("adminUi.invitationHashHelp")}</p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {i18n.t("adminUi.currentInvitation", { status: currentInvitationStatus ? i18n.state("participant_invitation.status", currentInvitationStatus) : i18n.t("adminUi.notGenerated") })}
          {invitationExpiresAt && ["generated", "opened"].includes(currentInvitationStatus || "")
            ? ` · ${i18n.date(invitationExpiresAt)}`
            : ""}
        </p>
        {isFixture ? <p className="mt-4 border-l-4 border-[var(--yellow)] px-3 text-sm">{i18n.t("adminUi.demoData")}{fixtureProtected ? ` · ${i18n.t("adminUi.fixtureProtected")}` : ""}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {["draft", "invited", "expired"].includes(status) ? <Button disabled={Boolean(busy) || fixtureProtected} onClick={generateInvitation} className="bg-[var(--signal)] px-4 py-2.5 font-bold text-white">{busy === "invite" ? i18n.t("adminUi.generating") : i18n.t("adminUi.generateInvitation")}</Button> : null}
        </div>
        {invitationUrl ? <div className="mt-4 break-all border border-[var(--teal)] bg-[var(--teal-soft)] p-4 text-sm"><p className="font-bold">{i18n.t("adminUi.oneTimeInvitationUrl")}</p><p className="mt-2">{invitationUrl}</p><div className="mt-3 flex gap-4"><Button variant="link" className="border-b border-[var(--ink)] font-bold" onClick={() => navigator.clipboard.writeText(invitationUrl)}>{i18n.t("adminUi.copyLink")}</Button><a href={invitationUrl} target="_blank" rel="noreferrer" className="border-b border-[var(--ink)] font-bold">{i18n.t("adminUi.openNewWindow")}</a></div></div> : null}
        {status !== "withdrawn" ? <div className="mt-6"><Label className="text-xs font-bold uppercase tracking-[0.14em]">{i18n.t("adminUi.operationReason")}<Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder={i18n.t("adminUi.minimum10")} className={`mt-2 ${field}`} /></Label><div className="mt-3 flex flex-wrap gap-2">{["generated", "opened"].includes(currentInvitationStatus || "") ? <Button variant="outline" disabled={Boolean(busy) || fixtureProtected} onClick={revokeCurrentInvitation} className="border-[var(--signal)] px-3 py-2 font-bold text-[var(--signal)]">{i18n.t("adminUi.revokeInvitation")}</Button> : null}{status === "active" ? <Button variant="outline" disabled={Boolean(busy) || fixtureProtected} onClick={() => changeStatus("suspend")} className="border-[var(--ink)] px-3 py-2 font-bold">{i18n.t("adminUi.pauseParticipant")}</Button> : null}{status === "suspended" ? <Button variant="outline" disabled={Boolean(busy) || fixtureProtected} onClick={() => changeStatus("reactivate")} className="border-[var(--teal)] px-3 py-2 font-bold text-[var(--teal)]">{i18n.t("adminUi.reactivateParticipant")}</Button> : null}<Button variant="outline" disabled={Boolean(busy) || fixtureProtected} onClick={() => changeStatus("withdraw")} className="border-[var(--signal)] px-3 py-2 font-bold text-[var(--signal)]">{i18n.t("adminUi.withdrawParticipant")}</Button></div></div> : null}
      </section>

      <section className="border border-[var(--line)] bg-white/30 p-6">
        <h2 className="display text-2xl font-semibold">{i18n.t("adminUi.registerDevice")}</h2>
        <form onSubmit={addDevice} className="mt-5 grid gap-3 sm:grid-cols-2">
          <Input name="manufacturer" required placeholder={i18n.t("adminUi.manufacturer")} className={field} />
          <Input name="model" required placeholder={i18n.t("adminUi.model")} className={field} />
          <NativeSelect name="deviceType" className={field}><NativeSelectOption value="phone">{i18n.t("adminUi.deviceTypePhone")}</NativeSelectOption><NativeSelectOption value="action_camera">{i18n.t("adminUi.deviceTypeActionCamera")}</NativeSelectOption><NativeSelectOption value="camera">{i18n.t("adminUi.deviceTypeCamera")}</NativeSelectOption><NativeSelectOption value="other">{i18n.t("adminUi.deviceTypeOther")}</NativeSelectOption></NativeSelect>
          <NativeSelect name="status" className={field}><NativeSelectOption value="active">{i18n.state("device.status", "active")}</NativeSelectOption><NativeSelectOption value="shared">{i18n.state("device.status", "shared")}</NativeSelectOption></NativeSelect>
          <Input name="serial" placeholder={i18n.t("adminUi.serialHmacOnly")} className={field} />
          <Input name="firmwareVersion" placeholder={i18n.t("adminUi.firmware")} className={field} />
          <Label className="flex items-center gap-2 text-sm"><Checkbox name="setAsDefault" defaultChecked />{i18n.t("adminUi.setDefaultDevice")}</Label>
          <Button disabled={Boolean(busy) || fixtureProtected} className="bg-[var(--ink)] px-4 py-3 font-bold text-[var(--paper)]">{busy === "device" ? i18n.t("adminUi.registering") : i18n.t("adminUi.registerDevice")}</Button>
        </form>
        <div className="mt-6 space-y-3">{devices.map((device) => <Card as="article" key={device.publicId} className="border-t border-[var(--line)] py-4 text-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{device.manufacturer} {device.model}</p><p className="mt-1 text-xs text-[var(--muted)]">{device.publicId} · {device.deviceType}{device.isDefault ? ` · ${i18n.t("adminUi.defaultDevice")}` : ""}</p></div><span className="font-bold uppercase">{i18n.state("device.status", device.status)}</span></div><form onSubmit={(event) => void updateDevice(event, device)} className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px_1.5fr_auto]"><Input name="firmwareVersion" defaultValue={device.firmwareVersion ?? ""} placeholder={i18n.t("adminUi.firmware")} className={field} /><NativeSelect name="status" defaultValue={device.status} disabled={device.status === "retired"} className={field}><NativeSelectOption value="active">{i18n.state("device.status", "active")}</NativeSelectOption><NativeSelectOption value="shared">{i18n.state("device.status", "shared")}</NativeSelectOption><NativeSelectOption value="lost">{i18n.state("device.status", "lost")}</NativeSelectOption><NativeSelectOption value="retired">{i18n.state("device.status", "retired")}</NativeSelectOption></NativeSelect><Input name="reason" required minLength={10} maxLength={500} placeholder={i18n.t("adminUi.updateReason")} className={field} /><Button variant="outline" disabled={Boolean(busy) || fixtureProtected} className="border-[var(--teal)] px-4 py-2 font-bold text-[var(--teal)]">{busy === `edit-${device.publicId}` ? i18n.t("common.saving") : i18n.t("common.edit")}</Button></form></Card>)}{devices.length === 0 ? <p className="text-sm text-[var(--muted)]">{i18n.t("adminUi.noDevices")}</p> : null}</div>
      </section>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    </div>
  );
}
