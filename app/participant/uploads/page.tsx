import Link from "next/link";
import { UploadQueue } from "@/app/participant/uploads/upload-queue";
import { requireParticipant } from "@/src/server/auth";
import { listParticipantSessions } from "@/src/server/services/sessions";
import { listParticipantUploads } from "@/src/server/services/uploads";

export const dynamic = "force-dynamic";

export default async function ParticipantUploadsPage() {
  const viewer = await requireParticipant();
  const [sessions, uploads] = await Promise.all([
    listParticipantSessions(viewer),
    listParticipantUploads(viewer),
  ]);
  const openSessions = sessions.filter((session) => session.status === "open");
  return (
    <main className="content-page max-w-3xl">
      <Link href="/participant/tasks" className="text-sm font-bold text-[var(--teal)]">← 我的任务</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <p className="page-kicker">Direct TUS upload</p>
        <h1 className="page-title">上传录制文件</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">视频字节从浏览器直达私有 Supabase Storage；Next.js 只签发单对象凭据并在完成后检查对象和大小。</p>
      </header>
      <UploadQueue sessions={openSessions.map((session) => ({
        publicId: session.publicId,
        assignmentPublicId: session.assignmentPublicId,
        taskTitle: session.taskTitle,
        deviceLabel: session.deviceLabel,
      }))} />
      <section className="mt-12 border-t border-[var(--line)] pt-8">
        <h2 className="display text-2xl font-semibold">最近上传</h2>
        <div className="mt-4 space-y-3">
          {uploads.map((upload) => <Link key={upload.publicId} href={`/participant/uploads/${upload.publicId}`} className="block border border-[var(--line)] bg-white/35 p-4"><div className="flex justify-between gap-3"><p className="break-all font-bold">{upload.originalFilename}</p><span className="text-xs font-bold uppercase">{upload.transferStatus}</span></div><p className="mt-2 text-xs text-[var(--muted)]">{upload.publicId} · metadata {upload.metadataStatus} · {upload.claimedSessionPublicId || "Unable to Determine"}</p></Link>)}
          {uploads.length === 0 ? <p className="border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">还没有 UploadIntent。</p> : null}
        </div>
      </section>
    </main>
  );
}
