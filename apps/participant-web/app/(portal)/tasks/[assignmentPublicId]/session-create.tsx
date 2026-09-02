"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Button } from "@egocapture/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@egocapture/ui/lib/i18n";

type Device = { publicId: string; manufacturer: string; model: string; isDefault: boolean };

export function SessionCreate({ assignmentPublicId, devices }: { assignmentPublicId: string; devices: Device[] }) {
  const router = useRouter();
  const i18n = useI18n();
  const [devicePublicId, setDevicePublicId] = useState(devices.find((device) => device.isDefault)?.publicId || devices[0]?.publicId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    if (!devicePublicId) { setError(i18n.t("participantUi.contactAdminDevice")); return; }
    setBusy(true); setError("");
    const response = await fetch("/api/participant/sessions", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ assignmentPublicId, devicePublicId }),
    });
    const payload = await response.json() as { data?: { sessionPublicId?: string }; error?: { code?: string } };
    if (!response.ok || !payload.data?.sessionPublicId) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("participantUi.sessionCreateFailed"));
    else router.push(`/sessions/${payload.data.sessionPublicId}`);
    setBusy(false);
  }
  return <div className="mt-8 border border-[var(--line)] bg-white/40 p-5"><h2 className="display text-2xl font-semibold">{i18n.t("participantUi.createSession")}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{i18n.t("participantUi.createSessionBody")}</p><NativeSelect value={devicePublicId} onChange={(event) => setDevicePublicId(event.target.value)} className="mt-4 w-full border border-[var(--line)] bg-[var(--paper)] px-4 py-3">{devices.map((device) => <NativeSelectOption key={device.publicId} value={device.publicId}>{device.manufacturer} {device.model} · {device.publicId}{device.isDefault ? ` · ${i18n.t("participantUi.defaultDevice")}` : ""}</NativeSelectOption>)}</NativeSelect><Button onClick={create} disabled={busy || devices.length === 0} className="mt-4 w-full bg-[var(--ink)] px-5 py-4 font-bold text-[var(--paper)] disabled:opacity-50">{busy ? i18n.t("participantUi.creating") : i18n.t("participantUi.createSessionAndMarker")}</Button>{error ? <Alert role="alert" className="mt-3 border-l-4 border-[var(--signal)] px-4 py-3 text-sm"><AlertDescription>{error}</AlertDescription></Alert> : null}</div>;
}
