"use client";

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
      <label className="block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em]">设置密码</span>
        <input name="password" type="password" minLength={10} maxLength={128} required autoComplete="new-password" className="w-full border border-[var(--line)] bg-transparent px-4 py-3.5 outline-none focus:border-[var(--teal)]" />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em]">再次输入</span>
        <input name="confirmation" type="password" minLength={10} maxLength={128} required autoComplete="new-password" className="w-full border border-[var(--line)] bg-transparent px-4 py-3.5 outline-none focus:border-[var(--teal)]" />
      </label>
      <p className="text-xs leading-6 text-[var(--muted)]">至少 10 位。系统不会向管理邮箱发送真实邮件。</p>
      {error ? <p className="border-l-4 border-[var(--signal)] bg-white/45 px-4 py-3 text-sm" role="alert">{error}</p> : null}
      <button disabled={busy} className="w-full bg-[var(--signal)] px-5 py-4 font-bold text-white disabled:opacity-60">
        {busy ? "正在激活…" : "接受邀请并进入任务"}
      </button>
    </form>
  );
}
