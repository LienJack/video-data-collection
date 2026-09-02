import { Badge } from "@egocapture/ui/components/badge";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Input } from "@egocapture/ui/components/input";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { requireAdmin } from "@/lib/auth";
import { listTasks, taskListSchema } from "@egocapture/core/server/services/tasks";

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
  const next = new URLSearchParams({ ...(query.search ? { search: query.search } : {}), ...(query.lifecycle ? { lifecycle: query.lifecycle } : {}), ...(result.nextCursor ? { cursor: result.nextCursor } : {}) });
  return (
    <main className="app-page">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--line)] pb-7">
        <div><p className="page-kicker">Immutable instruction snapshots</p><h1 className="page-title">Tasks</h1></div>
        <Link href="/tasks/new" className={buttonVariants({ className: "" })}><Plus className="size-4" weight="bold" />创建 Task</Link>
      </header>
      <form className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl my-7 flex flex-wrap gap-3 p-3">
        <Input name="search" defaultValue={query.search} placeholder="Public ID 或标题" className="min-w-64 flex-1 border border-[var(--line)] bg-[var(--paper)] px-4 py-3" />
        <NativeSelect name="lifecycle" defaultValue={query.lifecycle || ""} className="border border-[var(--line)] bg-[var(--paper)] px-4"><NativeSelectOption value="">全部生命周期</NativeSelectOption><NativeSelectOption value="draft">Draft</NativeSelectOption><NativeSelectOption value="active">Active</NativeSelectOption><NativeSelectOption value="archived">Archived</NativeSelectOption></NativeSelect>
        <Button>筛选</Button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {result.items.map((task) => <Link key={task.publicId} href={`/tasks/${task.publicId}`} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 transition hover:-translate-y-1 hover:border-[var(--signal)] hover:shadow-[var(--shadow)]"><div className="flex justify-between gap-4"><p className="text-xs font-bold text-[var(--signal)]">{task.publicId}{task.isFixture ? " · Demo Fixture" : ""}</p><Badge>{task.lifecycle}</Badge></div><h2 className="display mt-4 text-3xl font-semibold">{task.title}</h2><p className="mt-5 text-sm text-[var(--muted)]">{task.latestVersion ? `Published v${task.latestVersion}` : "尚未发布"}</p></Link>)}
      </div>
      {result.items.length === 0 ? <Empty><EmptyDescription>尚无 Task。</EmptyDescription></Empty> : null}
      {result.nextCursor ? <Link href={`?${next.toString()}`} className="mt-8 inline-block font-bold text-[var(--teal)]">下一页 →</Link> : null}
    </main>
  );
}
