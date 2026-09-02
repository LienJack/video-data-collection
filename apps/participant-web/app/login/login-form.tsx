"use client";

import { Label } from "@egocapture/ui/components/label";
import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { useI18n } from "@egocapture/ui/lib/i18n";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const i18n = useI18n();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = { participantPublicId: form.get("identity"), password: form.get("password") };
    try {
      const response = await fetch("/api/auth/participant-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as {
        data?: { redirectTo?: string };
        error?: { code?: string };
      };
      if (!response.ok || !payload.data?.redirectTo) {
        setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("auth.loginFailed"));
        return;
      }
      window.location.assign(payload.data.redirectTo);
    } catch {
      setError(i18n.t("auth.networkFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
        <Label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em]">{i18n.t("auth.participantId")}</span>
          <Input
            name="identity"
            className="w-full border border-[var(--line)] bg-white/70 px-4 py-3.5 outline-none transition"
            placeholder="PT-XXXXXXXX"
            type="text"
            autoCapitalize="none"
            autoComplete="username"
            required
          />
        </Label>
        <Label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em]">{i18n.t("auth.password")}</span>
          <Input
            name="password"
            className="w-full border border-[var(--line)] bg-white/70 px-4 py-3.5 outline-none transition"
            type="password"
            placeholder={i18n.t("auth.passwordHint")}
            minLength={10}
            maxLength={128}
            autoComplete="current-password"
            required
          />
        </Label>
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        <Button
          type="submit"
          className=" w-full disabled:cursor-wait disabled:opacity-60"
          disabled={busy}
        >
          {busy ? i18n.t("auth.verifying") : i18n.t("auth.enterParticipant")}
        </Button>
      </form>
  );
}
