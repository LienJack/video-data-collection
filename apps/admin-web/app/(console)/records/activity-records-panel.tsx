import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { CheckCircle, MagnifyingGlass, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { listAuditEvents } from "@egocapture/core/server/services/review";
import { TablePagination } from "@/app/_components/table-pagination";
import { auditActionLabel, auditEntityLabel, changedAuditFields, formatRecordDate } from "@/lib/record-presenters";
import type { ActivityRecordsQuery } from "@/lib/records-query";

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

      <div className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/80 shadow-[var(--shadow-soft)]">
        <Table className="min-w-[80rem]">
          <TableHeader><TableRow><TableHead className="px-5">动作</TableHead><TableHead>实体</TableHead><TableHead>操作者</TableHead><TableHead>原因 / 变化摘要</TableHead><TableHead>时间</TableHead><TableHead className="pr-5">操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((event) => {
              const changes = changedAuditFields(event.beforeValues, event.afterValues);
              return (
                <TableRow key={event.id}>
                  <TableCell className="max-w-xs whitespace-normal px-5 py-4"><p className="font-semibold">{auditActionLabel(event.action)}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{event.action}</p><Badge className="mt-2" variant="outline"><CheckCircle weight="fill" />已记录</Badge></TableCell>
                  <TableCell className="max-w-xs whitespace-normal"><p className="font-semibold">{auditEntityLabel(event.entityType)}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{event.entityPublicId ?? "无 Public ID"}</p></TableCell>
                  <TableCell className="max-w-xs whitespace-normal">{event.actorDisplayName ?? "系统"}</TableCell>
                  <TableCell className="max-w-md whitespace-normal"><p>{event.reason ?? "未填写原因"}</p><p className="mt-1 text-xs text-[var(--muted)]">{changes.length > 0 ? `变更：${changes.join("、")}` : "无 before / after 字段变化"}</p></TableCell>
                  <TableCell className="text-xs text-[var(--muted)]">{formatRecordDate(event.createdAt)}</TableCell>
                  <TableCell className="pr-5"><details className="min-w-52 text-xs"><summary className="min-h-10 cursor-pointer py-2 font-semibold text-[var(--signal-dark)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">查看变更详情</summary><div className="mt-2 min-w-0 space-y-2 rounded-xl bg-[var(--ink)] p-4 text-[var(--paper)]"><p className="break-all">原始动作：{event.action}</p><p className="break-all">Request ID：{event.requestId}</p>{event.beforeValues || event.afterValues ? <pre className="max-w-full overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5">{JSON.stringify({ before: event.beforeValues, after: event.afterValues }, null, 2)}</pre> : <p>没有 before / after JSON。</p>}</div></details></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {result.items.length === 0 ? <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/60 px-5 py-12 text-center shadow-sm"><ShieldCheck className="mx-auto size-10 text-[var(--signal)]" weight="duotone" aria-hidden="true" /><h3 className="mt-4 font-semibold">{hasFilters ? "当前筛选没有操作记录" : "暂无操作记录"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{hasFilters ? "调整条件，或清除筛选查看全部证据。" : "关键操作发生后会自动写入不可变的审计记录。"}</p>{hasFilters ? <Link href="/records?tab=activity" className={buttonVariants({ variant: "outline", className: "mt-5" })}>清除筛选</Link> : null}</div> : null}
      <TablePagination pathname="/records" query={query} pagination={result} />
    </section>
  );
}
