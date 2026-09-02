import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { ArrowRight, FileVideo, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { listAdminUploads } from "@egocapture/core/server/services/review";
import { TablePagination } from "@/app/_components/table-pagination";
import {
  formatRecordBytes,
  formatRecordDate,
  isUnhealthyMetadataStatus,
  isUnhealthyTransferStatus,
  matchDecisionLabel,
  metadataStatusLabel,
  recordHealth,
  resolvedSessionForDisplay,
  transferStatusLabel,
} from "@/lib/record-presenters";
import type { VideoRecordsQuery } from "@/lib/records-query";

type VideoRecordsResult = Awaited<ReturnType<typeof listAdminUploads>>;

const transferStatuses = ["created", "uploading", "reconciling", "verified", "failed", "aborted", "expired"] as const;
const metadataStatuses = ["pending", "processing", "extracted", "partial", "unsupported", "failed"] as const;

export function VideoRecordsPanel({ query, result }: { query: VideoRecordsQuery; result: VideoRecordsResult }) {
  const hasFilters = Boolean(query.search || query.transferStatus || query.metadataStatus || query.attention);

  return (
    <section aria-labelledby="video-records-heading" className="space-y-5">
      <div>
        <h2 id="video-records-heading" className="display text-2xl font-semibold">视频记录</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">按上传记录查看传输、元数据、匹配和人工复核状态。缺少上传会在上方异常概览中单独呈现。</p>
      </div>

      <form className="apple-toolbar grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_repeat(3,minmax(10rem,auto))_auto]" action="/records">
        <input type="hidden" name="tab" value="videos" />
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>搜索视频记录</span><span className="relative block"><MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" /><Input name="search" defaultValue={query.search} placeholder="文件名、参与者、任务或 Session" className="pl-10" /></span></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>传输状态</span><NativeSelect name="transferStatus" defaultValue={query.transferStatus ?? ""} className="w-full"><NativeSelectOption value="">全部传输状态</NativeSelectOption>{transferStatuses.map((status) => <NativeSelectOption key={status} value={status}>{transferStatusLabel(status)}</NativeSelectOption>)}</NativeSelect></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>元数据状态</span><NativeSelect name="metadataStatus" defaultValue={query.metadataStatus ?? ""} className="w-full"><NativeSelectOption value="">全部元数据状态</NativeSelectOption>{metadataStatuses.map((status) => <NativeSelectOption key={status} value={status}>{metadataStatusLabel(status)}</NativeSelectOption>)}</NativeSelect></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>处理状态</span><NativeSelect name="attention" defaultValue={query.attention ?? ""} className="w-full"><NativeSelectOption value="">全部记录</NativeSelectOption><NativeSelectOption value="open">仅看待处理</NativeSelectOption></NativeSelect></label>
        <div className="flex items-end gap-2"><Button className="flex-1">筛选</Button>{hasFilters ? <Link href={`/records?tab=videos&pageSize=${query.pageSize}`} className={buttonVariants({ variant: "outline", className: "flex-1" })}>清除筛选</Link> : null}</div>
      </form>

      <div className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/80 shadow-[var(--shadow-soft)]">
        <Table className="min-w-[86rem]">
          <TableHeader><TableRow><TableHead className="px-5">文件</TableHead><TableHead>参与者</TableHead><TableHead>任务 / Session</TableHead><TableHead>传输 / Metadata / 匹配 / Review</TableHead><TableHead>大小 / 时间</TableHead><TableHead className="pr-5 text-right">操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((upload) => {
              const health = recordHealth(upload);
              const finalSession = resolvedSessionForDisplay(upload.decisionType, upload.resolvedSessionPublicId);
              const actionHref = upload.primaryReviewPublicId ? `/review/${upload.primaryReviewPublicId}` : `/uploads/${upload.publicId}`;
              return (
                <TableRow key={upload.publicId}>
                  <TableCell className="max-w-sm whitespace-normal px-5 py-4"><Link href={`/uploads/${upload.publicId}`} className="break-all font-semibold underline decoration-[var(--signal)] underline-offset-4">{upload.originalFilename}</Link><p className="mt-1 break-all text-xs text-[var(--muted)]">{upload.publicId}</p><Badge className="mt-2" variant={health.tone === "attention" ? "destructive" : health.tone === "ready" ? "secondary" : "outline"}>{health.label}</Badge></TableCell>
                  <TableCell className="max-w-xs whitespace-normal"><Link href={`/participants/${upload.participantPublicId}`} className="font-semibold underline decoration-[var(--signal)] underline-offset-4">{upload.participantAlias}</Link><p className="mt-1 break-all text-xs text-[var(--muted)]">{upload.participantPublicId}</p></TableCell>
                  <TableCell className="max-w-sm whitespace-normal">{upload.taskPublicId ? <Link href={`/tasks/${upload.taskPublicId}`} className="font-semibold underline decoration-[var(--signal)] underline-offset-4">{upload.taskTitle ?? upload.taskPublicId}</Link> : <span className="font-semibold">任务待确定</span>}<p className="mt-1 text-xs text-[var(--muted)]">声明：<SessionLink value={upload.claimedSessionPublicId} empty="未声明" /></p><p className="mt-1 text-xs text-[var(--muted)]">最终：<SessionLink value={finalSession} empty={upload.decisionType === "rejected" ? "匹配已拒绝" : "待确认"} /></p></TableCell>
                  <TableCell className="whitespace-normal"><StatusLine label="上传" value={transferStatusLabel(upload.transferStatus)} warning={isUnhealthyTransferStatus(upload.transferStatus)} /><StatusLine label="元数据" value={metadataStatusLabel(upload.metadataStatus)} warning={isUnhealthyMetadataStatus(upload.metadataStatus)} /><StatusLine label="匹配" value={matchDecisionLabel(upload.decisionType)} warning={!upload.decisionType || upload.decisionType === "unmatched" || upload.decisionType === "rejected"} /><StatusLine label="人工复核" value={upload.reviewCount > 0 ? `${upload.reviewCount} 项待处理` : "无需处理"} warning={upload.reviewCount > 0} /></TableCell>
                  <TableCell className="text-xs text-[var(--muted)]"><p>{formatRecordBytes(upload.sizeBytes)}</p><time className="mt-1 block">{formatRecordDate(upload.createdAt)}</time></TableCell>
                  <TableCell className="pr-5 text-right"><Link href={actionHref} className={buttonVariants({ size: "sm" })}>{upload.primaryReviewPublicId ? "处理异常" : "查看详情"}<ArrowRight aria-hidden="true" /></Link></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/60 px-5 py-12 text-center shadow-sm">
          <FileVideo className="mx-auto size-10 text-[var(--signal)]" weight="duotone" aria-hidden="true" />
          <h3 className="mt-4 font-semibold">{hasFilters ? "当前筛选没有视频记录" : "还没有上传视频"}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{hasFilters ? "调整条件，或清除筛选查看全部上传。" : "参与者创建录制并上传后，视频记录会显示在这里。"}</p>
          <Link href={hasFilters ? "/records?tab=videos" : "/tasks"} className={buttonVariants({ variant: "outline", className: "mt-5" })}>{hasFilters ? "清除筛选" : "查看采集任务"}</Link>
        </div>
      ) : null}

      <TablePagination pathname="/records" query={query} pagination={result} />
    </section>
  );
}

function SessionLink({ value, empty }: { value: string | null; empty: string }) {
  return value ? <Link href={`/records?tab=sessions&search=${encodeURIComponent(value)}&status=all`} className="break-all font-semibold underline decoration-[var(--signal)] underline-offset-4">{value}</Link> : <span>{empty}</span>;
}

function StatusLine({ label, value, warning }: { label: string; value: string; warning: boolean }) {
  return <p className={`leading-6 ${warning ? "font-semibold text-[var(--destructive)]" : "text-[var(--muted)]"}`}><span className="font-semibold text-[var(--ink)]">{label}：</span>{value}</p>;
}
