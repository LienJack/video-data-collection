import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AssignmentActions } from "@/app/admin/assignments/assignment-actions";
import { requireAdmin } from "@egocapture/core/server/auth";
import { assignmentListSchema, listAssignments } from "@egocapture/core/server/services/tasks";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const query = assignmentListSchema.parse({ search: typeof params.search === "string" && params.search ? params.search : undefined, studyPublicId: typeof params.studyPublicId === "string" && params.studyPublicId ? params.studyPublicId : undefined, status: typeof params.status === "string" && params.status ? params.status : undefined, cursor: typeof params.cursor === "string" && params.cursor ? params.cursor : undefined, limit: 25 });
  const result = await listAssignments(viewer, query);
  const next = new URLSearchParams({ ...(query.search ? { search: query.search } : {}), ...(query.status ? { status: query.status } : {}), ...(query.studyPublicId ? { studyPublicId: query.studyPublicId } : {}), ...(result.nextCursor ? { cursor: result.nextCursor } : {}) });
  return (
    <main className="app-page">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--line)] pb-7">
        <div><p className="page-kicker">Frozen task delivery</p><h1 className="page-title">Assignments</h1></div>
        <Link href="/admin/assignments/new" className="primary-action"><Plus className="size-4" weight="bold" />创建 Assignment</Link>
      </header>
      <form className="surface my-7 flex flex-wrap gap-3 p-3">
        <input name="search" defaultValue={query.search} placeholder="Assignment / Participant / Task" className="min-w-56 flex-1 border border-[var(--line)] bg-[var(--paper)] px-4 py-3" />
        <select name="status" defaultValue={query.status || ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><option value="">全部状态</option>{["assigned","acknowledged","session_created","uploading","submitted","needs_review","rework_required","accepted","expired","missing_upload","canceled"].map((status) => <option key={status} value={status}>{status}</option>)}</select>
        <button className="primary-action">筛选</button>
      </form>
      <div className="grid gap-4 xl:grid-cols-2">
        {result.items.map((assignment) => <article key={assignment.publicId} className="surface-solid p-6"><div className="flex flex-wrap justify-between gap-3"><p className="text-xs font-bold text-[var(--signal)]">{assignment.publicId}</p><div className="flex gap-2"><span className="status-pill">{assignment.status}</span>{assignment.isMissing ? <span className="status-pill">Missing</span> : null}</div></div><h2 className="display mt-4 text-2xl font-semibold">{assignment.taskTitle} · v{assignment.taskVersion}</h2><p className="mt-3 text-sm">{assignment.participantAlias} · {assignment.participantPublicId}</p><p className="mt-2 text-xs text-[var(--muted)]">Due {assignment.dueAt.toLocaleString("zh-CN")} · {assignment.studyPublicId}</p><AssignmentActions assignmentPublicId={assignment.publicId} status={assignment.status} /></article>)}
      </div>
      {result.items.length === 0 ? <p className="empty-state">尚无 Assignment。</p> : null}
      {result.nextCursor ? <Link href={`?${next.toString()}`} className="secondary-action mt-8">下一页 →</Link> : null}
    </main>
  );
}
