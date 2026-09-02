"use client";

import { Label } from "@egocapture/ui/components/label";
import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { useState, type FormEvent } from "react";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    const confirmation = String(data.get("confirmation") || "");
    if (password !== confirmation) {
      setError("两次输入的密码不一致");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
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
      <Label className="block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em]">设置密码</span>
        <Input name="password" type="password" minLength={10} maxLength={128} required autoComplete="new-password" className="w-full border border-[var(--line)] bg-white/70 px-4 py-3.5 outline-none" />
      </Label>
      <Label className="block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em]">再次输入</span>
        <Input name="confirmation" type="password" minLength={10} maxLength={128} required autoComplete="new-password" className="w-full border border-[var(--line)] bg-white/70 px-4 py-3.5 outline-none" />
      </Label>
      <p className="text-xs leading-6 text-[var(--muted)]">至少 10 位。系统不会向管理邮箱发送真实邮件。</p>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Button disabled={busy} className=" w-full disabled:opacity-60">
        {busy ? "正在激活…" : "接受邀请并进入任务"}
      </Button>
    </form>
  );
}
