import Link from "next/link";
import { requireAdmin } from "@/src/server/auth";
import { dashboardSummary } from "@/src/server/services/review";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const viewer = await requireAdmin();
  const dashboard = await dashboardSummary(viewer);
  return (
    <main className="min-h-screen px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-6 border-b border-[var(--line)] pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--teal)]">Admin control room</p>
          <h1 className="display mt-2 text-4xl font-semibold">采集控制台</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">{viewer.displayName}</p>
      </header>
      <section className="grid gap-4 py-10 sm:grid-cols-2 xl:grid-cols-4">{[["Missing",dashboard.summary.missing],["Upload Failed",dashboard.summary.uploadFailed],["Metadata Failed",dashboard.summary.metadataFailed],["Unmatched",dashboard.summary.unmatched],["Device Mismatch",dashboard.summary.deviceMismatch],["Needs Review",dashboard.summary.needsReview],["24h Upload",`${(dashboard.summary.bytes24h / 1024 / 1024).toFixed(1)} MiB`]].map(([label,value]) => <Link href={label === "24h Upload" ? "/admin/uploads" : "/admin/review"} key={String(label)} className="border border-[var(--line)] bg-white/35 p-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{String(label)}</p><p className="display mt-4 text-3xl font-semibold">{String(value)}</p></Link>)}</section><section className="grid gap-8 pb-10 xl:grid-cols-2"><article><h2 className="display text-2xl font-semibold">Assignment funnel</h2><div className="mt-4 flex flex-wrap gap-2">{dashboard.assignmentFunnel.map((item) => <span key={item.status} className="border border-[var(--line)] bg-white/35 px-3 py-2 text-sm">{item.status} <b>{item.count}</b></span>)}</div></article><article><h2 className="display text-2xl font-semibold">Upload funnel</h2><div className="mt-4 flex flex-wrap gap-2">{dashboard.uploadFunnel.map((item) => <span key={item.status} className="border border-[var(--line)] bg-white/35 px-3 py-2 text-sm">{item.status} <b>{item.count}</b></span>)}</div></article></section><section className="border-t border-[var(--line)] py-8"><div className="flex justify-between gap-4"><h2 className="display text-2xl font-semibold">Recent Audit</h2><Link href="/admin/audit" className="font-bold text-[var(--teal)]">全部 →</Link></div><div className="mt-4 space-y-2">{dashboard.recentAudits.map((event) => <p key={event.id} className="border border-[var(--line)] bg-white/35 px-4 py-3 text-sm"><b>{event.action}</b> · {event.entityPublicId || event.entityType} · <span className="text-[var(--muted)]">{event.createdAt.toLocaleString("zh-CN")}</span></p>)}</div></section>
    </main>
  );
}
