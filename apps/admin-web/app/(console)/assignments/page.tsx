import { Badge } from "@egocapture/ui/components/badge";
import { Card } from "@egocapture/ui/components/card";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Input } from "@egocapture/ui/components/input";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AssignmentActions } from "@/app/(console)/assignments/assignment-actions";
import { requireAdmin } from "@/lib/auth";
import { assignmentListSchema, listAssignments } from "@egocapture/core/server/services/tasks";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const query = assignmentListSchema.parse({ search: typeof params.search === "string" && params.search ? params.search : undefined, status: typeof params.status === "string" && params.status ? params.status : undefined, cursor: typeof params.cursor === "string" && params.cursor ? params.cursor : undefined, limit: 25 });
  const result = await listAssignments(viewer, query);
  const next = new URLSearchParams({ ...(query.search ? { search: query.search } : {}), ...(query.status ? { status: query.status } : {}), ...(result.nextCursor ? { cursor: result.nextCursor } : {}) });
  return (
    <main className="app-page">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--line)] pb-7">
        <div><p className="page-kicker">Frozen task delivery</p><h1 className="page-title">Assignments</h1></div>
        <Link href="/assignments/new" className={buttonVariants({ className: "" })}><Plus className="size-4" weight="bold" />创建 Assignment</Link>
      </header>
      <form className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl my-7 flex flex-wrap gap-3 p-3">
        <Input name="search" defaultValue={query.search} placeholder="Assignment / Participant / Task" className="min-w-56 flex-1 border border-[var(--line)] bg-[var(--paper)] px-4 py-3" />
        <NativeSelect name="status" defaultValue={query.status || ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><NativeSelectOption value="">全部状态</NativeSelectOption>{["assigned","acknowledged","session_created","uploading","submitted","needs_review","rework_required","accepted","expired","missing_upload","canceled"].map((status) => <NativeSelectOption key={status} value={status}>{status}</NativeSelectOption>)}</NativeSelect>
        <Button>筛选</Button>
      </form>
      <div className="grid gap-4 xl:grid-cols-2">
        {result.items.map((assignment) => <Card as="article" key={assignment.publicId} className="p-6"><div className="flex flex-wrap justify-between gap-3"><p className="text-xs font-bold text-[var(--signal)]">{assignment.publicId}</p><div className="flex gap-2"><Badge>{assignment.status}</Badge>{assignment.isMissing ? <Badge>Missing</Badge> : null}</div></div><h2 className="display mt-4 text-2xl font-semibold">{assignment.taskTitle} · v{assignment.taskVersion}</h2><p className="mt-3 text-sm">{assignment.participantAlias} · {assignment.participantPublicId}</p><p className="mt-2 text-xs text-[var(--muted)]">Due {assignment.dueAt.toLocaleString("zh-CN")}</p><AssignmentActions assignmentPublicId={assignment.publicId} status={assignment.status} /></Card>)}
      </div>
      {result.items.length === 0 ? <Empty><EmptyDescription>尚无 Assignment。</EmptyDescription></Empty> : null}
      {result.nextCursor ? <Link href={`?${next.toString()}`} className={buttonVariants({ variant: "outline", className: " mt-8" })}>下一页 →</Link> : null}
    </main>
  );
}
