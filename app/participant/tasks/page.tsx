import Link from "next/link";
import { requireParticipant } from "@/src/server/auth";
import { listParticipantAssignments } from "@/src/server/services/tasks";

export const dynamic = "force-dynamic";

export default async function ParticipantTasksPage() {
  const viewer = await requireParticipant();
  const assignments = await listParticipantAssignments(viewer);
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--teal)]">Participant field app</p>
      <h1 className="display mt-3 text-4xl font-semibold">你好，{viewer.displayName}</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">每个任务固定到发布时的 TaskVersion；后续 Draft 修改不会改变你已收到的说明。</p>
      <Link href="/participant/uploads" className="mt-5 inline-block border border-[var(--ink)] px-4 py-3 text-sm font-bold">上传录制文件 →</Link>
      <div className="mt-10 space-y-4">
        {assignments.map((assignment) => (
          <Link key={assignment.publicId} href={`/participant/tasks/${assignment.publicId}`} className="block border border-[var(--line)] bg-white/40 p-6">
            <div className="flex justify-between gap-4"><p className="text-xs font-bold text-[var(--signal)]">{assignment.publicId}</p><span className="text-xs font-bold uppercase">{assignment.status}</span></div>
            <h2 className="display mt-4 text-3xl font-semibold">{assignment.taskTitle}</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">Version {assignment.taskVersion} · Due {assignment.dueAt.toLocaleString("zh-CN")}</p>
          </Link>
        ))}
        {assignments.length === 0 ? <div className="border border-dashed border-[var(--line)] bg-white/30 p-8 text-sm leading-7 text-[var(--muted)]">目前没有分配给你的任务。</div> : null}
      </div>
    </main>
  );
}
