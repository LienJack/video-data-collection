import { SessionClose } from "@/app/admin/sessions/session-close";
import { requireAdmin } from "@/src/server/auth";
import { listAdminSessions } from "@/src/server/services/sessions";

export const dynamic = "force-dynamic";

export default async function AdminSessionsPage() {
  const viewer = await requireAdmin();
  const sessions = await listAdminSessions(viewer);
  return <main className="px-5 py-8 sm:px-10"><header className="border-b border-[var(--line)] pb-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--teal)]">Declared recording context</p><h1 className="display mt-2 text-5xl font-semibold">Recording Sessions</h1></header><div className="mt-8 grid gap-4 xl:grid-cols-2">{sessions.map((session) => <article key={session.publicId} className="border border-[var(--line)] bg-white/35 p-6"><div className="flex justify-between gap-4"><p className="text-xs font-bold text-[var(--signal)]">{session.publicId}</p><span className="text-xs font-bold uppercase">{session.status}</span></div><h2 className="display mt-4 text-2xl font-semibold">{session.taskTitle}</h2><p className="mt-3 text-sm">{session.participantAlias} · {session.participantPublicId}</p><p className="mt-2 text-xs text-[var(--muted)]">{session.deviceLabel} · {session.devicePublicId}</p><p className="mt-2 text-xs text-[var(--muted)]">Marker {session.markerAcknowledgedAt ? "已确认" : "待确认"} · {session.createdAt.toLocaleString("zh-CN")}</p>{session.status === "open" ? <SessionClose sessionPublicId={session.publicId} /> : null}</article>)}{sessions.length === 0 ? <p className="text-sm text-[var(--muted)]">尚无 Recording Session。</p> : null}</div></main>;
}
