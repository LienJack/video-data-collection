import Link from "next/link";
import { requireParticipant } from "@/lib/auth";
import { listParticipantAssignments } from "@egocapture/core/server/services/tasks";

export const dynamic = "force-dynamic";

export default async function ParticipantTasksPage() {
  const viewer = await requireParticipant();
  const assignments = await listParticipantAssignments(viewer);
  return (
    <main className="content-page max-w-3xl">
      <p className="page-kicker">Participant field app</p>
      <h1 className="page-title">你好，{viewer.displayName}</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">每个任务固定到发布时的 TaskVersion；后续 Draft 修改不会改变你已收到的说明。</p>
      <Link href="/uploads" className="primary-action mt-6">上传录制文件 →</Link>
      <div className="mt-10 space-y-4">
        {assignments.map((assignment) => (
          <Link key={assignment.publicId} href={`/tasks/${assignment.publicId}`} className="surface-solid block p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow)]">
            <div className="flex justify-between gap-4"><p className="text-xs font-bold text-[var(--signal)]">{assignment.publicId}</p><span className="status-pill">{assignment.status}</span></div>
            <h2 className="display mt-4 text-3xl font-semibold">{assignment.taskTitle}</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">Version {assignment.taskVersion} · Due {assignment.dueAt.toLocaleString("zh-CN")}</p>
          </Link>
        ))}
        {assignments.length === 0 ? <div className="empty-state text-sm leading-7">目前没有分配给你的任务。</div> : null}
      </div>
    </main>
  );
}
