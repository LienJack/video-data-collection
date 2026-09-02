import { buttonVariants } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import Image from "next/image";
import Link from "next/link";
import { AcknowledgeButton } from "@/app/(portal)/tasks/[assignmentPublicId]/acknowledge-button";
import { SessionCreate } from "@/app/(portal)/tasks/[assignmentPublicId]/session-create";
import { criterionDisplayStatus } from "@egocapture/core/domain/task-instructions";
import { requireParticipant } from "@/lib/auth";
import { getParticipantAssignment } from "@egocapture/core/server/services/tasks";
import { getMarker, listParticipantDevices, listParticipantSessions } from "@egocapture/core/server/services/sessions";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

export default async function ParticipantAssignmentPage({ params }: { params: Promise<{ assignmentPublicId: string }> }) {
  const [viewer, { assignmentPublicId }, locale] = await Promise.all([requireParticipant(), params, requestLocale()]);
  const i18n = createTranslator(locale);
  const assignment = await getParticipantAssignment(viewer, assignmentPublicId);
  const devices = await listParticipantDevices(viewer);
  const sessions = await listParticipantSessions(viewer, assignmentPublicId);
  const markers: Awaited<ReturnType<typeof getMarker>>[] = [];
  for (const session of sessions) {
    markers.push(await getMarker(viewer, session.publicId));
  }
  const instructions = assignment.instructions;
  const uploadSourceLabels: Record<string, string> = {
    camera: i18n.t("participantUi.sourceCamera"), ssd: i18n.t("participantUi.sourceSsd"), mobile: i18n.t("participantUi.sourceMobile"),
    desktop: i18n.t("participantUi.sourceDesktop"), other: i18n.t("participantUi.sourceOther"),
  };
  const joiner = locale === "en" ? ", " : "、";
  return (
    <main className="content-page max-w-3xl">
      <Link href="/tasks" className="text-sm font-bold text-[var(--teal)]">← {i18n.t("participantUi.myTasks")}</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <p className="text-xs font-bold text-[var(--signal)]">{assignment.publicId} · {i18n.t("common.version", { value: assignment.taskVersion })} · {i18n.state("assignment.status", assignment.status)}</p>
        <h1 className="page-title">{instructions.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{instructions.description}</p>
        <p className="mt-4 text-sm font-semibold">{i18n.t("participantUi.targetDuration", { duration: i18n.duration(instructions.recordingSpec.targetDurationSec), tolerance: i18n.duration(instructions.recordingSpec.durationToleranceSec) })}</p>
        <p className="mt-4 break-all font-mono text-[10px] text-[var(--muted)]">content_hash {assignment.contentHash}</p>
      </header>
      {instructions.environmentSetup.length || instructions.areaConstraints.length || instructions.requiredObjects.length ? (
        <section className="grid gap-6 border-b border-[var(--line)] py-8 sm:grid-cols-2">
          {instructions.environmentSetup.length || instructions.areaConstraints.length ? <div>
            <h2 className="display text-2xl font-semibold">{i18n.t("participantUi.environmentAndArea")}</h2>
            {instructions.environmentSetup.length ? <><h3 className="mt-4 font-bold">{i18n.t("participantUi.environmentSetup")}</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">{instructions.environmentSetup.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
            {instructions.areaConstraints.length ? <><h3 className="mt-4 font-bold">{i18n.t("participantUi.areaConstraints")}</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">{instructions.areaConstraints.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
          </div> : null}
          {instructions.requiredObjects.length ? <div>
            <h2 className="display text-2xl font-semibold">{i18n.t("participantUi.requiredObjects")}</h2>
            <ul className="mt-4 space-y-3 text-sm">{instructions.requiredObjects.map((item) => <li key={item.code} className="border-l-2 border-[var(--teal)] pl-3"><span className="font-semibold">{item.label}</span><span className="ml-2 text-xs text-[var(--muted)]">{item.mustBeVisible ? i18n.t("participantUi.mustBeVisible") : i18n.t("participantUi.needNotBeVisible")}</span></li>)}</ul>
          </div> : null}
        </section>
      ) : null}
      <section className="py-8">
        <h2 className="display text-2xl font-semibold">{i18n.t("participantUi.recordingSteps")}</h2>
        {instructions.recordingGuide.steps.length ? <ol className="mt-5 space-y-4">{instructions.recordingGuide.steps.map((step) => <li key={step.order} className="grid grid-cols-[40px_1fr] gap-3"><span className="flex h-8 w-8 items-center justify-center bg-[var(--ink)] font-bold text-[var(--paper)]">{step.order}</span><div><p className="font-semibold">{step.instruction}</p><p className="mt-2 text-xs leading-6 text-[var(--muted)]">{i18n.t("participantUi.expectedEvidence", { evidence: step.expectedVisualEvidence.join(joiner) || "—" })}</p></div></li>)}</ol> : <p className="mt-4 text-sm text-[var(--muted)]">{i18n.t("participantUi.defaultRecordingInstruction")}</p>}
        {instructions.recordingGuide.mustShow.length || instructions.recordingGuide.mustAvoid.length ? <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {instructions.recordingGuide.mustShow.length ? <div className="border border-[var(--line)] bg-white/35 p-4"><h3 className="font-bold">{i18n.t("participantUi.mustShow")}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{instructions.recordingGuide.mustShow.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          {instructions.recordingGuide.mustAvoid.length ? <div className="border border-[var(--line)] bg-white/35 p-4"><h3 className="font-bold">{i18n.t("participantUi.mustAvoid")}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{instructions.recordingGuide.mustAvoid.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        </div> : null}
        {instructions.recordingGuide.otherConstraints.length ? <div className="mt-4 border border-[var(--line)] bg-white/35 p-4"><h3 className="font-bold">{i18n.t("participantUi.otherRecordingConstraints")}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{instructions.recordingGuide.otherConstraints.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        <div className="mt-4 border border-[var(--line)] bg-[var(--yellow)]/25 p-4 text-sm leading-6">
          <p><span className="font-bold">{i18n.t("participantUi.targetSpec")}</span>{instructions.recordingSpec.targetResolution} · {instructions.recordingSpec.targetFps} FPS · {i18n.t("participantUi.firstPersonView")}</p>
          <p className="mt-2"><span className="font-bold">{i18n.t("participantUi.sessionMarker")}</span>{instructions.recordingGuide.sessionMarker.instruction}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{instructions.recordingGuide.sessionMarker.required ? i18n.t("participantUi.markerRequired", { seconds: instructions.recordingGuide.sessionMarker.holdSeconds }) : i18n.t("participantUi.markerOptional")}</p>
        </div>
      </section>
      <section className="border-t border-[var(--line)] py-8">
        <h2 className="display text-2xl font-semibold">{i18n.t("participantUi.uploadAndRecovery")}</h2>
        <p className="mt-3 text-sm"><span className="font-bold">{i18n.t("participantUi.allowedSources")}</span>{instructions.uploadGuide.allowedSources.map((source) => uploadSourceLabels[source] ?? source).join(joiner)}</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div><h3 className="font-bold">{i18n.t("participantUi.uploadInstructions")}</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">{instructions.uploadGuide.instructions.map((item) => <li key={item}>{item}</li>)}</ol></div>
          <div><h3 className="font-bold">{i18n.t("participantUi.recoveryInstructions")}</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">{instructions.uploadGuide.recoveryInstructions.map((item) => <li key={item}>{item}</li>)}</ol></div>
        </div>
        <div className="mt-5 border-l-4 border-[var(--teal)] px-4 py-2"><h3 className="font-bold">{i18n.t("participantUi.fileTaskMatching")}</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">{instructions.uploadGuide.matchingInstructions.map((item) => <li key={item}>{item}</li>)}</ol></div>
      </section>
      {instructions.completionCriteria.length ? <section className="border-y border-[var(--line)] py-8">
        <h2 className="display text-2xl font-semibold">{i18n.t("participantUi.completionCriteria")}</h2>
        <div className="mt-5 space-y-3">{instructions.completionCriteria.map((criterion) => { const displayStatus = criterionDisplayStatus(criterion.validator); return <Card as="article" key={criterion.code} className="border border-[var(--line)] bg-white/35 p-4"><p className="font-semibold">{criterion.description}</p><p className="mt-2 text-xs text-[var(--muted)]">{displayStatus === "manual_review" ? i18n.t("participantUi.manualReview") : i18n.t("participantUi.metadataCheck")}</p></Card>; })}</div>
      </section> : null}
      <section className="py-8">
        {instructions.privacyChecklist.length ? <><h2 className="display text-2xl font-semibold">{i18n.t("participantUi.privacyCheck")}</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-sm">{instructions.privacyChecklist.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
        {assignment.status === "assigned" ? <AcknowledgeButton assignmentPublicId={assignment.publicId} contentHash={assignment.contentHash} /> : <p className="mt-8 border-l-4 border-[var(--teal)] px-4 py-3 text-sm">{i18n.t("participantUi.acknowledgedVersion", { value: assignment.acknowledgedAt ? i18n.date(assignment.acknowledgedAt, { dateStyle: "medium", timeStyle: "short" }) : i18n.state("assignment.status", assignment.status) })}</p>}
        {["acknowledged", "session_created", "rework_required"].includes(assignment.status) ? <SessionCreate assignmentPublicId={assignment.publicId} devices={devices} /> : null}
        {sessions.length > 0 ? <div className="mt-8"><h2 className="display text-2xl font-semibold">{i18n.t("participantUi.showQrCode")}</h2><div className="mt-4 grid gap-5 sm:grid-cols-2">{sessions.map((session, index) => <Card as="article" key={session.publicId} className="gap-4 p-4"><div><Link href={`/sessions/${session.publicId}`} className="font-bold text-[var(--teal)]">{session.publicId} · {i18n.state("recording_session.status", session.status)}</Link><p className="mt-2 text-xs text-[var(--muted)]">{session.deviceLabel} · {i18n.t("participantUi.sessionMarker")} {session.markerAcknowledgedAt ? i18n.t("participantUi.markerAcknowledged") : i18n.t("participantUi.markerPending")}</p></div><div className="rounded-xl bg-white p-3"><Image src={markers[index].qrDataUrl} alt={i18n.t("participantUi.markerQrAlt", { session: session.publicId })} width={900} height={900} unoptimized className="mx-auto aspect-square w-full" /></div>{session.status === "open" ? <Link href={{ pathname: "/uploads", query: { session: session.publicId } }} className={buttonVariants({ className: "w-full" })}>{i18n.t("participantUi.uploadVideo")}</Link> : <span aria-disabled="true" className={buttonVariants({ className: "pointer-events-none w-full opacity-50" })}>{i18n.t("participantUi.uploadVideo")}</span>}</Card>)}</div></div> : null}
      </section>
    </main>
  );
}
