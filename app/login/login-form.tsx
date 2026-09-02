"use client";

import { useState, type FormEvent } from "react";

type Mode = "participant" | "admin";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("participant");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = mode === "admin"
      ? { identity: form.get("identity"), password: form.get("password") }
      : { participantPublicId: form.get("identity"), password: form.get("password") };
    try {
      const response = await fetch(`/api/auth/${mode}-login`, {
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
    <>
      <div className="mt-1 grid grid-cols-2 rounded-2xl bg-[var(--paper-deep)] p-1 text-sm font-semibold" role="tablist" aria-label="登录角色">
        {(["participant", "admin"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => { setMode(item); setError(""); }}
            className={mode === item ? "rounded-xl bg-white px-4 py-3 text-[var(--ink)] shadow-sm" : "rounded-xl px-4 py-3 text-[var(--muted)]"}
          >
            {item === "participant" ? "参与者" : "管理员"}
          </button>
        ))}
      </div>
      <form className="mt-7 space-y-5" onSubmit={submit}>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em]">
            {mode === "participant" ? "Participant ID" : "Admin Account"}
          </span>
          <input
            key={mode}
            name="identity"
            className="w-full border border-[var(--line)] bg-white/70 px-4 py-3.5 outline-none transition"
            placeholder={mode === "participant" ? "PT-XXXXXXXX" : "admin"}
            type="text"
            autoCapitalize="none"
            autoComplete="username"
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em]">Password</span>
          <input
            name="password"
            className="w-full border border-[var(--line)] bg-white/70 px-4 py-3.5 outline-none transition"
            type="password"
            placeholder={mode === "participant" ? "至少 10 位" : "至少 8 位"}
            minLength={mode === "participant" ? 10 : 8}
            maxLength={128}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="border-l-4 border-[var(--signal)] bg-white/45 px-4 py-3 text-sm" role="alert">{error}</p> : null}
        <button
          type="submit"
          className="primary-action w-full disabled:cursor-wait disabled:opacity-60"
          disabled={busy}
        >
          {busy ? "正在验证…" : mode === "participant" ? "进入我的任务" : "进入管理控制台"}
        </button>
      </form>
    </>
  );
}
