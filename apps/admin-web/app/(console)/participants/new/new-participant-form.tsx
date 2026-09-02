"use client";

import { Label } from "@egocapture/ui/components/label";
import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Textarea } from "@egocapture/ui/components/textarea";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RegionalPreferencesFields } from "@/app/_components/regional-preferences-fields";

export function NewParticipantForm() {
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
      <Label className="text-sm font-semibold">Display Alias<Input name="displayAlias" maxLength={120} required className={inputClass} /></Label>
      <Label className="text-sm font-semibold">管理邮箱（不发送邮件）<Input name="managementEmail" type="email" maxLength={254} className={inputClass} /></Label>
      <Label className="text-sm font-semibold">Consent Version<Input name="consentVersion" defaultValue="demo-consent-v1" maxLength={40} required className={inputClass} /></Label>
      <RegionalPreferencesFields fieldClassName={inputClass} labelClassName="text-sm font-semibold" />
      <Label className="text-sm font-semibold sm:col-span-2">Notes<Textarea name="notes" maxLength={500} rows={4} className={inputClass} /><span className="mt-2 block text-xs font-normal text-[var(--muted)]">最多 500 字，请勿填写姓名、电话等敏感信息。</span></Label>
      {error ? <Alert variant="destructive" className="sm:col-span-2"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Button disabled={busy} className="bg-[var(--signal)] px-6 py-4 font-bold text-white disabled:opacity-60 sm:col-span-2">{busy ? "正在创建…" : "创建 Draft Participant"}</Button>
    </form>
  );
}
