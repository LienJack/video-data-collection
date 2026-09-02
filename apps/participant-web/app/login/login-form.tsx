"use client";

import { Label } from "@egocapture/ui/components/label";
import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { useState, type FormEvent } from "react";

export function LoginForm() {
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
        error?: { message?: string };
      };
      if (!response.ok || !payload.data?.redirectTo) {
        setError(payload.error?.message || "登录失败，请稍后再试");
        return;
      }
      window.location.assign(payload.data.redirectTo);
    } catch {
      setError("无法连接服务，请检查网络后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
        <Label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em]">Participant ID</span>
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
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em]">Password</span>
          <Input
            name="password"
            className="w-full border border-[var(--line)] bg-white/70 px-4 py-3.5 outline-none transition"
            type="password"
            placeholder="至少 10 位"
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
          {busy ? "正在验证…" : "进入我的任务"}
        </Button>
      </form>
  );
}
