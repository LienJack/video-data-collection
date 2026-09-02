import Link from "next/link";
import { UploadQueue } from "@/app/(portal)/uploads/upload-queue";
import { resolveUploadSessionContext } from "@/app/(portal)/uploads/upload-session-context";
import { requireParticipant } from "@/lib/auth";
import { listParticipantSessions } from "@egocapture/core/server/services/sessions";
import { listParticipantUploads } from "@egocapture/core/server/services/uploads";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

export default async function ParticipantUploadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewer, locale] = await Promise.all([requireParticipant(), requestLocale()]);
  const i18n = createTranslator(locale);
  const [sessions, uploads, query] = await Promise.all([
    listParticipantSessions(viewer),
    listParticipantUploads(viewer),
    searchParams,
  ]);
  const openSessions = sessions.filter((session) => session.status === "open");
  const sessionContext = resolveUploadSessionContext(query.session, sessions);
  return (
    <main className="content-page max-w-3xl">
      <Link href="/tasks" className="text-sm font-bold text-[var(--teal)]">← {i18n.t("participantUi.myTasks")}</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <p className="page-kicker">{i18n.t("participantUi.directUpload")}</p>
        <h1 className="page-title">{i18n.t("participantUi.uploadRecordedFiles")}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{i18n.t("participantUi.uploadPageBody")}</p>
      </header>
      {sessionContext.kind === "invalid" ? (
        <section role="alert" className="mt-8 border-l-4 border-[var(--signal)] px-4 py-3">
          <h2 className="font-bold">{i18n.t("participantUi.invalidSessionTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{i18n.t("participantUi.invalidSessionBody")}</p>
          <Link href="/tasks" className="mt-4 inline-block text-sm font-bold text-[var(--teal)]">{i18n.t("participantUi.backToTasks")} →</Link>
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
        <h2 className="display text-2xl font-semibold">{i18n.t("participantUi.recentUploads")}</h2>
        <div className="mt-4 space-y-3">
          {uploads.map((upload) => <Link key={upload.publicId} href={`/uploads/${upload.publicId}`} className="block border border-[var(--line)] bg-white/35 p-4"><div className="flex justify-between gap-3"><p className="break-all font-bold">{upload.originalFilename}</p><span className="text-xs font-bold uppercase">{i18n.state("upload_intent.transfer_status", upload.transferStatus)}</span></div><p className="mt-2 text-xs text-[var(--muted)]">{upload.publicId} · {i18n.t("participantUi.metadata")} {i18n.state("upload_intent.metadata_status", upload.metadataStatus)} · {upload.claimedSessionPublicId || i18n.t("participantUi.unableDetermine")}</p></Link>)}
          {uploads.length === 0 ? <p className="border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">{i18n.t("participantUi.noUploads")}</p> : null}
        </div>
      </section>
    </main>
  );
}
