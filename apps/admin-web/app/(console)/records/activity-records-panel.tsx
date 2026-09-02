import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { ArrowRight, CheckCircle, ClockCounterClockwise, MagnifyingGlass, ShieldCheck, UserCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { listAuditEvents } from "@egocapture/core/server/services/review";
import { auditActionLabel, auditEntityLabel, formatRecordDate } from "@/lib/record-presenters";
import { recordsHref, type ActivityRecordsQuery } from "@/lib/records-query";

type ActivityRecordsResult = Awaited<ReturnType<typeof listAuditEvents>>;

const categories = [
  ["task", "采集任务"], ["participant", "参与者与设备"], ["assignment", "人员分配"], ["session", "录制会话"],
  ["upload", "视频上传"], ["metadata", "视频元数据"], ["review", "匹配与复核"], ["system", "系统与其他"],
] as const;

export function ActivityRecordsPanel({ query, result }: { query: ActivityRecordsQuery; result: ActivityRecordsResult }) {
  const hasFilters = Boolean(query.search || query.category);
  return (
    <section aria-labelledby="activity-records-heading" className="space-y-5">
      <div><h2 id="activity-records-heading" className="display text-2xl font-semibold">操作记录</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">以中文摘要呈现只读审计证据；原始动作、请求 ID 和变更 JSON 可按需展开。</p></div>
      <form className="apple-toolbar grid gap-3 p-3 sm:grid-cols-[minmax(15rem,1fr)_minmax(11rem,auto)_auto]" action="/records">
        <input type="hidden" name="tab" value="activity" />
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>搜索操作记录</span><span className="relative block"><MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" /><Input name="search" defaultValue={query.search} placeholder="对象 ID、原始动作或操作者" className="pl-10" /></span></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>动作分类</span><NativeSelect name="category" defaultValue={query.category ?? ""} className="w-full"><NativeSelectOption value="">全部动作</NativeSelectOption>{categories.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></label>
        <div className="flex items-end gap-2"><Button className="flex-1">筛选</Button>{hasFilters ? <Link href="/records?tab=activity" className={buttonVariants({ variant: "outline", className: "flex-1" })}>清除筛选</Link> : null}</div>
      </form>
      <Card as="div" className="gap-0 overflow-hidden rounded-[1.35rem] border-white/70 bg-white/80 p-0 shadow-[var(--shadow-soft)]">
        <ol className="divide-y divide-[var(--line)]">
          {result.items.map((event) => (
            <li key={event.id}>
              <article className="grid min-w-0 gap-3 px-4 py-5 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:px-6">
                <span className="grid size-10 place-items-center rounded-full bg-[var(--teal-soft)] text-[var(--signal-dark)]" aria-hidden="true"><ShieldCheck className="size-5" weight="duotone" /></span>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-semibold">{auditActionLabel(event.action)}</h3><Badge variant="outline"><CheckCircle weight="fill" />已记录</Badge></div><p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]"><UserCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />操作者：{event.actorDisplayName ?? "系统"}</p><p className="mt-1 break-all text-xs leading-5 text-[var(--muted)]">对象：{auditEntityLabel(event.entityType)} · {event.entityPublicId ?? "无 Public ID"}</p>{event.reason ? <blockquote className="mt-3 rounded-xl bg-[var(--paper)] px-3.5 py-3 text-sm leading-6"><span className="font-semibold">原因：</span>{event.reason}</blockquote> : null}<details className="mt-3 min-w-0 text-xs"><summary className="min-h-10 cursor-pointer py-2 font-semibold text-[var(--signal-dark)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">查看变更详情</summary><div className="mt-2 min-w-0 space-y-2 rounded-xl bg-[var(--ink)] p-4 text-[var(--paper)]"><p className="break-all">原始动作：{event.action}</p><p className="break-all">对象类型：{event.entityType}</p><p className="break-all">Request ID：{event.requestId}</p>{event.beforeValues || event.afterValues ? <pre className="max-w-full overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5">{JSON.stringify({ before: event.beforeValues, after: event.afterValues }, null, 2)}</pre> : <p>没有 before / after JSON。</p>}</div></details></div>
                <time className="flex items-start gap-1.5 text-xs text-[var(--muted)] sm:justify-self-end"><ClockCounterClockwise className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{formatRecordDate(event.createdAt)}</time>
              </article>
            </li>
          ))}
        </ol>
        {result.items.length === 0 ? <div className="px-5 py-12 text-center"><ShieldCheck className="mx-auto size-10 text-[var(--signal)]" weight="duotone" aria-hidden="true" /><h3 className="mt-4 font-semibold">{hasFilters ? "当前筛选没有操作记录" : "暂无操作记录"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{hasFilters ? "调整条件，或清除筛选查看全部证据。" : "关键操作发生后会自动写入不可变的审计记录。"}</p>{hasFilters ? <Link href="/records?tab=activity" className={buttonVariants({ variant: "outline", className: "mt-5" })}>清除筛选</Link> : null}</div> : null}
      </Card>
      {result.nextCursor ? <Link href={recordsHref(query, result.nextCursor)} className={buttonVariants({ variant: "outline" })}>下一页<ArrowRight className="size-4" /></Link> : null}
    </section>
  );
}
