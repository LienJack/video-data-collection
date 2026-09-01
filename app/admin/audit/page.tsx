import { requireAdmin } from "@/src/server/auth";
import { listAuditEvents } from "@/src/server/services/review";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const viewer = await requireAdmin();
  const events = await listAuditEvents(viewer);
  return <main className="px-5 py-8 sm:px-10"><header className="border-b border-[var(--line)] pb-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--teal)]">Append-only evidence</p><h1 className="display mt-2 text-5xl font-semibold">Audit Events</h1></header><div className="mt-8 space-y-3">{events.map((event) => <article key={event.id} className="border border-[var(--line)] bg-white/35 p-5"><div className="flex flex-wrap justify-between gap-3"><p className="font-bold">{event.action}</p><time className="text-xs text-[var(--muted)]">{event.createdAt.toLocaleString("zh-CN")}</time></div><p className="mt-2 text-sm">{event.entityType} · {event.entityPublicId || "—"} · {event.actorDisplayName || "system"}</p><p className="mt-2 text-xs text-[var(--muted)]">request {event.requestId} · reason {event.reason || "—"}</p>{event.beforeValues || event.afterValues ? <details className="mt-3 text-xs"><summary className="cursor-pointer font-bold text-[var(--teal)]">Before / After</summary><pre className="mt-2 overflow-auto border border-[var(--line)] bg-[var(--ink)] p-3 text-[var(--paper)]">{JSON.stringify({ before: event.beforeValues, after: event.afterValues }, null, 2)}</pre></details> : null}</article>)}</div></main>;
}
