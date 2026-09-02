import { buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import { Badge } from "@egocapture/ui/components/badge";
import Link from "next/link";
import { requireParticipant } from "@/lib/auth";
import { listParticipantAssignments } from "@egocapture/core/server/services/tasks";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

export default async function ParticipantTasksPage() {
  const [viewer, locale] = await Promise.all([requireParticipant(), requestLocale()]);
  const [assignments, i18n] = await Promise.all([listParticipantAssignments(viewer), Promise.resolve(createTranslator(locale))]);
  return (
    <main className="content-page max-w-3xl">
      <p className="page-kicker">{i18n.t("participantUi.tasksKicker")}</p>
      <h1 className="page-title">{i18n.t("participantUi.greeting", { name: viewer.displayName })}</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">{i18n.t("participantUi.tasksImmutable")}</p>
      <Link href="/uploads" className={buttonVariants({ className: " mt-6" })}>{i18n.t("participantUi.uploadRecordedFiles")} →</Link>
      <div className="mt-10 space-y-4">
        {assignments.map((assignment) => (
          <Link key={assignment.publicId} href={`/tasks/${assignment.publicId}`} className="rounded-xl border bg-card text-card-foreground shadow-sm block p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow)]">
            <div className="flex justify-between gap-4"><p className="text-xs font-bold text-[var(--signal)]">{assignment.publicId}</p><Badge>{i18n.state("assignment.status", assignment.status)}</Badge></div>
            <h2 className="display mt-4 text-3xl font-semibold">{assignment.taskTitle}</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">{i18n.t("common.version", { value: assignment.taskVersion })} · {i18n.t("common.dueAt")} {i18n.date(assignment.dueAt, { dateStyle: "medium", timeStyle: "short" })}</p>
          </Link>
        ))}
        {assignments.length === 0 ? <Empty><EmptyDescription>{i18n.t("participantUi.noAssignments")}</EmptyDescription></Empty> : null}
      </div>
    </main>
  );
}
