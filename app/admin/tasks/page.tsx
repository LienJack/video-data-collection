import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/src/server/auth";
import { listTasks, taskListSchema } from "@/src/server/services/tasks";

export const dynamic = "force-dynamic";

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const query = taskListSchema.parse({
    search: typeof params.search === "string" && params.search ? params.search : undefined,
    lifecycle: typeof params.lifecycle === "string" && params.lifecycle ? params.lifecycle : undefined,
    cursor: typeof params.cursor === "string" && params.cursor ? params.cursor : undefined,
    limit: 25,
  });
  const result = await listTasks(viewer, query);
  return (
    <main className="px-5 py-8 sm:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--line)] pb-7">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--teal)]">Immutable instruction snapshots</p><h1 className="display mt-2 text-5xl font-semibold">Tasks</h1></div>
        <Link href="/admin/tasks/new" className="inline-flex items-center gap-2 bg-[var(--signal)] px-5 py-3 font-bold text-white"><Plus className="h-4 w-4" />创建 Task</Link>
      </header>
      <form className="my-7 flex flex-wrap gap-3 border border-[var(--line)] bg-white/30 p-3">
        <input name="search" defaultValue={query.search} placeholder="Public ID 或标题" className="min-w-64 flex-1 border border-[var(--line)] bg-[var(--paper)] px-4 py-3" />
        <select name="lifecycle" defaultValue={query.lifecycle || ""} className="border border-[var(--line)] bg-[var(--paper)] px-4"><option value="">全部生命周期</option><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select>
        <button className="bg-[var(--ink)] px-5 py-3 font-bold text-[var(--paper)]">筛选</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {result.items.map((task) => <Link key={task.publicId} href={`/admin/tasks/${task.publicId}`} className="border border-[var(--line)] bg-white/35 p-6 hover:border-[var(--signal)]"><div className="flex justify-between gap-4"><p className="text-xs font-bold text-[var(--signal)]">{task.publicId}{task.isFixture ? " · Demo Fixture" : ""}</p><span className="text-xs font-bold uppercase">{task.lifecycle}</span></div><h2 className="display mt-4 text-3xl font-semibold">{task.title}</h2><p className="mt-5 text-sm text-[var(--muted)]">{task.studyName} · {task.latestVersion ? `Published v${task.latestVersion}` : "尚未发布"}</p></Link>)}
      </div>
      {result.items.length === 0 ? <p className="py-12 text-center text-sm text-[var(--muted)]">尚无 Task。</p> : null}
    </main>
  );
}
