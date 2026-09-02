"use client";

import { Translate } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SUPPORTED_LOCALES, type UiLocale } from "@egocapture/core/i18n";
import { useI18n } from "../lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const router = useRouter();
  const i18n = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function changeLocale(locale: UiLocale) {
    if (locale === i18n.locale || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!response.ok) throw new Error("LOCALE_UPDATE_FAILED");
      router.refresh();
    } catch {
      setError(i18n.t("language.changeFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <Translate className="size-4 shrink-0" aria-hidden="true" />
      <label className="sr-only" htmlFor="ui-locale">{i18n.t("language.label")}</label>
      <select
        id="ui-locale"
        value={i18n.locale}
        disabled={busy}
        aria-busy={busy}
        aria-describedby={error ? "ui-locale-error" : undefined}
        onChange={(event) => void changeLocale(event.target.value as UiLocale)}
        className="min-h-9 rounded-full border border-current/15 bg-transparent px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-wait disabled:opacity-60"
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale} className="text-black">
            {locale === "zh-CN" ? i18n.t("language.zhCN") : locale === "en" ? i18n.t("language.en") : i18n.t("language.ja")}
          </option>
        ))}
      </select>
      {error ? <span id="ui-locale-error" role="alert" className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg bg-red-950 px-3 py-2 text-xs text-white shadow-lg">{error}</span> : null}
      <span className="sr-only" aria-live="polite">{busy ? i18n.t("language.changing") : ""}</span>
    </div>
  );
}
