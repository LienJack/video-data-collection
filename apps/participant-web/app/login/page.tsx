import { CheckCircle, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@egocapture/ui/components/card";
import Link from "next/link";
import { LoginForm } from "@/app/login/login-form";
import { LanguageSwitcher } from "@egocapture/ui/components/language-switcher";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export default async function LoginPage() {
  const { t } = createTranslator(await requestLocale());
  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[0.92fr_1.08fr]">
      <section className="relative hidden overflow-hidden bg-[var(--ink)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-28 top-1/3 size-96 rounded-full bg-[rgb(57_117_173_/_22%)] blur-3xl" aria-hidden="true" />
        <Link href="/" className="display relative z-10 text-xl font-semibold">EgoCapture</Link>
        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">{t("auth.fieldOperation")}</p>
          <blockquote className="display mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.055em]">
            {t("auth.participantQuote")}
          </blockquote>
          <div className="mt-10 grid grid-cols-2 gap-3 text-sm text-white/65">
            <p className="flex items-center gap-2"><CheckCircle className="size-4 text-white" weight="fill" /> {t("auth.privateStorage")}</p>
            <p className="flex items-center gap-2"><CheckCircle className="size-4 text-white" weight="fill" /> {t("auth.appendAudit")}</p>
          </div>
        </div>
        <p className="relative z-10 text-xs leading-6 text-white/45">{t("auth.demoSynthetic")}</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-lg reveal">
          <Link href="/" className="display mb-16 inline-block text-xl font-semibold lg:hidden">EgoCapture</Link>
          <div className="mb-6 flex justify-end"><LanguageSwitcher /></div>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--teal-soft)] text-[var(--signal-dark)]">
            <ShieldCheck className="size-6" weight="duotone" />
          </div>
          <p className="page-kicker mt-8">{t("auth.participantAccess")}</p>
          <h1 className="page-title">{t("auth.participantContinue")}</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{t("auth.participantLoginHelp")}</p>
          <Card className="mt-8 p-5 sm:p-7"><LoginForm /></Card>
        </div>
      </section>
    </main>
  );
}
