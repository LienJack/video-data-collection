import Link from "next/link";
import { AcknowledgeButton } from "@/app/participant/tasks/[assignmentPublicId]/acknowledge-button";
import { SessionCreate } from "@/app/participant/tasks/[assignmentPublicId]/session-create";
import { criterionDisplayStatus } from "@/src/domain/task-instructions";
import { requireParticipant } from "@/src/server/auth";
import { getParticipantAssignment } from "@/src/server/services/tasks";
import { listParticipantDevices, listParticipantSessions } from "@/src/server/services/sessions";

export const dynamic = "force-dynamic";

export default async function ParticipantAssignmentPage({ params }: { params: Promise<{ assignmentPublicId: string }> }) {
  const viewer = await requireParticipant();
  const { assignmentPublicId } = await params;
  const [assignment, devices, sessions] = await Promise.all([
    getParticipantAssignment(viewer, assignmentPublicId),
    listParticipantDevices(viewer),
    listParticipantSessions(viewer, assignmentPublicId),
  ]);
  const instructions = assignment.instructions;
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8">
      <Link href="/participant/tasks" className="text-sm font-bold text-[var(--teal)]">← 我的任务</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <p className="text-xs font-bold text-[var(--signal)]">{assignment.publicId} · Version {assignment.taskVersion} · {assignment.status}</p>
        <h1 className="display mt-3 text-4xl font-semibold">{instructions.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{instructions.description}</p>
        <p className="mt-4 break-all font-mono text-[10px] text-[var(--muted)]">content_hash {assignment.contentHash}</p>
      </header>
      <section className="py-8">
        <h2 className="display text-2xl font-semibold">录制步骤</h2>
        <ol className="mt-5 space-y-4">{instructions.recordingGuide.steps.map((step) => <li key={step.order} className="grid grid-cols-[40px_1fr] gap-3"><span className="flex h-8 w-8 items-center justify-center bg-[var(--ink)] font-bold text-[var(--paper)]">{step.order}</span><div><p className="font-semibold">{step.instruction}</p><p className="mt-2 text-xs leading-6 text-[var(--muted)]">预期证据：{step.expectedVisualEvidence.join("、") || "—"}</p></div></li>)}</ol>
      </section>
      <section className="border-y border-[var(--line)] py-8">
        <h2 className="display text-2xl font-semibold">完成条件</h2>
        <div className="mt-5 space-y-3">{instructions.completionCriteria.map((criterion) => { const displayStatus = criterionDisplayStatus(criterion.validator); return <article key={criterion.code} className="border border-[var(--line)] bg-white/35 p-4"><p className="font-semibold">{criterion.description}</p><p className="mt-2 text-xs text-[var(--muted)]">{displayStatus}{criterion.validator === "future_cv" ? " · 本 MVP 未自动检查" : ""}</p></article>; })}</div>
      </section>
      <section className="py-8">
        <h2 className="display text-2xl font-semibold">隐私检查</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">{instructions.privacyChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
        {assignment.status === "assigned" ? <AcknowledgeButton assignmentPublicId={assignment.publicId} contentHash={assignment.contentHash} /> : <p className="mt-8 border-l-4 border-[var(--teal)] px-4 py-3 text-sm">已确认版本：{assignment.acknowledgedAt?.toLocaleString("zh-CN") || assignment.status}</p>}
        {["acknowledged", "session_created", "rework_required"].includes(assignment.status) ? <SessionCreate assignmentPublicId={assignment.publicId} devices={devices} /> : null}
        {sessions.length > 0 ? <div className="mt-8"><h2 className="display text-2xl font-semibold">Recording Sessions</h2><div className="mt-4 space-y-3">{sessions.map((session) => <Link key={session.publicId} href={`/participant/sessions/${session.publicId}`} className="block border border-[var(--line)] bg-white/35 p-4"><p className="font-bold">{session.publicId} · {session.status}</p><p className="mt-2 text-xs text-[var(--muted)]">{session.deviceLabel} · Marker {session.markerAcknowledgedAt ? "已确认" : "待确认"}</p></Link>)}</div></div> : null}
      </section>
    </main>
  );
}
