import { Card } from "@egocapture/ui/components/card";
import Link from "next/link";
import { FieldSessionPreview } from "@/app/_components/field-session-preview";
import { MagneticLink } from "@/app/_components/magnetic-link";
import styles from "@/app/home.module.css";
import { LanguageSwitcher } from "@egocapture/ui/components/language-switcher";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export default async function Home() {
  const { t } = createTranslator(await requestLocale());
  const proofPoints = [
    { value: t("participantUi.proofVersion"), label: t("participantUi.proofVersionBody") },
    { value: t("participantUi.proofMarker"), label: t("participantUi.proofMarkerBody") },
    { value: t("participantUi.proofResume"), label: t("participantUi.proofResumeBody") },
    { value: t("participantUi.proofDirect"), label: t("participantUi.proofDirectBody") },
  ];
  const workflow = [
    { code: "01", title: t("participantUi.workflow1Title"), copy: t("participantUi.workflow1Body") },
    { code: "02", title: t("participantUi.workflow2Title"), copy: t("participantUi.workflow2Body") },
    { code: "03", title: t("participantUi.workflow3Title"), copy: t("participantUi.workflow3Body") },
  ];
  return (
    <main className={`${styles.page} min-h-[100dvh] overflow-hidden px-4 pb-6 pt-3 sm:px-6 lg:px-10`}>
      <header className={`${styles.header} sticky top-3 mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-5`}>
        <Link href="/" className="display text-[1.05rem] font-semibold tracking-[-0.045em]">
          EgoCapture
        </Link>
        <p className="hidden text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--home-muted)] sm:block">
          {t("participantUi.homePlatform")}
        </p>
        <Link href="/login" className={styles.navAction}>
          {t("participantUi.loginWorkbench")}
        </Link>
        <LanguageSwitcher className="ml-3" />
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-12 pb-16 pt-16 md:pt-24 lg:grid-cols-12 lg:items-center lg:gap-8 lg:pb-28 lg:pt-24">
        <div className="lg:col-span-7 lg:pr-10 xl:pr-20">
          <p className={styles.kicker}>
            <span aria-hidden="true" />
            {t("participantUi.homePlatform")}
          </p>
          <h1 className={`${styles.heroTitle} mt-7 max-w-[12ch]`}>
            {t("participantUi.heroLine1")}
            <span>{t("participantUi.heroLine2")}</span>
          </h1>
          <p className="mt-7 max-w-[39rem] text-[1rem] leading-8 text-[var(--home-muted)] sm:mt-8 sm:text-[1.08rem]">
            {t("participantUi.heroBody")}
          </p>
          <div className={`${styles.heroActions} mt-9 flex flex-wrap items-center gap-5`}>
            <MagneticLink href="/login">{t("participantUi.loginWorkbench")}</MagneticLink>
            <Link href="#workflow" className={styles.textAction}>
              {t("participantUi.viewWorkflow")}
            </Link>
          </div>
          <p className="mt-7 flex max-w-lg items-start gap-3 text-xs leading-6 text-[var(--home-muted)]">
            <span className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-[var(--home-accent)]" aria-hidden="true" />
            {t("participantUi.demoWarning")}
          </p>
        </div>

        <div className="lg:col-span-5">
          <FieldSessionPreview />
        </div>
      </section>

      <section className={`${styles.proofBand} mx-auto max-w-[1400px] px-6 py-8 sm:px-9 sm:py-10 lg:px-12`} aria-labelledby="proof-title">
        <div className="grid gap-9 lg:grid-cols-[1fr_2fr] lg:items-end">
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/48">{t("participantUi.proofKicker")}</p>
            <h2 id="proof-title" className="display mt-3 max-w-md text-2xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-3xl">
              {t("participantUi.proofHeading")}
            </h2>
          </div>
          <dl className="grid grid-cols-2 border-l border-white/10 lg:grid-cols-4">
            {proofPoints.map((item) => (
              <div key={item.value} className="border-r border-white/10 px-4 py-1 last:border-r-0 sm:px-6">
                <dt className="font-mono text-lg font-medium tracking-[-0.04em] text-white sm:text-xl">{item.value}</dt>
                <dd className="mt-2 text-[0.7rem] leading-5 text-white/48">{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="workflow" className="mx-auto grid max-w-[1400px] gap-12 px-1 py-20 sm:px-3 lg:grid-cols-12 lg:gap-8 lg:py-32">
        <div className="lg:col-span-5">
          <p className={styles.kicker}>
            <span aria-hidden="true" />
            {t("participantUi.workflowKicker")}
          </p>
          <h2 className="display mt-6 max-w-[12ch] text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-5xl">
            {t("participantUi.workflowHeading")}
          </h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-[var(--home-muted)]">
            {t("participantUi.workflowBody")}
          </p>
        </div>

        <div className="lg:col-span-7 lg:pl-8">
          {workflow.map((step) => (
            <Card as="article" key={step.code} className={styles.workflowRow}>
              <p className={styles.stepCode}>{step.code}</p>
              <div>
                <h3 className="display text-2xl font-semibold tracking-[-0.04em] sm:text-[1.75rem]">{step.title}</h3>
                <p className="mt-3 max-w-[42rem] text-sm leading-7 text-[var(--home-muted)]">{step.copy}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <footer className={`${styles.footer} mx-auto flex max-w-[1400px] flex-col gap-7 px-2 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-4`}>
        <div>
          <p className="display text-xl font-semibold tracking-[-0.04em]">{t("participantUi.footerHeading")}</p>
          <p className="mt-2 text-xs leading-5 text-[var(--home-muted)]">{t("participantUi.footerBody")}</p>
        </div>
        <Link href="/login" className={styles.footerAction}>
          {t("participantUi.loginWorkbench")}
        </Link>
      </footer>
    </main>
  );
}
