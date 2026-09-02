import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { ArrowRight, CheckCircle, ClockCounterClockwise, MagnifyingGlass, Radio, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { listAdminSessions } from "@egocapture/core/server/services/sessions";
import { SessionClose } from "@/app/(console)/sessions/session-close";
import { TablePagination } from "@/app/_components/table-pagination";
import { formatRecordDate, sessionStatusLabel } from "@/lib/record-presenters";
import type { SessionRecordsQuery } from "@/lib/records-query";

type SessionRecordsResult = Awaited<ReturnType<typeof listAdminSessions>>;

export function SessionRecordsPanel({ query, result }: { query: SessionRecordsQuery; result: SessionRecordsResult }) {
  const hasCustomFilters = Boolean(query.search || query.status !== "open");
  return (
    <section aria-labelledby="session-records-heading" className="space-y-5">
      <div><h2 id="session-records-heading" className="display text-2xl font-semibold">录制会话</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">默认聚焦未关闭会话；全部历史和已关闭会话仍可搜索，便于追溯数小时或数天后到达的视频。</p></div>
      <form className="apple-toolbar grid gap-3 p-3 sm:grid-cols-[minmax(15rem,1fr)_minmax(10rem,auto)_auto]" action="/records">
        <input type="hidden" name="tab" value="sessions" />
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>搜索录制会话</span><span className="relative block"><MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" /><Input name="search" defaultValue={query.search} placeholder="Session、参与者、任务或分配" className="pl-10" /></span></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>会话状态</span><NativeSelect name="status" defaultValue={query.status} className="w-full"><NativeSelectOption value="open">未关闭</NativeSelectOption><NativeSelectOption value="closed">已关闭</NativeSelectOption><NativeSelectOption value="all">全部历史</NativeSelectOption></NativeSelect></label>
        <div className="flex items-end gap-2"><Button className="flex-1">筛选</Button>{hasCustomFilters ? <Link href={`/records?tab=sessions&pageSize=${query.pageSize}`} className={buttonVariants({ variant: "outline", className: "flex-1" })}>清除筛选</Link> : null}</div>
      </form>

      <div className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/80 shadow-[var(--shadow-soft)]">
        <Table className="min-w-[88rem]">
          <TableHeader><TableRow><TableHead className="px-5">Session</TableHead><TableHead>参与者</TableHead><TableHead>任务 / 设备</TableHead><TableHead>状态</TableHead><TableHead>Marker / 视频</TableHead><TableHead>创建时间</TableHead><TableHead className="pr-5 text-right">操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((session) => (
              <TableRow key={session.publicId}>
                <TableCell className="px-5 py-4"><p className="break-all font-semibold">{session.publicId}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{session.assignmentPublicId}</p></TableCell>
                <TableCell className="max-w-xs whitespace-normal"><Link href={`/participants/${session.participantPublicId}`} className="font-semibold underline decoration-[var(--signal)] underline-offset-4">{session.participantAlias}</Link><p className="mt-1 break-all text-xs text-[var(--muted)]">{session.participantPublicId}</p></TableCell>
                <TableCell className="max-w-sm whitespace-normal"><Link href={`/tasks/${session.taskPublicId}`} className="font-semibold underline decoration-[var(--signal)] underline-offset-4">{session.taskTitle}</Link><p className="mt-1 text-xs text-[var(--muted)]">{session.taskPublicId}</p><p className="mt-1 text-xs">{session.deviceLabel} · {session.devicePublicId}</p></TableCell>
                <TableCell><Badge variant={session.status === "open" ? "default" : "secondary"}>{session.status === "closed" ? <CheckCircle weight="fill" /> : <ClockCounterClockwise weight="duotone" />}{sessionStatusLabel(session.status)}</Badge>{session.closedAt ? <p className="mt-2 text-xs text-[var(--muted)]">关闭于 {formatRecordDate(session.closedAt)}</p> : null}</TableCell>
                <TableCell className="whitespace-normal"><p className="font-semibold">{session.markerAcknowledgedAt ? "Marker 已确认" : "Marker 待确认"}</p><p className="mt-1 text-xs text-[var(--muted)]">匹配视频 {session.matchedVideoCount} 个</p></TableCell>
                <TableCell className="text-xs text-[var(--muted)]">{formatRecordDate(session.createdAt)}</TableCell>
                <TableCell className="pr-5"><div className="flex flex-col items-stretch gap-2"><Link href={`/records?tab=videos&search=${encodeURIComponent(session.publicId)}`} className={buttonVariants({ variant: "outline", size: "sm" })}><VideoCamera aria-hidden="true" />查看相关视频<ArrowRight aria-hidden="true" /></Link>{session.status === "open" ? <SessionClose sessionPublicId={session.publicId} /> : null}</div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {result.items.length === 0 ? <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/60 px-5 py-12 text-center shadow-sm"><Radio className="mx-auto size-10 text-[var(--signal)]" weight="duotone" aria-hidden="true" /><h3 className="mt-4 font-semibold">{hasCustomFilters ? "当前筛选没有录制会话" : "当前没有未关闭会话"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{hasCustomFilters ? "调整条件，或回到默认的未关闭会话列表。" : "可以查看全部历史，追溯已关闭会话和晚到的视频。"}</p><Link href={hasCustomFilters ? "/records?tab=sessions" : "/records?tab=sessions&status=all"} className={buttonVariants({ variant: "outline", className: "mt-5" })}>{hasCustomFilters ? "清除筛选" : "查看全部历史"}</Link></div> : null}
      <TablePagination pathname="/records" query={query} pagination={result} />
    </section>
  );
}
