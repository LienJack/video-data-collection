"use client";

import { Label } from "@egocapture/ui/components/label";
import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Textarea } from "@egocapture/ui/components/textarea";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RegionalPreferencesFields } from "@/app/_components/regional-preferences-fields";
import { useI18n } from "@egocapture/ui/lib/i18n";

export function NewParticipantForm() {
  const router = useRouter();
  const i18n = useI18n();
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
        notes: form.get("notes") || null,
      }),
    });
    const payload = await response.json() as { data?: { participantPublicId?: string }; error?: { code?: string } };
    if (!response.ok || !payload.data?.participantPublicId) {
      setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.participantCreateFailed"));
      setBusy(false);
      return;
    }
    router.push(`/participants/${payload.data.participantPublicId}`);
  }
  const inputClass = "mt-2 w-full border border-[var(--line)] bg-transparent px-4 py-3 outline-none focus:border-[var(--teal)]";
  return (
    <form onSubmit={submit} className="mt-8 grid gap-6 border border-[var(--line)] bg-white/30 p-6 sm:grid-cols-2 sm:p-8">
      <Label className="text-sm font-semibold">{i18n.t("adminUi.displayAlias")}<Input name="displayAlias" maxLength={120} required className={inputClass} /></Label>
      <Label className="text-sm font-semibold">{i18n.t("adminUi.managementEmailNoSend")}<Input name="managementEmail" type="email" maxLength={254} className={inputClass} /></Label>
      <RegionalPreferencesFields fieldClassName={inputClass} labelClassName="text-sm font-semibold" />
      <Label className="text-sm font-semibold sm:col-span-2">{i18n.t("common.notes")}<Textarea name="notes" maxLength={500} rows={4} className={inputClass} /><span className="mt-2 block text-xs font-normal text-[var(--muted)]">{i18n.t("adminUi.newNotesHelp")}</span></Label>
      {error ? <Alert variant="destructive" className="sm:col-span-2"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Button disabled={busy} className="bg-[var(--signal)] px-6 py-4 font-bold text-white disabled:opacity-60 sm:col-span-2">{busy ? i18n.t("adminUi.creatingParticipant") : i18n.t("adminUi.createDraftParticipant")}</Button>
    </form>
  );
}
