import { Badge } from "@egocapture/ui/components/badge";
import { Card } from "@egocapture/ui/components/card";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Input } from "@egocapture/ui/components/input";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import Link from "next/link";
import { SessionClose } from "@/app/(console)/sessions/session-close";
import { requireAdmin } from "@/lib/auth";
import { adminSessionListSchema, listAdminSessions } from "@egocapture/core/server/services/sessions";

export const dynamic = "force-dynamic";

export default async function AdminSessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const query = adminSessionListSchema.parse({ search: typeof params.search === "string" && params.search ? params.search : undefined, status: typeof params.status === "string" && params.status ? params.status : undefined, cursor: typeof params.cursor === "string" && params.cursor ? params.cursor : undefined, limit: 50 });
  const result = await listAdminSessions(viewer, query);
  const next = new URLSearchParams({ ...(query.search ? { search: query.search } : {}), ...(query.status ? { status: query.status } : {}), ...(result.nextCursor ? { cursor: result.nextCursor } : {}) });
  return (
    <main className="app-page">
      <header className="border-b border-[var(--line)] pb-7"><p className="page-kicker">Declared recording context</p><h1 className="page-title">Recording Sessions</h1></header>
      <form className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl my-7 flex flex-wrap gap-3 p-3"><Input name="search" defaultValue={query.search} placeholder="Session / Assignment / Participant / Task" className="min-w-64 flex-1 border border-[var(--line)] bg-[var(--paper)] px-3 py-3" /><NativeSelect name="status" aria-label="Session Status" defaultValue={query.status ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><NativeSelectOption value="">全部状态</NativeSelectOption><NativeSelectOption value="open">open</NativeSelectOption><NativeSelectOption value="closed">closed</NativeSelectOption></NativeSelect><Button>筛选</Button></form>
      <div className="grid gap-4 xl:grid-cols-2">
        {result.items.map((session) => <Card as="article" key={session.publicId} className="p-6"><div className="flex justify-between gap-4"><p className="text-xs font-bold text-[var(--signal)]">{session.publicId}</p><Badge>{session.status}</Badge></div><h2 className="display mt-4 text-2xl font-semibold">{session.taskTitle}</h2><p className="mt-3 text-sm">{session.participantAlias} · {session.participantPublicId}</p><p className="mt-2 text-xs text-[var(--muted)]">{session.deviceLabel} · {session.devicePublicId}</p><p className="mt-2 text-xs text-[var(--muted)]">Marker {session.markerAcknowledgedAt ? "已确认" : "待确认"} · {session.createdAt.toLocaleString("zh-CN")}</p>{session.status === "open" ? <SessionClose sessionPublicId={session.publicId} /> : null}</Card>)}
        {result.items.length === 0 ? <Empty><EmptyDescription>尚无 Recording Session。</EmptyDescription></Empty> : null}
      </div>
      {result.nextCursor ? <Link href={`?${next.toString()}`} className={buttonVariants({ variant: "outline", className: " mt-8" })}>下一页 →</Link> : null}
    </main>
  );
}
