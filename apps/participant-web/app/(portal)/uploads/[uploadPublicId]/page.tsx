import { Card } from "@egocapture/ui/components/card";
import Link from "next/link";
import { requireParticipant } from "@/lib/auth";
import { getParticipantUpload } from "@egocapture/core/server/services/uploads";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

export default async function ParticipantUploadPage({ params }: { params: Promise<{ uploadPublicId: string }> }) {
  const [viewer, { uploadPublicId }, locale] = await Promise.all([requireParticipant(), params, requestLocale()]);
  const i18n = createTranslator(locale);
  const upload = await getParticipantUpload(viewer, uploadPublicId);
  const statusLayers = [
    [i18n.t("participantUi.transfer"), i18n.state("upload_intent.transfer_status", upload.transferStatus)],
    [i18n.t("participantUi.objectReconciliation"), upload.transferStatus === "verified" ? i18n.state("upload_intent.transfer_status", "verified") : upload.failureCode ? i18n.error(upload.failureCode) : i18n.state("upload_intent.metadata_status", "pending")],
    [i18n.t("participantUi.metadata"), i18n.state("upload_intent.metadata_status", upload.metadataStatus)],
    [i18n.t("participantUi.match"), upload.asset?.decisionType ? i18n.label("matchDecision", upload.asset.decisionType) : i18n.label("matchDecision", "pending")],
  ];
  return (
    <main className="content-page max-w-3xl">
      <Link href="/uploads" className="text-sm font-bold text-[var(--teal)]">← {i18n.t("participantUi.uploadList")}</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7"><p className="page-kicker">{upload.uploadPublicId}</p><h1 className="page-title break-all">{upload.originalFilename}</h1><p className="mt-3 text-sm text-[var(--muted)]">{i18n.bytes(upload.sizeBytes)} · {upload.contentType}</p></header>
      <section className="mt-8 grid gap-3 sm:grid-cols-2">{statusLayers.map(([label, status]) => <Card as="article" key={label} className="border border-[var(--line)] bg-white/40 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p><p className="display mt-2 text-2xl font-semibold">{status}</p></Card>)}</section>
      <section className="mt-10"><h2 className="display text-2xl font-semibold">{i18n.t("participantUi.uploadAttempts")}</h2><div className="mt-4 space-y-3">{upload.attempts.map((attempt) => <Card as="article" key={attempt.publicId} className="border border-[var(--line)] bg-white/35 p-4"><div className="flex justify-between gap-3"><p className="font-bold">#{attempt.attemptNumber} · {attempt.publicId}</p><span className="text-xs font-bold uppercase">{i18n.state("upload_attempt.status", attempt.status)}</span></div><p className="mt-2 text-xs text-[var(--muted)]">{i18n.bytes(attempt.bytesUploaded)} · {i18n.t("common.expiresAt")} {attempt.expiresAt ? i18n.date(attempt.expiresAt, { dateStyle: "medium", timeStyle: "short" }) : "—"} · {attempt.errorCode ? i18n.error(attempt.errorCode) : i18n.t("participantUi.noError")}</p></Card>)}</div></section>
      {upload.asset ? <section className="mt-10"><h2 className="display text-2xl font-semibold">{i18n.t("participantUi.lightweightMetadata")}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Card as="article" className="border border-[var(--line)] bg-white/35 p-4"><p className="text-xs font-bold uppercase text-[var(--muted)]">{i18n.t("participantUi.containerCodec")}</p><p className="mt-2 font-bold">{upload.asset.containerFormat || i18n.t("participantUi.metadataUnavailable")} · {upload.asset.videoCodec || "—"}</p><p className="mt-2 text-xs text-[var(--muted)]">{upload.asset.width && upload.asset.height ? `${upload.asset.width} × ${upload.asset.height}` : i18n.t("participantUi.resolutionUnavailable")} · {upload.asset.frameRate ? `${upload.asset.frameRate} FPS` : i18n.t("participantUi.fpsUnavailable")}</p></Card><Card as="article" className="border border-[var(--line)] bg-white/35 p-4"><p className="text-xs font-bold uppercase text-[var(--muted)]">{i18n.t("participantUi.evidence")}</p><p className="mt-2 font-bold">{i18n.t("common.device")} {upload.asset.deviceConsistency ? i18n.label("deviceConsistency", upload.asset.deviceConsistency) : i18n.state("upload_intent.metadata_status", "pending")}</p><p className="mt-2 text-xs text-[var(--muted)]">{i18n.t("participantUi.captureTime")}: {upload.asset.captureTimeSource ? i18n.label("captureTimeSource", upload.asset.captureTimeSource) : i18n.t("common.unknown")} · {i18n.t("participantUi.reviewCount", { count: upload.asset.reviewCount })}</p></Card></div><div className="mt-3 space-y-2">{upload.metadataAttempts.map((attempt) => <p key={attempt.attemptNumber} className="border border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">{i18n.t("participantUi.metadata")} #{attempt.attemptNumber} · {i18n.state("metadata_attempt.status", attempt.status)} · {i18n.t("participantUi.metadataRanges", { count: attempt.rangeRequestCount })} · {i18n.bytes(attempt.bytesRead)}/{i18n.bytes(16_777_216)} · {attempt.errorCode ? i18n.error(attempt.errorCode) : i18n.t("participantUi.noWarning")}</p>)}</div></section> : null}
    </main>
  );
}
