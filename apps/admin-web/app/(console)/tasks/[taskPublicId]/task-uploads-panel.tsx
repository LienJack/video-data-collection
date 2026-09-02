import { Badge } from "@egocapture/ui/components/badge";
import { Card } from "@egocapture/ui/components/card";
import {
  ArrowRight,
  CheckCircle,
  FileVideo,
  Scan,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { createTranslator, type UiLocale } from "@egocapture/core/i18n";
import type { getTaskOperations } from "@egocapture/core/server/services/tasks";
import {
  formatRecordBytes,
  formatRecordDuration,
  isUnhealthyMetadataStatus,
  isUnhealthyTransferStatus,
  matchDecisionLabel,
  metadataStatusLabel,
  recordHealth,
  transferStatusLabel,
} from "@/lib/record-presenters";

type TaskOperations = Awaited<ReturnType<typeof getTaskOperations>>;

type Upload = Omit<TaskOperations["uploads"][number], "createdAt"> & { createdAt: string | Date };

type TaskUploadsPanelProps = { locale: UiLocale; uploads: Upload[] };

export function TaskUploadsPanel({ locale, uploads }: TaskUploadsPanelProps) {
  const i18n = createTranslator(locale);
  const attentionCount = uploads.filter((upload) => recordHealth(upload, i18n).tone === "attention").length;

  return (
    <section aria-labelledby="task-uploads-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="task-uploads-heading" className="display text-2xl font-semibold">{i18n.t("adminUi.uploadedVideos")}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{i18n.t("adminUi.uploadsSummary", { count: uploads.length, attention: attentionCount > 0 ? i18n.t("adminUi.uploadsAttention", { count: attentionCount }) : i18n.t("adminUi.uploadsNoAttention") })}</p>
        </div>
        {attentionCount > 0 ? (
          <Link href="/review" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-white shadow-sm outline-none transition-[transform,opacity] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 active:scale-[0.98]">
            <Scan className="size-4" weight="bold" />{i18n.t("adminUi.openAttention")}<ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {uploads.map((upload) => {
          const health = recordHealth(upload, i18n);
          const HealthIcon = health.tone === "attention" ? WarningCircle : health.tone === "ready" ? CheckCircle : UploadSimple;
          const healthVariant = health.tone === "attention" ? "destructive" : health.tone === "ready" ? "secondary" : "outline";
          return (
            <Card key={upload.publicId} as="article" className="gap-5 rounded-[1.35rem] border-white/70 bg-white/80 p-5 shadow-[var(--shadow-soft)] sm:p-6">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--teal-soft)] text-[var(--signal-dark)]" aria-hidden="true"><FileVideo className="size-5" weight="duotone" /></span>
                  <div className="min-w-0">
                    <h3 className="break-all text-sm font-semibold leading-5">{upload.originalFilename}</h3>
                    <p className="mt-1 break-all text-xs text-[var(--muted)]">{upload.publicId}</p>
                  </div>
                </div>
                <Badge variant={healthVariant}><HealthIcon weight="fill" />{health.label}</Badge>
              </div>

              <dl className="grid grid-cols-1 gap-2.5 min-[28rem]:grid-cols-2">
                <StatusItem label={i18n.t("participantUi.transfer")} value={transferStatusLabel(upload.transferStatus, i18n)} warning={isUnhealthyTransferStatus(upload.transferStatus)} />
                <StatusItem label={i18n.t("participantUi.metadata")} value={metadataStatusLabel(upload.metadataStatus, i18n)} warning={isUnhealthyMetadataStatus(upload.metadataStatus)} />
                <StatusItem label={i18n.t("participantUi.match")} value={matchDecisionLabel(upload.decisionType, i18n)} warning={!upload.decisionType || upload.decisionType === "unmatched" || upload.decisionType === "rejected"} />
                <StatusItem label={i18n.t("adminUi.humanReview")} value={upload.reviewCount > 0 ? i18n.t("adminUi.reviewItems", { count: upload.reviewCount }) : i18n.t("adminUi.noHandlingNeeded")} warning={upload.reviewCount > 0} />
              </dl>

              <div className="rounded-2xl bg-[var(--paper)] p-4 text-xs leading-5 text-[var(--muted)]">
                <p className="break-words font-semibold text-[var(--ink)]">{upload.participantAlias} · <span className="break-all">{upload.participantPublicId}</span></p>
                <p className="mt-1 break-all">{i18n.t("adminUi.sessionLabel", { value: upload.sessionPublicId ?? i18n.t("adminUi.notDetermined") })}</p>
                <p className="mt-1 break-words">
                  {formatRecordBytes(upload.sizeBytes, i18n)} · {formatRecordDuration(upload.durationMs, i18n)}
                  {upload.width && upload.height ? ` · ${upload.width}×${upload.height}` : ` · ${i18n.t("adminUi.resolutionPending")}`}
                  {upload.frameRate ? ` · ${upload.frameRate.toFixed(2)} fps` : ""}
                </p>
                <p className="mt-1">{i18n.t("adminUi.deviceConsistency", { value: upload.deviceConsistency ? i18n.label("deviceConsistency", upload.deviceConsistency) : i18n.t("adminUi.awaitingReconciliation") })}</p>
              </div>

              <div className="flex flex-col gap-2 min-[28rem]:flex-row">
                <Link href={`/uploads/${upload.publicId}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-white outline-none transition-[transform,opacity] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 active:scale-[0.98]">
                  {i18n.t("adminUi.viewUploadDetails")}<ArrowRight className="size-4" />
                </Link>
                {upload.reviewCount > 0 ? (
                  <Link href="/review" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--teal-soft)] px-4 text-sm font-semibold text-[var(--signal-dark)] outline-none transition-[transform,background-color] hover:bg-[var(--paper-deep)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98]">
                    <Scan className="size-4" />{i18n.t("adminUi.handleAnomaly")}
                  </Link>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>

      {uploads.length === 0 ? (
        <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/60 px-5 py-12 text-center shadow-sm">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--teal-soft)] text-[var(--signal-dark)]" aria-hidden="true"><FileVideo className="size-6" /></span>
          <h3 className="mt-4 font-semibold">{i18n.t("adminUi.noUploadedVideos")}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{i18n.t("adminUi.noUploadedVideosHelp")}</p>
        </div>
      ) : null}
    </section>
  );
}

function StatusItem({ label, value, warning }: { label: string; value: string; warning: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white/55 p-3">
      <dt className="text-[0.6875rem] font-semibold tracking-[0.06em] text-[var(--muted)]">{label}</dt>
      <dd className={`mt-1 flex items-start gap-1.5 break-words text-sm font-semibold ${warning ? "text-[var(--destructive)]" : "text-[var(--ink)]"}`}>
        {warning ? <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" aria-hidden="true" /> : <CheckCircle className="mt-0.5 size-4 shrink-0 text-[var(--signal-dark)]" weight="fill" aria-hidden="true" />}
        {value}
      </dd>
    </div>
  );
}
