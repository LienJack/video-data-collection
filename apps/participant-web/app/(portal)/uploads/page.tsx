import Link from "next/link";
import { UploadQueue } from "@/app/(portal)/uploads/upload-queue";
import { resolveUploadSessionContext } from "@/app/(portal)/uploads/upload-session-context";
import { requireParticipant } from "@/lib/auth";
import { listParticipantSessions } from "@egocapture/core/server/services/sessions";
import { listParticipantUploads } from "@egocapture/core/server/services/uploads";

export const dynamic = "force-dynamic";

export default async function ParticipantUploadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireParticipant();
  const [sessions, uploads, query] = await Promise.all([
    listParticipantSessions(viewer),
    listParticipantUploads(viewer),
    searchParams,
  ]);
  const openSessions = sessions.filter((session) => session.status === "open");
  const sessionContext = resolveUploadSessionContext(query.session, sessions);
  return (
    <main className="content-page max-w-3xl">
      <Link href="/tasks" className="text-sm font-bold text-[var(--teal)]">← 我的任务</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <p className="page-kicker">Direct TUS upload</p>
        <h1 className="page-title">上传录制文件</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">视频字节从浏览器直达私有 Supabase Storage；Next.js 只签发单对象凭据并在完成后检查对象和大小。</p>
      </header>
      {sessionContext.kind === "invalid" ? (
        <section role="alert" className="mt-8 border-l-4 border-[var(--signal)] px-4 py-3">
          <h2 className="font-bold">无法绑定该 Session</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">该 Session 不存在、不属于当前参与者或已经关闭。请返回任务页，从仍可上传的 Session 重新进入。</p>
          <Link href="/tasks" className="mt-4 inline-block text-sm font-bold text-[var(--teal)]">返回我的任务 →</Link>
        </section>
      ) : (
        <UploadQueue
          key={sessionContext.kind === "locked" ? `locked:${sessionContext.session.publicId}` : "generic"}
          sessions={openSessions.map((session) => ({
            publicId: session.publicId,
            assignmentPublicId: session.assignmentPublicId,
            taskTitle: session.taskTitle,
            deviceLabel: session.deviceLabel,
          }))}
          lockedSessionPublicId={sessionContext.kind === "locked" ? sessionContext.session.publicId : undefined}
        />
      )}
      <section className="mt-12 border-t border-[var(--line)] pt-8">
        <h2 className="display text-2xl font-semibold">最近上传</h2>
        <div className="mt-4 space-y-3">
          {uploads.map((upload) => <Link key={upload.publicId} href={`/uploads/${upload.publicId}`} className="block border border-[var(--line)] bg-white/35 p-4"><div className="flex justify-between gap-3"><p className="break-all font-bold">{upload.originalFilename}</p><span className="text-xs font-bold uppercase">{upload.transferStatus}</span></div><p className="mt-2 text-xs text-[var(--muted)]">{upload.publicId} · metadata {upload.metadataStatus} · {upload.claimedSessionPublicId || "Unable to Determine"}</p></Link>)}
          {uploads.length === 0 ? <p className="border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">还没有 UploadIntent。</p> : null}
        </div>
      </section>
    </main>
  );
}
