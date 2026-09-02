import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { ArrowRight, CheckCircle, ClockCounterClockwise, MagnifyingGlass, Radio, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { listAdminSessions } from "@egocapture/core/server/services/sessions";
import { SessionClose } from "@/app/(console)/sessions/session-close";
import { formatRecordDate, sessionStatusLabel } from "@/lib/record-presenters";
import { recordsHref, type SessionRecordsQuery } from "@/lib/records-query";

type SessionRecordsResult = Awaited<ReturnType<typeof listAdminSessions>>;

export function SessionRecordsPanel({ query, result }: { query: SessionRecordsQuery; result: SessionRecordsResult }) {
  const hasCustomFilters = Boolean(query.search || query.status !== "open");
  return (
    <section aria-labelledby="session-records-heading" className="space-y-5">
      <div><h2 id="session-records-heading" className="display text-2xl font-semibold">录制会话</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">默认聚焦未关闭会话；全部历史和已关闭会话仍可搜索，便于追溯数小时或数天后到达的视频。</p></div>
      <form className="apple-toolbar grid gap-3 p-3 sm:grid-cols-[minmax(15rem,1fr)_minmax(10rem,auto)_auto]" action="/records">
        <input type="hidden" name="tab" value="sessions" />
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>搜索录制会话</span><span className="relative block"><MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" /><Input name="search" defaultValue={query.search} placeholder="Session、参与者、任务或分配" className="pl-10" /></span></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>会话状态</span><NativeSelect name="status" defaultValue={query.status} className="w-full"><NativeSelectOption value="open">未关闭</NativeSelectOption><NativeSelectOption value="closed">已关闭</NativeSelectOption><NativeSelectOption value="all">全部历史</NativeSelectOption></NativeSelect></label>
        <div className="flex items-end gap-2"><Button className="flex-1">筛选</Button>{hasCustomFilters ? <Link href="/records?tab=sessions" className={buttonVariants({ variant: "outline", className: "flex-1" })}>清除筛选</Link> : null}</div>
      </form>
      <div className="grid gap-4 xl:grid-cols-2">
        {result.items.map((session) => (
          <Card as="article" key={session.publicId} className="gap-5 rounded-[1.35rem] border-white/70 bg-white/80 p-5 shadow-[var(--shadow-soft)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--teal-soft)] text-[var(--signal-dark)]" aria-hidden="true"><Radio className="size-5" weight="duotone" /></span><div className="min-w-0"><h3 className="break-all text-sm font-semibold">{session.publicId}</h3><p className="mt-1 text-xs text-[var(--muted)]">创建于 {formatRecordDate(session.createdAt)}</p></div></div><Badge variant={session.status === "open" ? "default" : "secondary"}>{session.status === "closed" ? <CheckCircle weight="fill" /> : <ClockCounterClockwise weight="duotone" />}{sessionStatusLabel(session.status)}</Badge></div>
            <div className="grid gap-3 rounded-2xl bg-[var(--paper)] p-4 text-sm min-[28rem]:grid-cols-2">
              <div><p className="text-xs font-semibold text-[var(--muted)]">参与者</p><Link href={`/participants/${session.participantPublicId}`} className="mt-1 block break-words font-semibold underline decoration-[var(--signal)] underline-offset-4">{session.participantAlias}</Link><p className="mt-1 break-all text-xs text-[var(--muted)]">{session.participantPublicId}</p></div>
              <div><p className="text-xs font-semibold text-[var(--muted)]">采集任务</p><Link href={`/tasks/${session.taskPublicId}`} className="mt-1 block break-words font-semibold underline decoration-[var(--signal)] underline-offset-4">{session.taskTitle}</Link><p className="mt-1 break-all text-xs text-[var(--muted)]">{session.taskPublicId} · {session.assignmentPublicId}</p></div>
              <div><p className="text-xs font-semibold text-[var(--muted)]">采集设备</p><p className="mt-1 font-semibold">{session.deviceLabel}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{session.devicePublicId}</p></div>
              <div><p className="text-xs font-semibold text-[var(--muted)]">录制标记</p><p className="mt-1 font-semibold">{session.markerAcknowledgedAt ? "已确认" : "待确认"}</p><p className="mt-1 text-xs text-[var(--muted)]">匹配视频 {session.matchedVideoCount} 个</p></div>
            </div>
            {session.closedAt ? <p className="text-xs text-[var(--muted)]">关闭于 {formatRecordDate(session.closedAt)}</p> : null}
            <div className="flex flex-col gap-2 min-[28rem]:flex-row"><Link href={`/records?tab=videos&search=${encodeURIComponent(session.publicId)}`} className={buttonVariants({ variant: "outline", className: "flex-1" })}><VideoCamera className="size-4" />查看相关视频<ArrowRight className="size-4" /></Link>{session.status === "open" ? <div className="flex-1"><SessionClose sessionPublicId={session.publicId} /></div> : null}</div>
          </Card>
        ))}
      </div>
      {result.items.length === 0 ? <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/60 px-5 py-12 text-center shadow-sm"><Radio className="mx-auto size-10 text-[var(--signal)]" weight="duotone" aria-hidden="true" /><h3 className="mt-4 font-semibold">{hasCustomFilters ? "当前筛选没有录制会话" : "当前没有未关闭会话"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{hasCustomFilters ? "调整条件，或回到默认的未关闭会话列表。" : "可以查看全部历史，追溯已关闭会话和晚到的视频。"}</p><Link href={hasCustomFilters ? "/records?tab=sessions" : "/records?tab=sessions&status=all"} className={buttonVariants({ variant: "outline", className: "mt-5" })}>{hasCustomFilters ? "清除筛选" : "查看全部历史"}</Link></div> : null}
      {result.nextCursor ? <Link href={recordsHref(query, result.nextCursor)} className={buttonVariants({ variant: "outline" })}>下一页<ArrowRight className="size-4" /></Link> : null}
    </section>
  );
}
