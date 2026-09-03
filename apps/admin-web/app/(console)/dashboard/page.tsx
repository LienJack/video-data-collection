import { buttonVariants } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import { Progress } from "@egocapture/ui/components/progress";
import { ArrowRight, ClipboardText, CloudArrowUp, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { dashboardSummary } from "@egocapture/core/server/services/review";
import { createTranslator, type Translator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [viewer, locale] = await Promise.all([requireAdmin(), requestLocale()]);
  const i18n = createTranslator(locale);
  const dashboard = await dashboardSummary(viewer);
  const signals = [
    [i18n.t("adminUi.missingUpload"), dashboard.summary.missing], [i18n.t("adminUi.uploadFailed"), dashboard.summary.uploadFailed],
    [i18n.t("adminUi.metadataFailed"), dashboard.summary.metadataFailed], [i18n.t("adminUi.unmatched"), dashboard.summary.unmatched],
    [i18n.t("adminUi.deviceMismatch"), dashboard.summary.deviceMismatch], [i18n.t("adminUi.awaitingReview"), dashboard.summary.needsReview],
  ];
  return (
    <main className="app-page">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div><p className="page-kicker">{i18n.t("adminUi.operationsCenter")}</p><h1 className="page-title">{i18n.t("adminUi.dashboard")}</h1></div>
        <div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 text-sm text-[var(--muted)]"><span className="size-2 rounded-full bg-[var(--signal)]" />{viewer.displayName}</div><Link href="/tasks" className={buttonVariants({ size: "lg" })}><ClipboardText className="size-4" weight="bold" />{i18n.t("adminUi.manageTasks")}</Link></div>
      </header>
      <section className="mt-10 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card as="article" className="p-7 sm:p-9">
          <div className="flex items-center justify-between"><div><p className="page-kicker">{i18n.t("adminUi.queue")}</p><h2 className="display mt-2 text-3xl font-semibold">{i18n.t("adminUi.signalsToday")}</h2></div><WarningCircle className="size-8 text-[var(--signal)]" weight="duotone" /></div>
          <div className="mt-8 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
            {signals.map(([label, value]) => <Link href="/review" key={String(label)} className="group border-b border-[var(--line)] py-5"><p className="text-xs text-[var(--muted)]">{label}</p><div className="mt-2 flex items-end justify-between"><p className="display text-3xl font-semibold">{value}</p><ArrowRight className="mb-1 size-4 text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--signal)]" /></div></Link>)}
          </div>
        </Card>
        <Link href="/uploads" className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl flex min-h-64 flex-col justify-between p-7 sm:p-9">
          <CloudArrowUp className="size-9 text-[var(--signal)]" weight="duotone" />
          <div><p className="display text-5xl font-semibold">{(dashboard.summary.bytes24h / 1024 / 1024).toFixed(1)}</p><p className="mt-2 text-sm text-[var(--muted)]">MiB / {i18n.t("adminUi.last24Hours")}</p></div>
        </Link>
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Funnel title={i18n.t("adminUi.assignmentProgress")} items={dashboard.assignmentFunnel} machineId="assignment.status" i18n={i18n} />
        <Funnel title={i18n.t("adminUi.uploadProgress")} items={dashboard.uploadFunnel} machineId="upload_intent.transfer_status" i18n={i18n} />
      </section>
      <section className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl mt-4 p-6 sm:p-8">
        <div className="flex justify-between gap-4"><div><p className="page-kicker">{i18n.t("adminUi.readonlyActivity")}</p><h2 className="display mt-1 text-2xl font-semibold">{i18n.t("adminUi.recentAudit")}</h2></div><Link href="/audit" className={buttonVariants({ variant: "outline", className: "" })}>{i18n.t("adminUi.viewAll")} <ArrowRight className="size-4" /></Link></div>
        <div className="mt-6 divide-y divide-[var(--line)]">
          {dashboard.recentAudits.map((event) => <div key={event.id} className="grid gap-1 py-4 text-sm sm:grid-cols-[1fr_auto]"><p><b>{i18n.label("auditAction", event.action)}</b> · {event.entityPublicId || i18n.label("entity", event.entityType)}</p><time className="text-xs text-[var(--muted)]">{i18n.date(event.createdAt, { dateStyle: "medium", timeStyle: "short" })}</time></div>)}
          {dashboard.recentAudits.length === 0 ? <p className="py-8 text-sm text-[var(--muted)]">{i18n.t("adminUi.noAudit")}</p> : null}
        </div>
      </section>
    </main>
  );
}

function Funnel({ title, items, machineId, i18n }: { title: string; items: Array<{ status: string; count: number }>; machineId: string; i18n: Translator }) {
  const total = Math.max(1, items.reduce((sum, item) => sum + item.count, 0));
  return <Card as="article" className="p-6 sm:p-8"><h2 className="display text-2xl font-semibold">{title}</h2><div className="mt-6 space-y-4">{items.map((item) => { const label = i18n.state(machineId, item.status); return <div key={item.status}><div className="mb-2 flex justify-between text-xs"><span className="text-[var(--muted)]">{label}</span><b>{item.count}</b></div><Progress value={total > 0 ? Math.max(4, item.count / total * 100) : 0} aria-label={`${label} ${item.count}`} /></div>; })}</div></Card>;
}
