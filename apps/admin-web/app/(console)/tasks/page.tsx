import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { ArrowRight, Clock, Plus, UsersThree, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listTasks, taskListSchema } from "@egocapture/core/server/services/tasks";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "草稿",
  awaiting_participants: "待分配",
  running: "进行中",
  needs_attention: "需要处理",
  completed: "已完成",
  archived: "已归档",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  awaiting_participants: "outline",
  running: "default",
  needs_attention: "destructive",
  completed: "secondary",
  archived: "outline",
};

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
      <header className="flex flex-wrap items-end justify-between gap-6 pb-7">
        <div>
          <p className="page-kicker">采集进度与人员协作</p>
          <h1 className="page-title">采集任务</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">从任务进入参与者、录制进度和上传视频。运行中的任务至少保留一名参与者。</p>
        </div>
        <Link href="/tasks/new" className={buttonVariants({ size: "lg", className: "shadow-[0_10px_30px_rgb(57_117_173_/_20%)]" })}><Plus className="size-4" weight="bold" />创建任务</Link>
      </header>

      <form className="apple-toolbar my-5 flex flex-wrap gap-3 p-2.5" aria-label="筛选采集任务">
        <Input aria-label="搜索任务" name="search" defaultValue={query.search} placeholder="搜索任务名称或编号" className="min-w-64 flex-1 border-0 bg-white/70 px-4 py-3 shadow-inner" />
        <NativeSelect aria-label="任务生命周期" name="lifecycle" defaultValue={query.lifecycle || ""} className="border-0 bg-white/70 px-4 shadow-inner">
          <NativeSelectOption value="">全部任务</NativeSelectOption>
          <NativeSelectOption value="draft">草稿</NativeSelectOption>
          <NativeSelectOption value="active">已发布</NativeSelectOption>
          <NativeSelectOption value="archived">已归档</NativeSelectOption>
        </NativeSelect>
        <Button variant="secondary">筛选</Button>
      </form>

      <section className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/78 shadow-[var(--shadow-soft)] backdrop-blur-xl" aria-label="任务列表">
        <div className="hidden grid-cols-[minmax(15rem,1fr)_7rem_7rem_7rem_7rem_7rem_10rem_2rem] gap-4 border-b border-[var(--line)] px-6 py-3 text-xs font-semibold text-[var(--muted)] lg:grid">
          <span>任务</span><span>状态</span><span>参与者</span><span>完成</span><span>视频</span><span>待处理</span><span>最近截止</span><span aria-hidden="true" />
        </div>
        <div className="divide-y divide-[var(--line)]">
          {result.items.map((task) => (
            <Link key={task.publicId} href={`/tasks/${task.publicId}`} className="group grid gap-5 px-5 py-5 transition-[background-color,transform] hover:bg-white active:bg-[var(--teal-soft)] lg:grid-cols-[minmax(15rem,1fr)_7rem_7rem_7rem_7rem_7rem_10rem_2rem] lg:items-center lg:px-6">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-[-0.01em]">{task.title}</p>
                <p className="mt-1 text-xs font-medium text-[var(--muted)]">{task.publicId}{task.latestVersion ? ` · 版本 ${task.latestVersion}` : " · 尚未发布"}</p>
              </div>
              <div><Badge variant={statusVariants[task.operationalStatus] ?? "outline"}>{statusLabels[task.operationalStatus] ?? task.operationalStatus}</Badge></div>
              <div className="grid grid-cols-4 gap-3 lg:contents">
                <p className="flex items-center gap-1.5 text-sm tabular-nums"><UsersThree className="size-4 text-[var(--muted)] lg:hidden" />{task.participantCount}</p>
                <p className="text-sm tabular-nums"><span className="text-[var(--muted)] lg:hidden">完成 </span>{task.completedCount}/{task.participantCount || "—"}</p>
                <p className="flex items-center gap-1.5 text-sm tabular-nums"><VideoCamera className="size-4 text-[var(--muted)] lg:hidden" />{task.videoCount}</p>
                <p className={`text-sm tabular-nums ${task.attentionCount > 0 ? "font-semibold text-[var(--destructive)]" : "text-[var(--muted)]"}`}><span className="lg:hidden">待处理 </span>{task.attentionCount}</p>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]"><Clock className="size-4 lg:hidden" />{task.nextDueAt ? task.nextDueAt.toLocaleDateString("zh-CN") : "—"}</p>
              <ArrowRight aria-hidden="true" className="hidden size-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 lg:block" />
            </Link>
          ))}
        </div>
      </section>

      {result.items.length === 0 ? <Empty className="mt-8"><EmptyDescription>没有符合条件的采集任务。清除筛选，或创建第一个任务。</EmptyDescription></Empty> : null}
      {result.nextCursor ? <Link href={`?${next.toString()}`} className="mt-8 inline-flex min-h-11 items-center font-semibold text-[var(--signal-dark)]">查看下一页 →</Link> : null}
    </main>
  );
}
