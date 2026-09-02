"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button } from "@egocapture/ui/components/button";
import { useState, type FormEvent } from "react";

export function AcceptInvitationForm({ token }: { token: string }) {
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
      const payload = await response.json() as { data?: { redirectTo?: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.redirectTo) {
        setError(payload.error?.message || "邀请无效或已过期");
        return;
      }
      window.location.assign(payload.data.redirectTo);
    } catch {
      setError("暂时无法接受邀请，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <p className="text-sm leading-7 text-[var(--muted)]">
        登录帐号和系统生成的密码由管理员提供。确认后将激活你的 Participant 工作区。
      </p>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Button disabled={busy} className="w-full disabled:opacity-60">
        {busy ? "正在激活…" : "接受邀请并进入任务"}
      </Button>
    </form>
  );
}
