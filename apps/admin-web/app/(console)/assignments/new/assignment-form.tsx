"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ParticipantOption = { publicId: string; displayAlias: string; studyPublicId: string };
type VersionOption = { taskPublicId: string; taskTitle: string; version: number; studyPublicId: string };
type DeviceOption = { publicId: string; label: string; studyPublicId: string };

export function AssignmentForm({ participants, versions, devices }: {
  participants: ParticipantOption[];
  versions: VersionOption[];
  devices: DeviceOption[];
}) {
  const router = useRouter();
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
    const payload = await response.json() as { data?: { assignmentPublicId?: string }; error?: { message?: string } };
    if (!response.ok || !payload.data?.assignmentPublicId) setError(payload.error?.message || "Assignment 创建失败");
    else router.push("/assignments");
    setBusy(false);
  }
  const field = "mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-4 py-3";
  return <form onSubmit={submit} className="mt-8 grid gap-6 border border-[var(--line)] bg-white/30 p-7 sm:grid-cols-2"><label className="text-sm font-bold">Participant<select name="participantPublicId" required className={field}>{participants.map((participant) => <option key={participant.publicId} value={participant.publicId}>{participant.displayAlias} · {participant.publicId} · {participant.studyPublicId}</option>)}</select></label><label className="text-sm font-bold">Published TaskVersion<select name="taskVersion" required className={field}>{versions.map((version) => <option key={`${version.taskPublicId}:${version.version}`} value={`${version.taskPublicId}:${version.version}`}>{version.taskTitle} v{version.version} · {version.studyPublicId}</option>)}</select></label><label className="text-sm font-bold">Due At<input name="dueAt" type="datetime-local" required className={field} /></label><label className="text-sm font-bold">Preferred Device<select name="preferredDevicePublicId" className={field}><option value="">不指定</option>{devices.map((device) => <option key={device.publicId} value={device.publicId}>{device.label} · {device.publicId} · {device.studyPublicId}</option>)}</select></label><label className="text-sm font-bold">Locale<input name="locale" defaultValue="zh-CN" className={field} /></label><label className="text-sm font-bold">Note<input name="note" maxLength={500} className={field} /></label>{error ? <p role="alert" className="border-l-4 border-[var(--signal)] px-4 py-3 text-sm sm:col-span-2">{error}</p> : null}<button disabled={busy || participants.length === 0 || versions.length === 0} className="bg-[var(--signal)] px-5 py-4 font-bold text-white disabled:opacity-50 sm:col-span-2">{busy ? "创建中…" : "创建 Assignment"}</button></form>;
}
