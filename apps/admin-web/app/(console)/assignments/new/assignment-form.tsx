"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Label } from "@egocapture/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LocaleSelect } from "@/app/_components/regional-preferences-fields";
import { useI18n } from "@egocapture/ui/lib/i18n";

type ParticipantOption = { publicId: string; displayAlias: string };
type VersionOption = { taskPublicId: string; taskTitle: string; version: number };
type DeviceOption = { publicId: string; label: string };

export function AssignmentForm({ participants, versions, devices }: {
  participants: ParticipantOption[];
  versions: VersionOption[];
  devices: DeviceOption[];
}) {
  const router = useRouter();
  const i18n = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const [taskPublicId, taskVersion] = String(form.get("taskVersion")).split(":");
    const response = await fetch("/api/admin/assignments", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        participantPublicId: form.get("participantPublicId"),
        taskPublicId,
        taskVersion: Number(taskVersion),
        dueAt: new Date(String(form.get("dueAt"))).toISOString(),
        preferredDevicePublicId: form.get("preferredDevicePublicId") || null,
        locale: form.get("locale") || undefined,
        note: form.get("note") || null,
      }),
    });
    const payload = await response.json() as { data?: { assignmentPublicId?: string }; error?: { code?: string } };
    if (!response.ok || !payload.data?.assignmentPublicId) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.assignmentCreateFailed"));
    else router.push("/assignments");
    setBusy(false);
  }
  const field = "mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-4 py-3";
  return <form onSubmit={submit} className="mt-8 grid gap-6 border border-[var(--line)] bg-white/30 p-7 sm:grid-cols-2"><Label className="text-sm font-bold">{i18n.t("common.participant")}<NativeSelect name="participantPublicId" required className={field}>{participants.map((participant) => <NativeSelectOption key={participant.publicId} value={participant.publicId}>{participant.displayAlias} · {participant.publicId}</NativeSelectOption>)}</NativeSelect></Label><Label className="text-sm font-bold">{i18n.t("adminUi.publishedTaskVersion")}<NativeSelect name="taskVersion" required className={field}>{versions.map((version) => <NativeSelectOption key={`${version.taskPublicId}:${version.version}`} value={`${version.taskPublicId}:${version.version}`}>{version.taskTitle} · {i18n.t("common.version", { value: version.version })}</NativeSelectOption>)}</NativeSelect></Label><Label className="text-sm font-bold">{i18n.t("common.dueAt")}<Input name="dueAt" type="datetime-local" required className={field} /></Label><Label className="text-sm font-bold">{i18n.t("adminUi.preferredDevice")}<NativeSelect name="preferredDevicePublicId" className={field}><NativeSelectOption value="">{i18n.t("adminUi.noDevice")}</NativeSelectOption>{devices.map((device) => <NativeSelectOption key={device.publicId} value={device.publicId}>{device.label} · {device.publicId}</NativeSelectOption>)}</NativeSelect></Label><Label className="text-sm font-bold">{i18n.t("adminUi.locale")}<LocaleSelect name="locale" defaultValue="zh-CN" className={field} /></Label><Label className="text-sm font-bold">{i18n.t("adminUi.assignmentNote")}<Input name="note" maxLength={500} className={field} /></Label>{error ? <Alert role="alert" className="border-l-4 border-[var(--signal)] px-4 py-3 text-sm sm:col-span-2"><AlertDescription>{error}</AlertDescription></Alert> : null}<Button disabled={busy || participants.length === 0 || versions.length === 0} className="bg-[var(--signal)] px-5 py-4 font-bold text-white disabled:opacity-50 sm:col-span-2">{busy ? i18n.t("adminUi.creating") : i18n.t("adminUi.createAssignment")}</Button></form>;
}
