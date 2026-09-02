"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RegionalPreferencesFields } from "@/app/_components/regional-preferences-fields";

export function NewParticipantForm({ studies }: { studies: { publicId: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/participants", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        studyPublicId: form.get("studyPublicId"),
        displayAlias: form.get("displayAlias"),
        managementEmail: form.get("managementEmail") || null,
        locale: form.get("locale"),
        timezone: form.get("timezone"),
        countryRegion: form.get("countryRegion") || null,
        consentVersion: form.get("consentVersion"),
        notes: form.get("notes") || null,
      }),
    });
    const payload = await response.json() as { data?: { participantPublicId?: string }; error?: { message?: string } };
    if (!response.ok || !payload.data?.participantPublicId) {
      setError(payload.error?.message || "创建失败");
      setBusy(false);
      return;
    }
    router.push(`/participants/${payload.data.participantPublicId}`);
  }
  const inputClass = "mt-2 w-full border border-[var(--line)] bg-transparent px-4 py-3 outline-none focus:border-[var(--teal)]";
  return (
    <form onSubmit={submit} className="mt-8 grid gap-6 border border-[var(--line)] bg-white/30 p-6 sm:grid-cols-2 sm:p-8">
      <label className="text-sm font-semibold">Study<select name="studyPublicId" required className={inputClass}>{studies.map((study) => <option key={study.publicId} value={study.publicId}>{study.name} · {study.publicId}</option>)}</select></label>
      <label className="text-sm font-semibold">Display Alias<input name="displayAlias" maxLength={120} required className={inputClass} /></label>
      <label className="text-sm font-semibold">管理邮箱（不发送邮件）<input name="managementEmail" type="email" maxLength={254} className={inputClass} /></label>
      <label className="text-sm font-semibold">Consent Version<input name="consentVersion" defaultValue="demo-consent-v1" maxLength={40} required className={inputClass} /></label>
      <RegionalPreferencesFields fieldClassName={inputClass} labelClassName="text-sm font-semibold" />
      <label className="text-sm font-semibold sm:col-span-2">Notes<textarea name="notes" maxLength={500} rows={4} className={inputClass} /><span className="mt-2 block text-xs font-normal text-[var(--muted)]">最多 500 字，请勿填写姓名、电话等敏感信息。</span></label>
      {error ? <p className="border-l-4 border-[var(--signal)] px-4 py-3 text-sm sm:col-span-2" role="alert">{error}</p> : null}
      <button disabled={busy || studies.length === 0} className="bg-[var(--signal)] px-6 py-4 font-bold text-white disabled:opacity-60 sm:col-span-2">{busy ? "正在创建…" : "创建 Draft Participant"}</button>
    </form>
  );
}
