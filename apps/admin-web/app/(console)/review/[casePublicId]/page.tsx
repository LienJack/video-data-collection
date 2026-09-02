import { Card } from "@egocapture/ui/components/card";
import Link from "next/link";
import { ReviewDecisionPanel } from "@/app/(console)/review/[casePublicId]/review-decision-panel";
import { requireAdmin } from "@/lib/auth";
import { getReviewCase } from "@egocapture/core/server/services/review";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

export default async function ReviewCasePage({ params }: { params: Promise<{ casePublicId: string }> }) {
  const viewer = await requireAdmin();
  const locale = await requestLocale();
  const i18n = createTranslator(locale);
  const { casePublicId } = await params;
  const review = await getReviewCase(viewer, casePublicId);
  return (
    <main className="app-page">
      <Link href="/review" className="text-sm font-bold text-[var(--teal)]">← {i18n.t("adminUi.reviewBack")}</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <div className="flex flex-wrap items-center gap-3"><p className="text-xs font-bold text-[var(--signal)]">{review.publicId}</p>{review.isFixture ? <span className="bg-[var(--yellow)] px-2 text-xs font-bold">{i18n.t("adminUi.demoData")}</span> : null}</div>
        <h1 className="page-title">{i18n.label("reviewCaseType", review.caseType)}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{review.participantAlias || i18n.t("common.unknown")} · {review.participantPublicId || "—"} · {i18n.state("review_case.status", review.status)}</p>
      </header>
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        {[[i18n.t("adminUi.transfer"), review.transferStatus ? i18n.state("upload_intent.transfer_status", review.transferStatus) : null], [i18n.t("adminUi.metadata"), review.metadataStatus ? i18n.state("upload_intent.metadata_status", review.metadataStatus) : null], [i18n.t("common.device"), review.deviceConsistency ? i18n.label("deviceConsistency", review.deviceConsistency) : null], [i18n.t("adminUi.assignment"), review.assignmentPublicId]].map(([label, value]) => <Card as="article" key={label} className="border border-[var(--line)] bg-white/35 p-4"><p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p><p className="mt-2 break-all font-bold">{value || "—"}</p></Card>)}
      </section>
      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section>
          <h2 className="display text-2xl font-semibold">{i18n.t("adminUi.matchHistory")}</h2>
          <div className="mt-4 space-y-3">{review.decisions.map((decision) => <Card as="article" key={decision.id} className="border border-[var(--line)] bg-white/35 p-5"><div className="flex flex-wrap justify-between gap-3"><p className="font-bold">{i18n.label("matchDecision", decision.decisionType)}</p><span className="text-xs text-[var(--muted)]">{i18n.date(decision.decidedAt)}</span></div><p className="mt-2 text-sm">{i18n.t("adminUi.sessionLabel", { value: decision.sessionPublicId || i18n.t("adminUi.unmatchedValue") })} · {i18n.t("adminUi.deviceConsistency", { value: decision.devicePublicId || "—" })}</p><p className="mt-2 text-xs text-[var(--muted)]">{decision.reason || i18n.t("adminUi.participantClaim")} · {i18n.t("adminUi.supersedes", { value: decision.supersedesDecisionId || i18n.t("common.none") })} · {decision.supersededBy ? i18n.t("adminUi.historical") : i18n.t("adminUi.current")}</p></Card>)}{review.decisions.length === 0 ? <p className="text-sm text-[var(--muted)]">{i18n.t("adminUi.noMatchDecisions")}</p> : null}</div>
          {review.uploadPublicId ? <Link href={`/uploads/${review.uploadPublicId}`} className="mt-6 inline-block font-bold text-[var(--teal)]">{i18n.t("adminUi.viewUpload")} →</Link> : null}
        </section>
        <ReviewDecisionPanel
          reviewPublicId={review.publicId}
          uploadPublicId={review.uploadPublicId}
          currentReviewStatus={review.status}
          currentSessionPublicId={review.currentSessionPublicId}
          currentDevicePublicId={review.currentDevicePublicId}
          participantStatus={review.participantStatus}
          assignmentStatus={review.assignmentStatus}
          assignmentDueAt={review.assignmentDueAt?.toISOString() ?? null}
          assetStatus={review.assetStatus}
          terminal={!['open', 'in_review'].includes(review.status)}
          sessions={review.sessions.map((session) => ({ publicId: session.publicId, label: `${session.publicId} · ${session.taskTitle} · ${i18n.state("recording_session.status", session.status)}` }))}
          devices={review.devices.map((device) => ({ publicId: device.publicId, label: `${device.publicId} · ${device.manufacturer} ${device.model}` }))}
        />
      </div>
    </main>
  );
}
