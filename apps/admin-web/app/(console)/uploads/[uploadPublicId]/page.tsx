import { Table, TableBody, TableCell, TableHead, TableRow } from "@egocapture/ui/components/table";
import { Card } from "@egocapture/ui/components/card";
import Link from "next/link";
import { UploadActions } from "@/app/(console)/uploads/[uploadPublicId]/upload-actions";
import { requireAdmin } from "@/lib/auth";
import { getAdminUpload } from "@egocapture/core/server/services/review";
import { createTranslator, type Translator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

function value(item: unknown, i18n: Translator) {
  if (item === null || item === undefined || item === "") return "—";
  if (item instanceof Date) return i18n.date(item);
  if (typeof item === "boolean") return item ? i18n.t("common.yes") : i18n.t("common.no");
  return String(item);
}

export default async function AdminUploadPage({ params }: { params: Promise<{ uploadPublicId: string }> }) {
  const viewer = await requireAdmin();
  const locale = await requestLocale();
  const i18n = createTranslator(locale);
  const { uploadPublicId } = await params;
  const upload = await getAdminUpload(viewer, uploadPublicId);
  const metadataRows: Array<[string, unknown]> = upload.metadata ? [
    [i18n.t("adminUi.parser"), `${upload.metadata.parserName} ${upload.metadata.parserVersion}`],
    [i18n.t("adminUi.container"), upload.metadata.containerFormat],
    [i18n.t("adminUi.duration"), upload.metadata.durationMs === null ? null : i18n.duration(upload.metadata.durationMs / 1000)],
    [i18n.t("adminUi.video"), [upload.metadata.videoCodec, upload.metadata.width && upload.metadata.height ? `${upload.metadata.width} × ${upload.metadata.height}` : null, upload.metadata.frameRate ? `${i18n.number(upload.metadata.frameRate)} FPS` : null].filter(Boolean).join(" · ")],
    [i18n.t("adminUi.audio"), [upload.metadata.audioCodec, upload.metadata.audioChannels === null ? null : i18n.t("adminUi.channels", { count: i18n.number(upload.metadata.audioChannels) })].filter(Boolean).join(" · ")],
    [i18n.t("adminUi.captureTime"), [upload.metadata.normalizedCaptureTime ? i18n.date(upload.metadata.normalizedCaptureTime) : null, upload.metadata.captureTimeSource ? i18n.label("captureTimeSource", upload.metadata.captureTimeSource) : null, upload.metadata.captureTimeConfidence, upload.metadata.timezoneOffset].filter(Boolean).join(" · ")],
    [i18n.t("adminUi.camera"), [upload.metadata.cameraManufacturer, upload.metadata.cameraModel].filter(Boolean).join(" ")],
    [i18n.t("adminUi.serialHmac"), upload.metadata.cameraSerialHash ? `${upload.metadata.cameraSerialHash.slice(0, 12)}…` : null],
    [i18n.t("adminUi.gpsPresent"), upload.metadata.gpsMetadataPresent],
    [i18n.t("adminUi.projection360"), [upload.metadata.projectionType, upload.metadata.is360 === null ? null : upload.metadata.is360 ? "360" : i18n.t("adminUi.not360")].filter(Boolean).join(" · ")],
    [i18n.t("adminUi.deviceConsistency", { value: "" }).replace(":", "").replace("：", "").trim(), upload.metadata.deviceConsistency ? i18n.label("deviceConsistency", upload.metadata.deviceConsistency) : null],
    [i18n.t("adminUi.extracted"), upload.metadata.extractedAt],
  ] : [];
  const claimRows: Array<[string, unknown]> = [
    [i18n.t("adminUi.claimedSession"), upload.claimedSessionPublicId || (upload.unableToDetermine ? i18n.t("participantUi.unableDetermine") : null)],
    [i18n.t("adminUi.localModified"), upload.localModifiedAt],
    [i18n.t("adminUi.participantNote"), upload.participantNote],
    [i18n.t("adminUi.failureCode"), upload.failureCode],
    [i18n.t("adminUi.verifiedAt"), upload.verifiedAt],
    [i18n.t("adminUi.intentExpires"), upload.expectedExpiresAt],
    [i18n.t("adminUi.videoAsset"), upload.videoAssetPublicId],
    [i18n.t("adminUi.objectKey"), upload.objectKey],
  ];

  return (
    <main className="app-page">
      <Link href="/uploads" className="text-sm font-bold text-[var(--teal)]">← {i18n.t("adminUi.uploadsBack")}</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <p className="text-xs font-bold text-[var(--signal)]">{upload.publicId}</p>
        <h1 className="page-title break-all">{upload.originalFilename}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{upload.participantAlias} · {upload.participantPublicId} · {i18n.bytes(upload.sizeBytes)} · {upload.contentType}{upload.storageDeletedAt ? ` · ${i18n.t("adminUi.demoRetentionExpired")}` : ""}</p>
        <UploadActions uploadPublicId={upload.publicId} canPreview={upload.transferStatus === "verified" && !upload.storageDeletedAt} />
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[[i18n.t("adminUi.transfer"), i18n.state("upload_intent.transfer_status", upload.transferStatus)], [i18n.t("adminUi.metadata"), i18n.state("upload_intent.metadata_status", upload.metadataStatus)], [i18n.t("adminUi.matchDevice"), `${upload.decisionType ? i18n.label("matchDecision", upload.decisionType) : i18n.t("adminUi.awaitingConfirmation")} / ${upload.deviceConsistency ? i18n.label("deviceConsistency", upload.deviceConsistency) : i18n.t("adminUi.awaitingConfirmation")}`]].map(([label, item]) => <Card as="article" key={label} className="border border-[var(--line)] bg-white/35 p-5"><p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p><p className="display mt-2 text-2xl font-semibold">{item}</p></Card>)}
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-2">
        <Card as="article" className="border border-[var(--line)] bg-white/35 p-6">
          <h2 className="display text-2xl font-semibold">{i18n.t("adminUi.objectClaim")}</h2>
          <dl className="mt-5 space-y-3 text-sm">
            {claimRows.map(([label, item]) => <div key={label} className="grid grid-cols-[140px_1fr] gap-3 border-b border-[var(--line)] pb-3"><dt className="font-bold text-[var(--muted)]">{label}</dt><dd className="break-all">{value(item, i18n)}</dd></div>)}
          </dl>
        </Card>
        <Card as="article" className="border border-[var(--line)] bg-white/35 p-6">
          <h2 className="display text-2xl font-semibold">{i18n.t("adminUi.uploadAttempts")}</h2>
          <div className="mt-5 space-y-3">{upload.attempts.map((attempt) => <div key={attempt.publicId} className="border-l-2 border-[var(--teal)] pl-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">#{attempt.attemptNumber} · {attempt.publicId}</p><span className="text-xs font-bold uppercase">{i18n.state("upload_attempt.status", attempt.status)}</span></div><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{attempt.provider} · {i18n.bytes(attempt.bytesUploaded)} · {attempt.errorCode ? i18n.error(attempt.errorCode) : i18n.t("participantUi.noError")}<br />{value(attempt.startedAt, i18n)} → {value(attempt.completedAt, i18n)} · {i18n.t("adminUi.expires", { date: value(attempt.expiresAt, i18n) })}</p></div>)}</div>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl font-semibold">{i18n.t("adminUi.normalizedMetadata")}</h2>
        {upload.metadata ? <div className="mt-4 overflow-x-auto border border-[var(--line)]"><Table className="w-full min-w-[680px] text-sm"><TableBody>{metadataRows.map(([label, item]) => <TableRow key={label} className="border-t border-[var(--line)] first:border-t-0"><TableHead className="w-52 bg-white/35 p-4 text-left text-[var(--muted)]">{label}</TableHead><TableCell className="p-4">{value(item, i18n)}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="mt-4 text-sm text-[var(--muted)]">{i18n.t("adminUi.metadataUnavailableIndependent")}</p>}
        <div className="mt-5 space-y-2">{upload.metadataAttempts.map((attempt) => <Card as="article" key={attempt.attemptNumber} className="border border-[var(--line)] bg-white/35 p-4 text-xs"><div className="flex flex-wrap justify-between gap-3"><p className="font-bold">{i18n.t("adminUi.metadata")} #{attempt.attemptNumber} · {attempt.parserName} {attempt.parserVersion}</p><span className="font-bold uppercase">{i18n.state("metadata_attempt.status", attempt.status)}</span></div><p className="mt-2 text-[var(--muted)]">{i18n.t("adminUi.ranges", { count: attempt.rangeRequestCount })} · {i18n.bytes(attempt.bytesRead)}/{i18n.bytes(16_777_216)} · {attempt.errorCode ? i18n.error(attempt.errorCode) : i18n.t("participantUi.noWarning")} · {value(attempt.startedAt, i18n)} → {value(attempt.completedAt, i18n)}</p></Card>)}</div>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-2">
        <Card as="article"><h2 className="display text-2xl font-semibold">{i18n.t("adminUi.fieldEvidence")}</h2><div className="mt-4 space-y-2">{upload.evidence.map((item) => <div key={item.fieldName} className="border border-[var(--line)] bg-white/35 p-4 text-xs"><p className="font-bold">{item.fieldName}: {JSON.stringify(item.normalizedValue)}</p><p className="mt-1 break-all text-[var(--muted)]">{item.parserName} · {item.source}</p></div>)}{upload.evidence.length === 0 ? <p className="text-sm text-[var(--muted)]">{i18n.t("adminUi.noAllowlistEvidence")}</p> : null}</div></Card>
        <Card as="article"><h2 className="display text-2xl font-semibold">{i18n.t("adminUi.relatedReviews")}</h2><div className="mt-4 space-y-3">{upload.relatedReviews.map((review) => <Link key={review.publicId} href={`/review/${review.publicId}`} className="block border border-[var(--line)] bg-white/35 p-4 font-bold">{review.publicId} · {i18n.label("reviewCaseType", review.caseType)} · {i18n.state("review_case.status", review.status)}{review.isFixture ? ` · ${i18n.t("adminUi.demoData")}` : ""}</Link>)}{upload.relatedReviews.length === 0 ? <p className="text-sm text-[var(--muted)]">{i18n.t("adminUi.noRelatedReviews")}</p> : null}</div></Card>
      </section>
    </main>
  );
}
