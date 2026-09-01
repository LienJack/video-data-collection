import { requireParticipant } from "@/src/server/auth";

export const dynamic = "force-dynamic";

export default async function ParticipantTasksPage() {
  const viewer = await requireParticipant();
  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--teal)]">Participant field app</p>
      <h1 className="display mt-3 text-4xl font-semibold">你好，{viewer.displayName}</h1>
      <div className="mt-10 border border-dashed border-[var(--line)] bg-white/30 p-8 text-sm leading-7 text-[var(--muted)]">
        身份会话已建立。任务将在 Participant 与 Assignment 切片中写入。
      </div>
    </main>
  );
}
