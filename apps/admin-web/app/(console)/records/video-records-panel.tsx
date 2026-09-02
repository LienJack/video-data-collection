import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { ArrowRight, CheckCircle, FileVideo, MagnifyingGlass, UploadSimple, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { listAdminUploads } from "@egocapture/core/server/services/review";
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
import { recordsHref, type VideoRecordsQuery } from "@/lib/records-query";

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
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>搜索视频记录</span><span className="relative block"><MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" /><Input name="search" defaultValue={query.search} placeholder="文件名、参与者、任务或 Session" className="pl-10" /></span></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>传输状态</span><NativeSelect name="transferStatus" defaultValue={query.transferStatus ?? ""} className="w-full"><NativeSelectOption value="">全部传输状态</NativeSelectOption>{transferStatuses.map((status) => <NativeSelectOption key={status} value={status}>{transferStatusLabel(status)}</NativeSelectOption>)}</NativeSelect></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>元数据状态</span><NativeSelect name="metadataStatus" defaultValue={query.metadataStatus ?? ""} className="w-full"><NativeSelectOption value="">全部元数据状态</NativeSelectOption>{metadataStatuses.map((status) => <NativeSelectOption key={status} value={status}>{metadataStatusLabel(status)}</NativeSelectOption>)}</NativeSelect></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>处理状态</span><NativeSelect name="attention" defaultValue={query.attention ?? ""} className="w-full"><NativeSelectOption value="">全部记录</NativeSelectOption><NativeSelectOption value="open">仅看待处理</NativeSelectOption></NativeSelect></label>
        <div className="flex items-end gap-2"><Button className="flex-1">筛选</Button>{hasFilters ? <Link href="/records?tab=videos" className={buttonVariants({ variant: "outline", className: "flex-1" })}>清除筛选</Link> : null}</div>
      </form>

      <div className="grid gap-4 xl:grid-cols-2">
        {result.items.map((upload) => {
          const health = recordHealth(upload);
          const HealthIcon = health.tone === "attention" ? WarningCircle : health.tone === "ready" ? CheckCircle : UploadSimple;
          const healthVariant = health.tone === "attention" ? "destructive" : health.tone === "ready" ? "secondary" : "outline";
          const finalSession = resolvedSessionForDisplay(upload.decisionType, upload.resolvedSessionPublicId);
          const actionHref = upload.primaryReviewPublicId ? `/review/${upload.primaryReviewPublicId}` : `/uploads/${upload.publicId}`;
          const actionLabel = upload.primaryReviewPublicId ? "处理异常" : "查看视频详情";
          return (
            <Card as="article" key={upload.publicId} className="gap-5 rounded-[1.35rem] border-white/70 bg-white/80 p-5 shadow-[var(--shadow-soft)] sm:p-6">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--teal-soft)] text-[var(--signal-dark)]" aria-hidden="true"><FileVideo className="size-5" weight="duotone" /></span><div className="min-w-0"><h3 className="break-all text-sm font-semibold leading-5">{upload.originalFilename}</h3><p className="mt-1 break-all text-xs text-[var(--muted)]">{upload.publicId}</p></div></div>
                <Badge variant={healthVariant}><HealthIcon weight="fill" />{health.label}</Badge>
              </div>

              <div className="grid gap-3 rounded-2xl bg-[var(--paper)] p-4 text-sm min-[28rem]:grid-cols-2">
                <div><p className="text-xs font-semibold text-[var(--muted)]">参与者</p><Link href={`/participants/${upload.participantPublicId}`} className="mt-1 block break-words font-semibold underline decoration-[var(--signal)] underline-offset-4">{upload.participantAlias}</Link><p className="mt-1 break-all text-xs text-[var(--muted)]">{upload.participantPublicId}</p></div>
                <div><p className="text-xs font-semibold text-[var(--muted)]">采集任务</p>{upload.taskPublicId ? <Link href={`/tasks/${upload.taskPublicId}`} className="mt-1 block break-words font-semibold underline decoration-[var(--signal)] underline-offset-4">{upload.taskTitle ?? upload.taskPublicId}</Link> : <p className="mt-1 font-semibold">任务待确定</p>}{upload.taskPublicId ? <p className="mt-1 break-all text-xs text-[var(--muted)]">{upload.taskPublicId}</p> : null}</div>
                <SessionValue label="声明 Session" value={upload.claimedSessionPublicId} empty="参与者未声明" />
                <SessionValue label="最终 Session" value={finalSession} empty={upload.decisionType === "rejected" ? "匹配已拒绝" : upload.decisionType === "unmatched" ? "尚未匹配" : "等待管理员确认"} />
              </div>

              <dl className="grid grid-cols-1 gap-2.5 min-[28rem]:grid-cols-2">
                <StatusItem label="上传" value={transferStatusLabel(upload.transferStatus)} warning={isUnhealthyTransferStatus(upload.transferStatus)} />
                <StatusItem label="元数据" value={metadataStatusLabel(upload.metadataStatus)} warning={isUnhealthyMetadataStatus(upload.metadataStatus)} />
                <StatusItem label="匹配" value={matchDecisionLabel(upload.decisionType)} warning={!upload.decisionType || upload.decisionType === "unmatched" || upload.decisionType === "rejected"} />
                <StatusItem label="人工复核" value={upload.reviewCount > 0 ? `${upload.reviewCount} 项待处理` : "无需处理"} warning={upload.reviewCount > 0} />
              </dl>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]"><span>{formatRecordBytes(upload.sizeBytes)}</span><time>{formatRecordDate(upload.createdAt)}</time></div>
              <Link href={actionHref} className={buttonVariants({ className: "w-full" })}>{actionLabel}<ArrowRight className="size-4" /></Link>
            </Card>
          );
        })}
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/60 px-5 py-12 text-center shadow-sm">
          <FileVideo className="mx-auto size-10 text-[var(--signal)]" weight="duotone" aria-hidden="true" />
          <h3 className="mt-4 font-semibold">{hasFilters ? "当前筛选没有视频记录" : "还没有上传视频"}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{hasFilters ? "调整条件，或清除筛选查看全部上传。" : "参与者创建录制并上传后，视频记录会显示在这里。"}</p>
          <Link href={hasFilters ? "/records?tab=videos" : "/tasks"} className={buttonVariants({ variant: "outline", className: "mt-5" })}>{hasFilters ? "清除筛选" : "查看采集任务"}</Link>
        </div>
      ) : null}

      {result.nextCursor ? <Link href={recordsHref(query, result.nextCursor)} className={buttonVariants({ variant: "outline" })}>下一页<ArrowRight className="size-4" /></Link> : null}
    </section>
  );
}

function SessionValue({ label, value, empty }: { label: string; value: string | null; empty: string }) {
  return <div><p className="text-xs font-semibold text-[var(--muted)]">{label}</p>{value ? <Link href={`/records?tab=sessions&search=${encodeURIComponent(value)}&status=all`} className="mt-1 block break-all font-semibold underline decoration-[var(--signal)] underline-offset-4">{value}</Link> : <p className="mt-1 font-semibold">{empty}</p>}</div>;
}

function StatusItem({ label, value, warning }: { label: string; value: string; warning: boolean }) {
  return <div className="rounded-xl border border-[var(--line)] bg-white/55 p-3"><dt className="text-[0.6875rem] font-semibold tracking-[0.06em] text-[var(--muted)]">{label}</dt><dd className={`mt-1 flex items-start gap-1.5 break-words text-sm font-semibold ${warning ? "text-[var(--destructive)]" : "text-[var(--ink)]"}`}>{warning ? <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" aria-hidden="true" /> : <CheckCircle className="mt-0.5 size-4 shrink-0 text-[var(--signal-dark)]" weight="fill" aria-hidden="true" />}{value}</dd></div>;
}
