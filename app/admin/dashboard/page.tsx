import { ArrowRight, CloudArrowUp, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { requireAdmin } from "@/src/server/auth";
import { dashboardSummary } from "@/src/server/services/review";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const viewer = await requireAdmin();
  const dashboard = await dashboardSummary(viewer);
  const signals = [
    ["Missing", dashboard.summary.missing], ["Upload Failed", dashboard.summary.uploadFailed],
    ["Metadata Failed", dashboard.summary.metadataFailed], ["Unmatched", dashboard.summary.unmatched],
    ["Device Mismatch", dashboard.summary.deviceMismatch], ["Needs Review", dashboard.summary.needsReview],
  ];
  return (
    <main className="app-page">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div><p className="page-kicker">Admin control room</p><h1 className="page-title">采集控制台</h1></div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]"><span className="size-2 rounded-full bg-[var(--signal)]" />{viewer.displayName}</div>
      </header>
      <section className="mt-10 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="surface-solid p-7 sm:p-9">
          <div className="flex items-center justify-between"><div><p className="page-kicker">Attention queue</p><h2 className="display mt-2 text-3xl font-semibold">今天需要处理的信号</h2></div><WarningCircle className="size-8 text-[var(--signal)]" weight="duotone" /></div>
          <div className="mt-8 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
            {signals.map(([label, value]) => <Link href="/admin/review" key={String(label)} className="group border-b border-[var(--line)] py-5"><p className="text-xs text-[var(--muted)]">{label}</p><div className="mt-2 flex items-end justify-between"><p className="display text-3xl font-semibold">{value}</p><ArrowRight className="mb-1 size-4 text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--signal)]" /></div></Link>)}
          </div>
        </article>
        <Link href="/admin/uploads" className="surface flex min-h-64 flex-col justify-between p-7 sm:p-9">
          <CloudArrowUp className="size-9 text-[var(--signal)]" weight="duotone" />
          <div><p className="display text-5xl font-semibold">{(dashboard.summary.bytes24h / 1024 / 1024).toFixed(1)}</p><p className="mt-2 text-sm text-[var(--muted)]">MiB / 最近 24 小时</p></div>
        </Link>
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Funnel title="Assignment funnel" items={dashboard.assignmentFunnel} />
        <Funnel title="Upload funnel" items={dashboard.uploadFunnel} />
      </section>
      <section className="surface mt-4 p-6 sm:p-8">
        <div className="flex justify-between gap-4"><div><p className="page-kicker">Append-only</p><h2 className="display mt-1 text-2xl font-semibold">最近审计</h2></div><Link href="/admin/audit" className="secondary-action">查看全部 <ArrowRight className="size-4" /></Link></div>
        <div className="mt-6 divide-y divide-[var(--line)]">
          {dashboard.recentAudits.map((event) => <div key={event.id} className="grid gap-1 py-4 text-sm sm:grid-cols-[1fr_auto]"><p><b>{event.action}</b> · {event.entityPublicId || event.entityType}</p><time className="text-xs text-[var(--muted)]">{event.createdAt.toLocaleString("zh-CN")}</time></div>)}
          {dashboard.recentAudits.length === 0 ? <p className="py-8 text-sm text-[var(--muted)]">目前没有审计事件。</p> : null}
        </div>
      </section>
    </main>
  );
}

function Funnel({ title, items }: { title: string; items: Array<{ status: string; count: number }> }) {
  const total = Math.max(1, items.reduce((sum, item) => sum + item.count, 0));
  return <article className="surface p-6 sm:p-8"><h2 className="display text-2xl font-semibold">{title}</h2><div className="mt-6 space-y-4">{items.map((item) => <div key={item.status}><div className="mb-2 flex justify-between text-xs"><span className="text-[var(--muted)]">{item.status}</span><b>{item.count}</b></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--paper-deep)]"><div className="h-full rounded-full bg-[var(--signal)]" style={{ width: `${Math.max(4, item.count / total * 100)}%` }} /></div></div>)}</div></article>;
}
