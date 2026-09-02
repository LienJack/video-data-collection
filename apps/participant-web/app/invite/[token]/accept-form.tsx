"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button } from "@egocapture/ui/components/button";
import { useState, type FormEvent } from "react";
import { useI18n } from "@egocapture/ui/lib/i18n";

export function AcceptInvitationForm({ token }: { token: string }) {
  const i18n = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
      });
      const payload = await response.json() as { data?: { redirectTo?: string }; error?: { code?: string } };
      if (!response.ok || !payload.data?.redirectTo) {
        setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("participantUi.invitationInvalid"));
        return;
      }
      window.location.assign(payload.data.redirectTo);
    } catch {
      setError(i18n.error("INVITATION_ACCEPT_FAILED"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <p className="text-sm leading-7 text-[var(--muted)]">
        {i18n.t("participantUi.invitationAccountBody")}
      </p>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Button disabled={busy} className="w-full disabled:opacity-60">
        {busy ? i18n.t("participantUi.activating") : i18n.t("participantUi.acceptInvitation")}
      </Button>
    </form>
  );
}
