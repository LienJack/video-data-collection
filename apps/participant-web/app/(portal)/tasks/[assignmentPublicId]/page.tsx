import { Card } from "@egocapture/ui/components/card";
import Link from "next/link";
import { AcknowledgeButton } from "@/app/(portal)/tasks/[assignmentPublicId]/acknowledge-button";
import { SessionCreate } from "@/app/(portal)/tasks/[assignmentPublicId]/session-create";
import { criterionDisplayStatus } from "@egocapture/core/domain/task-instructions";
import { requireParticipant } from "@/lib/auth";
import { getParticipantAssignment } from "@egocapture/core/server/services/tasks";
import { listParticipantDevices, listParticipantSessions } from "@egocapture/core/server/services/sessions";

export const dynamic = "force-dynamic";

const uploadSourceLabels: Record<string, string> = {
  camera: "相机 / 运动相机",
  ssd: "外接 SSD",
  mobile: "手机",
  desktop: "电脑",
  other: "其他外部存储",
};

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `约 ${minutes} 分钟` : `约 ${(minutes / 60).toFixed(1)} 小时`;
}

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
    <main className="content-page max-w-3xl">
      <Link href="/tasks" className="text-sm font-bold text-[var(--teal)]">← 我的任务</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <p className="text-xs font-bold text-[var(--signal)]">{assignment.publicId} · Version {assignment.taskVersion} · {assignment.status}</p>
        <h1 className="page-title">{instructions.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{instructions.description}</p>
        <p className="mt-4 text-sm font-semibold">目标时长：{formatDuration(instructions.recordingSpec.targetDurationSec)}（允许 ±{formatDuration(instructions.recordingSpec.durationToleranceSec).replace("约 ", "")}）</p>
        <p className="mt-4 break-all font-mono text-[10px] text-[var(--muted)]">content_hash {assignment.contentHash}</p>
      </header>
      {instructions.environmentSetup.length || instructions.areaConstraints.length || instructions.requiredObjects.length ? (
        <section className="grid gap-6 border-b border-[var(--line)] py-8 sm:grid-cols-2">
          {instructions.environmentSetup.length || instructions.areaConstraints.length ? <div>
            <h2 className="display text-2xl font-semibold">环境与活动范围</h2>
            {instructions.environmentSetup.length ? <><h3 className="mt-4 font-bold">环境准备</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">{instructions.environmentSetup.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
            {instructions.areaConstraints.length ? <><h3 className="mt-4 font-bold">活动范围</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">{instructions.areaConstraints.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
          </div> : null}
          {instructions.requiredObjects.length ? <div>
            <h2 className="display text-2xl font-semibold">必需物品</h2>
            <ul className="mt-4 space-y-3 text-sm">{instructions.requiredObjects.map((item) => <li key={item.code} className="border-l-2 border-[var(--teal)] pl-3"><span className="font-semibold">{item.label}</span><span className="ml-2 text-xs text-[var(--muted)]">{item.mustBeVisible ? "需要入镜" : "无需特意入镜"}</span></li>)}</ul>
          </div> : null}
        </section>
      ) : null}
      <section className="py-8">
        <h2 className="display text-2xl font-semibold">录制步骤</h2>
        {instructions.recordingGuide.steps.length ? <ol className="mt-5 space-y-4">{instructions.recordingGuide.steps.map((step) => <li key={step.order} className="grid grid-cols-[40px_1fr] gap-3"><span className="flex h-8 w-8 items-center justify-center bg-[var(--ink)] font-bold text-[var(--paper)]">{step.order}</span><div><p className="font-semibold">{step.instruction}</p><p className="mt-2 text-xs leading-6 text-[var(--muted)]">预期证据：{step.expectedVisualEvidence.join("、") || "—"}</p></div></li>)}</ol> : <p className="mt-4 text-sm text-[var(--muted)]">按任务描述完成活动，并保持连续录制。</p>}
        {instructions.recordingGuide.mustShow.length || instructions.recordingGuide.mustAvoid.length ? <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {instructions.recordingGuide.mustShow.length ? <div className="border border-[var(--line)] bg-white/35 p-4"><h3 className="font-bold">必须展示</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{instructions.recordingGuide.mustShow.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          {instructions.recordingGuide.mustAvoid.length ? <div className="border border-[var(--line)] bg-white/35 p-4"><h3 className="font-bold">必须避开</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{instructions.recordingGuide.mustAvoid.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        </div> : null}
        {instructions.recordingGuide.otherConstraints.length ? <div className="mt-4 border border-[var(--line)] bg-white/35 p-4"><h3 className="font-bold">其他录制约束</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{instructions.recordingGuide.otherConstraints.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        <div className="mt-4 border border-[var(--line)] bg-[var(--yellow)]/25 p-4 text-sm leading-6">
          <p><span className="font-bold">目标规格：</span>{instructions.recordingSpec.targetResolution} · {instructions.recordingSpec.targetFps} FPS · 头戴式第一人称视角</p>
          <p className="mt-2"><span className="font-bold">Session Marker：</span>{instructions.recordingGuide.sessionMarker.instruction}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{instructions.recordingGuide.sessionMarker.required ? `必须展示并保持至少 ${instructions.recordingGuide.sessionMarker.holdSeconds} 秒` : "可选展示"}</p>
        </div>
      </section>
      <section className="border-t border-[var(--line)] py-8">
        <h2 className="display text-2xl font-semibold">上传与恢复</h2>
        <p className="mt-3 text-sm"><span className="font-bold">允许来源：</span>{instructions.uploadGuide.allowedSources.map((source) => uploadSourceLabels[source] ?? source).join("、")}</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div><h3 className="font-bold">上传说明</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">{instructions.uploadGuide.instructions.map((item) => <li key={item}>{item}</li>)}</ol></div>
          <div><h3 className="font-bold">中断后恢复</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">{instructions.uploadGuide.recoveryInstructions.map((item) => <li key={item}>{item}</li>)}</ol></div>
        </div>
        <div className="mt-5 border-l-4 border-[var(--teal)] px-4 py-2"><h3 className="font-bold">文件与任务匹配</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">{instructions.uploadGuide.matchingInstructions.map((item) => <li key={item}>{item}</li>)}</ol></div>
      </section>
      {instructions.completionCriteria.length ? <section className="border-y border-[var(--line)] py-8">
        <h2 className="display text-2xl font-semibold">完成条件</h2>
        <div className="mt-5 space-y-3">{instructions.completionCriteria.map((criterion) => { const displayStatus = criterionDisplayStatus(criterion.validator); return <Card as="article" key={criterion.code} className="border border-[var(--line)] bg-white/35 p-4"><p className="font-semibold">{criterion.description}</p><p className="mt-2 text-xs text-[var(--muted)]">{displayStatus === "manual_review" ? "人工审核" : "上传后进行 Metadata 检查"}</p></Card>; })}</div>
      </section> : null}
      <section className="py-8">
        {instructions.privacyChecklist.length ? <><h2 className="display text-2xl font-semibold">隐私检查</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-sm">{instructions.privacyChecklist.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
        {assignment.status === "assigned" ? <AcknowledgeButton assignmentPublicId={assignment.publicId} contentHash={assignment.contentHash} /> : <p className="mt-8 border-l-4 border-[var(--teal)] px-4 py-3 text-sm">已确认版本：{assignment.acknowledgedAt?.toLocaleString("zh-CN") || assignment.status}</p>}
        {["acknowledged", "session_created", "rework_required"].includes(assignment.status) ? <SessionCreate assignmentPublicId={assignment.publicId} devices={devices} /> : null}
        {sessions.length > 0 ? <div className="mt-8"><h2 className="display text-2xl font-semibold">Recording Sessions</h2><div className="mt-4 space-y-3">{sessions.map((session) => <Link key={session.publicId} href={`/sessions/${session.publicId}`} className="block border border-[var(--line)] bg-white/35 p-4"><p className="font-bold">{session.publicId} · {session.status}</p><p className="mt-2 text-xs text-[var(--muted)]">{session.deviceLabel} · Marker {session.markerAcknowledgedAt ? "已确认" : "待确认"}</p></Link>)}</div></div> : null}
      </section>
    </main>
  );
}
