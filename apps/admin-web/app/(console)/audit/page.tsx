import { buttonVariants } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { auditListSchema, listAuditEvents } from "@egocapture/core/server/services/review";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const query = auditListSchema.parse({ cursor: typeof params.cursor === "string" && params.cursor ? params.cursor : undefined, limit: 50 });
  const result = await listAuditEvents(viewer, query);
  return (
    <main className="app-page">
      <header className="border-b border-[var(--line)] pb-7"><p className="page-kicker">Append-only evidence</p><h1 className="page-title">Audit Events</h1></header>
      <div className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl mt-8 divide-y divide-[var(--line)] px-5 sm:px-7">
        {result.items.map((event) => <Card as="article" key={event.id} className="py-5"><div className="flex flex-wrap justify-between gap-3"><p className="font-bold">{event.action}</p><time className="text-xs text-[var(--muted)]">{event.createdAt.toLocaleString("zh-CN")}</time></div><p className="mt-2 text-sm">{event.entityType} · {event.entityPublicId || "—"} · {event.actorDisplayName || "system"}</p><p className="mt-2 text-xs text-[var(--muted)]">request {event.requestId} · reason {event.reason || "—"}</p>{event.beforeValues || event.afterValues ? <details className="mt-3 text-xs"><summary className="cursor-pointer font-bold text-[var(--teal)]">Before / After</summary><pre className="mt-2 overflow-auto rounded-2xl bg-[var(--ink)] p-4 text-[var(--paper)]">{JSON.stringify({ before: event.beforeValues, after: event.afterValues }, null, 2)}</pre></details> : null}</Card>)}
        {result.items.length === 0 ? <p className="py-10 text-center text-sm text-[var(--muted)]">目前没有 Audit Event。</p> : null}
      </div>
      {result.nextCursor ? <Link href={`?cursor=${encodeURIComponent(result.nextCursor)}`} className={buttonVariants({ variant: "outline", className: " mt-8" })}>下一页 →</Link> : null}
    </main>
  );
}
