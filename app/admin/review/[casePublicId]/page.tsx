import Link from "next/link";
import { ReviewDecisionPanel } from "@/app/admin/review/[casePublicId]/review-decision-panel";
import { requireAdmin } from "@egocapture/core/server/auth";
import { getReviewCase } from "@egocapture/core/server/services/review";

export const dynamic = "force-dynamic";

export default async function ReviewCasePage({ params }: { params: Promise<{ casePublicId: string }> }) {
  const viewer = await requireAdmin();
  const { casePublicId } = await params;
  const review = await getReviewCase(viewer, casePublicId);
  return (
    <main className="app-page">
      <Link href="/admin/review" className="text-sm font-bold text-[var(--teal)]">← Review Queue</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <div className="flex flex-wrap items-center gap-3"><p className="text-xs font-bold text-[var(--signal)]">{review.publicId}</p>{review.isFixture ? <span className="bg-[var(--yellow)] px-2 text-xs font-bold">Demo Fixture</span> : null}</div>
        <h1 className="page-title">{review.caseType}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{review.participantAlias || "Unknown"} · {review.participantPublicId || "—"} · {review.status}</p>
      </header>
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        {[["Transfer", review.transferStatus], ["Metadata", review.metadataStatus], ["Device", review.deviceConsistency], ["Assignment", review.assignmentPublicId]].map(([label, value]) => <article key={label} className="border border-[var(--line)] bg-white/35 p-4"><p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p><p className="mt-2 break-all font-bold">{value || "—"}</p></article>)}
      </section>
      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section>
          <h2 className="display text-2xl font-semibold">MatchDecision 历史</h2>
          <div className="mt-4 space-y-3">{review.decisions.map((decision) => <article key={decision.id} className="border border-[var(--line)] bg-white/35 p-5"><div className="flex flex-wrap justify-between gap-3"><p className="font-bold">{decision.decisionType}</p><span className="text-xs text-[var(--muted)]">{decision.decidedAt.toLocaleString("zh-CN")}</span></div><p className="mt-2 text-sm">Session {decision.sessionPublicId || "Unmatched"} · Device {decision.devicePublicId || "—"}</p><p className="mt-2 text-xs text-[var(--muted)]">{decision.reason || "Participant claim"} · supersedes {decision.supersedesDecisionId || "none"} · {decision.supersededBy ? "historical" : "current"}</p></article>)}{review.decisions.length === 0 ? <p className="text-sm text-[var(--muted)]">没有 MatchDecision。</p> : null}</div>
          {review.uploadPublicId ? <Link href={`/admin/uploads/${review.uploadPublicId}`} className="mt-6 inline-block font-bold text-[var(--teal)]">查看 Upload 详情 →</Link> : null}
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
          sessions={review.sessions.map((session) => ({ publicId: session.publicId, label: `${session.publicId} · ${session.taskTitle} · ${session.status}` }))}
          devices={review.devices.map((device) => ({ publicId: device.publicId, label: `${device.publicId} · ${device.manufacturer} ${device.model}` }))}
        />
      </div>
    </main>
  );
}
