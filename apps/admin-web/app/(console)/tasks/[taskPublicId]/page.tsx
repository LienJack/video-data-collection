import { Badge } from "@egocapture/ui/components/badge";
import { Card } from "@egocapture/ui/components/card";
import { CaretLeft, CheckCircle, UsersThree, VideoCamera, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AddTaskParticipants } from "@/app/(console)/tasks/[taskPublicId]/add-task-participants";
import { TaskAuditPanel } from "@/app/(console)/tasks/[taskPublicId]/task-audit-panel";
import { TaskOverviewPanel } from "@/app/(console)/tasks/[taskPublicId]/task-overview-panel";
import { TaskParticipantsPanel } from "@/app/(console)/tasks/[taskPublicId]/task-participants-panel";
import { TaskUploadsPanel } from "@/app/(console)/tasks/[taskPublicId]/task-uploads-panel";
import { TaskEditor } from "@/app/(console)/tasks/task-editor";
import { requireAdmin } from "@/lib/auth";
import { getTask, getTaskOperations } from "@egocapture/core/server/services/tasks";

export const dynamic = "force-dynamic";

const tabLabels = {
  overview: "概览",
  participants: "参与者",
  uploads: "上传视频",
  instructions: "任务说明",
  audit: "操作记录",
} as const;

type Tab = keyof typeof tabLabels;

const statusLabels: Record<string, string> = {
  draft: "草稿",
  awaiting_participants: "待分配",
  running: "进行中",
  needs_attention: "需要处理",
  completed: "已完成",
  archived: "已归档",
};

export default async function TaskDetailPage({ params, searchParams }: { params: Promise<{ taskPublicId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const { taskPublicId } = await params;
  const search = await searchParams;
  const [task, operations] = await Promise.all([getTask(viewer, taskPublicId), getTaskOperations(viewer, taskPublicId)]);
  const requestedTab = typeof search.tab === "string" && search.tab in tabLabels ? search.tab as Tab : "overview";
  const activeTab: Tab = task.versions.length === 0 ? "instructions" : requestedTab;
  const serializedParticipants = operations.participants.map((participant) => ({ ...participant, dueAt: participant.dueAt.toISOString(), createdAt: participant.createdAt.toISOString(), canceledAt: participant.canceledAt?.toISOString() ?? null }));
  const serializedUploads = operations.uploads.map((upload) => ({ ...upload, createdAt: upload.createdAt.toISOString() }));
  const serializedAudits = operations.audits.map((audit) => ({ ...audit, createdAt: audit.createdAt.toISOString() }));
  const summary = operations.summary;

  return (
    <main className="app-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/tasks" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-white/70 hover:text-[var(--ink)]"><CaretLeft className="size-4" />采集任务</Link>
        <AddTaskParticipants taskPublicId={task.publicId} versions={task.versions} participants={operations.eligibleParticipants} />
      </div>

      <header className="mt-7">
        <div className="flex flex-wrap items-center gap-3"><p className="page-kicker">{task.publicId}</p>{task.isFixture ? <Badge variant="outline">演示数据</Badge> : null}<Badge variant={summary.operationalStatus === "needs_attention" ? "destructive" : summary.operationalStatus === "running" ? "default" : "secondary"}>{summary.operationalStatus === "needs_attention" ? <WarningCircle weight="fill" /> : summary.operationalStatus === "completed" ? <CheckCircle weight="fill" /> : null}{statusLabels[summary.operationalStatus] ?? summary.operationalStatus}</Badge></div>
        <h1 className="page-title max-w-5xl">{task.title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">一个任务对应一组参与者。每个人拥有独立进度、Session 和视频，人员调整不会改写历史。</p>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="任务汇总">
        <Link href={`?tab=participants`} className="rounded-2xl bg-white/82 p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl transition-transform active:scale-[0.98] sm:p-5"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-[var(--muted)]">参与者</p><UsersThree className="size-5 text-[var(--signal)]" weight="duotone" /></div><p className="mt-3 text-3xl font-semibold tracking-[-0.04em] tabular-nums">{summary.participantCount}</p></Link>
        <Link href={`?tab=participants`} className="rounded-2xl bg-white/82 p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl transition-transform active:scale-[0.98] sm:p-5"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-[var(--muted)]">已完成</p><CheckCircle className="size-5 text-[var(--signal)]" weight="duotone" /></div><p className="mt-3 text-3xl font-semibold tracking-[-0.04em] tabular-nums">{summary.completedCount}<span className="ml-1 text-base font-medium text-[var(--muted)]">/{summary.participantCount || "—"}</span></p></Link>
        <Link href={`?tab=uploads`} className="rounded-2xl bg-white/82 p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl transition-transform active:scale-[0.98] sm:p-5"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-[var(--muted)]">视频</p><VideoCamera className="size-5 text-[var(--signal)]" weight="duotone" /></div><p className="mt-3 text-3xl font-semibold tracking-[-0.04em] tabular-nums">{summary.videoCount}</p></Link>
        <Link href={`?tab=uploads`} className={`rounded-2xl p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl transition-transform active:scale-[0.98] sm:p-5 ${summary.attentionCount > 0 ? "bg-red-50/92" : "bg-white/82"}`}><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-[var(--muted)]">待处理</p><WarningCircle className={`size-5 ${summary.attentionCount > 0 ? "text-[var(--destructive)]" : "text-[var(--muted)]"}`} weight={summary.attentionCount > 0 ? "fill" : "duotone"} /></div><p className={`mt-3 text-3xl font-semibold tracking-[-0.04em] tabular-nums ${summary.attentionCount > 0 ? "text-[var(--destructive)]" : ""}`}>{summary.attentionCount}</p></Link>
      </section>

      <nav className="apple-toolbar mt-6 flex gap-1 overflow-x-auto p-1.5" aria-label="任务详情">
        {(Object.entries(tabLabels) as Array<[Tab, string]>).map(([tab, label]) => <Link key={tab} href={`?tab=${tab}`} aria-current={activeTab === tab ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center rounded-xl px-4 text-sm font-semibold transition-[background-color,color,box-shadow,transform] ${activeTab === tab ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}>{label}{tab === "participants" ? <span className="ml-2 rounded-full bg-[var(--paper-deep)] px-1.5 py-0.5 text-[10px] tabular-nums">{summary.participantCount}</span> : null}{tab === "uploads" && summary.attentionCount > 0 ? <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-[var(--destructive)] tabular-nums">{summary.attentionCount}</span> : null}</Link>)}
      </nav>

      <div className="mt-6">
        {activeTab === "overview" ? <TaskOverviewPanel summary={summary} participants={serializedParticipants} uploads={serializedUploads} audits={serializedAudits} /> : null}
        {activeTab === "participants" ? <TaskParticipantsPanel participants={serializedParticipants} versions={task.versions} candidates={operations.eligibleParticipants} /> : null}
        {activeTab === "uploads" ? <TaskUploadsPanel uploads={serializedUploads} /> : null}
        {activeTab === "audit" ? <TaskAuditPanel audits={serializedAudits} /> : null}
        {activeTab === "instructions" ? <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]"><TaskEditor mode="edit" taskPublicId={task.publicId} initialInstructions={task.draftInstructions} initialUpdatedAt={task.updatedAt.toISOString()} /><aside className="mt-8 h-fit rounded-[1.35rem] bg-white/82 p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl"><h2 className="text-lg font-semibold tracking-[-0.02em]">已发布版本</h2><div className="mt-4 space-y-3">{task.versions.map((version) => <Card as="article" key={version.version} className="gap-2 border-0 bg-[var(--paper)] p-4 shadow-none"><div className="flex items-center justify-between gap-3"><p className="font-semibold">版本 {version.version}</p><Badge variant="outline">冻结</Badge></div><p className="break-all font-mono text-[10px] text-[var(--muted)]">{version.contentHash}</p><p className="text-xs text-[var(--muted)]">{version.publishedAt.toLocaleString("zh-CN")}</p></Card>)}{task.versions.length === 0 ? <p className="text-sm leading-6 text-[var(--muted)]">发布第一个版本后，才能添加参与者。</p> : null}</div></aside></div> : null}
      </div>
    </main>
  );
}
