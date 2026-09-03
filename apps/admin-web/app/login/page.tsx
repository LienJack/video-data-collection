import { ChartLineUp, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@egocapture/ui/components/card";
import { AdminLoginForm } from "@/app/login/login-form";
import { LanguageSwitcher } from "@egocapture/ui/components/language-switcher";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export default async function AdminLoginPage() {
  const { t } = createTranslator(await requestLocale());
  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[0.92fr_1.08fr]">
      <section className="relative hidden overflow-hidden bg-[var(--ink)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="display relative z-10 text-xl font-semibold">EgoCapture Ops</p>
        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">{t("auth.adminHeading")}</p>
          <h1 className="display mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.055em]">{t("auth.adminHeadline")}</h1>
          <p className="mt-8 flex items-center gap-2 text-sm text-white/65"><ChartLineUp className="size-5" weight="duotone" />{t("auth.adminAudit")}</p>
        </div>
        <p className="relative z-10 text-xs leading-6 text-white/45">{t("auth.authorizedOnly")}</p>
      </section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-lg reveal">
          <p className="display mb-16 text-xl font-semibold lg:hidden">EgoCapture Ops</p>
          <div className="mb-6 flex justify-end"><LanguageSwitcher /></div>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--teal-soft)] text-[var(--signal-dark)]"><ShieldCheck className="size-6" weight="duotone" /></div>
          <p className="page-kicker mt-8">{t("auth.adminAccess")}</p>
          <h1 className="page-title">{t("auth.adminHeading")}</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{t("auth.separated")}</p>
          <Card className="mt-8 p-5 sm:p-7"><AdminLoginForm /></Card>
        </div>
      </section>
    </main>
  );
}
