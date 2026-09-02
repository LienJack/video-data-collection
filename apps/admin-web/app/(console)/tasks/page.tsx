import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { ArrowRight, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { TablePagination } from "@/app/_components/table-pagination";
import { requireAdmin } from "@/lib/auth";
import { parsePageParam, parsePageSizeParam } from "@/lib/pagination";
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
    page: parsePageParam(params.page),
    pageSize: parsePageSizeParam(params.pageSize),
  });
  const result = await listTasks(viewer, query);

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
        <input type="hidden" name="pageSize" value={query.pageSize} />
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
        <Table className="min-w-[72rem]">
          <TableHeader><TableRow><TableHead className="px-6">任务</TableHead><TableHead>状态</TableHead><TableHead>参与者</TableHead><TableHead>完成</TableHead><TableHead>视频</TableHead><TableHead>待处理</TableHead><TableHead>最近截止</TableHead><TableHead className="pr-6 text-right">操作</TableHead></TableRow></TableHeader>
          <TableBody>
          {result.items.map((task) => (
            <TableRow key={task.publicId}>
              <TableCell className="max-w-sm whitespace-normal px-6 py-4">
                <Link href={`/tasks/${task.publicId}`} className="text-base font-semibold tracking-[-0.01em] underline decoration-[var(--signal)] underline-offset-4">{task.title}</Link>
                <p className="mt-1 text-xs font-medium text-[var(--muted)]">{task.publicId}{task.latestVersion ? ` · 版本 ${task.latestVersion}` : " · 尚未发布"}</p>
              </TableCell>
              <TableCell><Badge variant={statusVariants[task.operationalStatus] ?? "outline"}>{statusLabels[task.operationalStatus] ?? task.operationalStatus}</Badge></TableCell>
              <TableCell className="tabular-nums">{task.participantCount}</TableCell>
              <TableCell className="tabular-nums">{task.completedCount}/{task.participantCount || "—"}</TableCell>
              <TableCell className="tabular-nums">{task.videoCount}</TableCell>
              <TableCell className={`tabular-nums ${task.attentionCount > 0 ? "font-semibold text-[var(--destructive)]" : "text-[var(--muted)]"}`}>{task.attentionCount}</TableCell>
              <TableCell className="text-xs text-[var(--muted)]">{task.nextDueAt ? task.nextDueAt.toLocaleDateString("zh-CN") : "—"}</TableCell>
              <TableCell className="pr-6 text-right"><Link href={`/tasks/${task.publicId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>查看<ArrowRight aria-hidden="true" /></Link></TableCell>
            </TableRow>
          ))}
          </TableBody>
        </Table>
      </section>

      {result.items.length === 0 ? <Empty className="mt-8"><EmptyDescription>没有符合条件的采集任务。清除筛选，或创建第一个任务。</EmptyDescription></Empty> : null}
      <div className="mt-6"><TablePagination pathname="/tasks" query={query} pagination={result} /></div>
    </main>
  );
}
