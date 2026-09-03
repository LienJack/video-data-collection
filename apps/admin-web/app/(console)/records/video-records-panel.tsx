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
import { createTranslator, type UiLocale } from "@egocapture/core/i18n";

type VideoRecordsResult = Awaited<ReturnType<typeof listAdminUploads>>;

const transferStatuses = ["created", "uploading", "reconciling", "verified", "failed", "aborted", "expired"] as const;
const metadataStatuses = ["pending", "processing", "extracted", "partial", "unsupported", "failed"] as const;

export function VideoRecordsPanel({ locale, query, result }: { locale: UiLocale; query: VideoRecordsQuery; result: VideoRecordsResult }) {
  const i18n = createTranslator(locale);
  const hasFilters = Boolean(query.search || query.transferStatus || query.metadataStatus || query.attention);

  return (
    <section aria-labelledby="video-records-heading" className="space-y-5">
      <div>
        <h2 id="video-records-heading" className="display text-2xl font-semibold">{i18n.t("adminUi.videoRecords")}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{i18n.t("adminUi.videoRecordsIntro")}</p>
      </div>

      <form className="apple-toolbar grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_repeat(3,minmax(10rem,auto))_auto]" action="/records">
        <input type="hidden" name="tab" value="videos" />
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>{i18n.t("adminUi.searchVideoRecords")}</span><span className="relative block"><MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" /><Input name="search" defaultValue={query.search} placeholder={i18n.t("adminUi.videoSearchPlaceholder")} className="pl-10" /></span></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>{i18n.t("adminUi.transferStatus")}</span><NativeSelect name="transferStatus" defaultValue={query.transferStatus ?? ""} className="w-full"><NativeSelectOption value="">{i18n.t("adminUi.allTransferStatuses")}</NativeSelectOption>{transferStatuses.map((status) => <NativeSelectOption key={status} value={status}>{transferStatusLabel(status, i18n)}</NativeSelectOption>)}</NativeSelect></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>{i18n.t("adminUi.metadataStatus")}</span><NativeSelect name="metadataStatus" defaultValue={query.metadataStatus ?? ""} className="w-full"><NativeSelectOption value="">{i18n.t("adminUi.allMetadataStatuses")}</NativeSelectOption>{metadataStatuses.map((status) => <NativeSelectOption key={status} value={status}>{metadataStatusLabel(status, i18n)}</NativeSelectOption>)}</NativeSelect></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>{i18n.t("adminUi.handlingStatus")}</span><NativeSelect name="attention" defaultValue={query.attention ?? ""} className="w-full"><NativeSelectOption value="">{i18n.t("adminUi.allRecords")}</NativeSelectOption><NativeSelectOption value="open">{i18n.t("adminUi.attentionOnly")}</NativeSelectOption></NativeSelect></label>
        <div className="flex items-end gap-2"><Button className="flex-1">{i18n.t("adminUi.filter")}</Button>{hasFilters ? <Link href={`/records?tab=videos&pageSize=${query.pageSize}`} className={buttonVariants({ variant: "outline", className: "flex-1" })}>{i18n.t("adminUi.clearFilters")}</Link> : null}</div>
      </form>

      <div className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/80 shadow-[var(--shadow-soft)]">
        <Table className="min-w-[86rem]">
          <TableHeader><TableRow><TableHead className="px-5">{i18n.t("adminUi.file")}</TableHead><TableHead>{i18n.t("adminUi.participants")}</TableHead><TableHead>{i18n.t("adminUi.taskSession")}</TableHead><TableHead>{i18n.t("adminUi.recordStatusColumns")}</TableHead><TableHead>{i18n.t("adminUi.sizeTime")}</TableHead><TableHead className="pr-5 text-right">{i18n.t("common.actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((upload) => {
              const health = recordHealth(upload, i18n);
              const finalSession = resolvedSessionForDisplay(upload.decisionType, upload.resolvedSessionPublicId);
              const actionHref = upload.primaryReviewPublicId ? `/review/${upload.primaryReviewPublicId}` : `/uploads/${upload.publicId}`;
              return (
                <TableRow key={upload.publicId}>
                  <TableCell className="max-w-sm whitespace-normal px-5 py-4"><Link href={`/uploads/${upload.publicId}`} className="break-all font-semibold underline decoration-[var(--signal)] underline-offset-4">{upload.originalFilename}</Link><p className="mt-1 break-all text-xs text-[var(--muted)]">{upload.publicId}</p><Badge className="mt-2" variant={health.tone === "attention" ? "destructive" : health.tone === "ready" ? "secondary" : "outline"}>{health.label}</Badge></TableCell>
                  <TableCell className="max-w-xs whitespace-normal"><Link href={`/participants/${upload.participantPublicId}`} className="font-semibold underline decoration-[var(--signal)] underline-offset-4">{upload.participantAlias}</Link><p className="mt-1 break-all text-xs text-[var(--muted)]">{upload.participantPublicId}</p></TableCell>
                  <TableCell className="max-w-sm whitespace-normal">{upload.taskPublicId ? <Link href={`/tasks/${upload.taskPublicId}`} className="font-semibold underline decoration-[var(--signal)] underline-offset-4">{upload.taskTitle ?? upload.taskPublicId}</Link> : <span className="font-semibold">{i18n.t("adminUi.taskPending")}</span>}<p className="mt-1 text-xs text-[var(--muted)]">{i18n.t("adminUi.claimed")}<SessionLink value={upload.claimedSessionPublicId} empty={i18n.t("adminUi.notClaimed")} /></p><p className="mt-1 text-xs text-[var(--muted)]">{i18n.t("adminUi.final")}<SessionLink value={finalSession} empty={upload.decisionType === "rejected" ? i18n.label("matchDecision", "rejected") : i18n.t("adminUi.awaitingConfirmation")} /></p></TableCell>
                  <TableCell className="whitespace-normal"><StatusLine label={i18n.t("participantUi.transfer")} value={transferStatusLabel(upload.transferStatus, i18n)} warning={isUnhealthyTransferStatus(upload.transferStatus)} /><StatusLine label={i18n.t("participantUi.metadata")} value={metadataStatusLabel(upload.metadataStatus, i18n)} warning={isUnhealthyMetadataStatus(upload.metadataStatus)} /><StatusLine label={i18n.t("participantUi.match")} value={matchDecisionLabel(upload.decisionType, i18n)} warning={!upload.decisionType || upload.decisionType === "unmatched" || upload.decisionType === "rejected"} /><StatusLine label={i18n.t("adminUi.humanReview")} value={upload.reviewCount > 0 ? i18n.t("adminUi.reviewItems", { count: upload.reviewCount }) : i18n.t("adminUi.noHandlingNeeded")} warning={upload.reviewCount > 0} /></TableCell>
                  <TableCell className="text-xs text-[var(--muted)]"><p>{formatRecordBytes(upload.sizeBytes, i18n)}</p><time className="mt-1 block">{formatRecordDate(upload.createdAt, i18n)}</time></TableCell>
                  <TableCell className="pr-5 text-right"><Link href={actionHref} className={buttonVariants({ size: "sm" })}>{upload.primaryReviewPublicId ? i18n.t("adminUi.handleAnomaly") : i18n.t("common.details")}<ArrowRight aria-hidden="true" /></Link></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/60 px-5 py-12 text-center shadow-sm">
          <FileVideo className="mx-auto size-10 text-[var(--signal)]" weight="duotone" aria-hidden="true" />
          <h3 className="mt-4 font-semibold">{hasFilters ? i18n.t("adminUi.noVideoRecordsFiltered") : i18n.t("adminUi.noUploadedVideos")}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{hasFilters ? i18n.t("adminUi.noVideoRecordsFilteredHelp") : i18n.t("adminUi.noVideoRecordsHelp")}</p>
          <Link href={hasFilters ? "/records?tab=videos" : "/tasks"} className={buttonVariants({ variant: "outline", className: "mt-5" })}>{hasFilters ? i18n.t("adminUi.clearFilters") : i18n.t("adminUi.viewTasks")}</Link>
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
