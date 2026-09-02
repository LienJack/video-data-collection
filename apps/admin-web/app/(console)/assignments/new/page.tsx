import { buttonVariants } from "@egocapture/ui/components/button";
import Link from "next/link";
import { AssignmentForm } from "@/app/(console)/assignments/new/assignment-form";
import { requireAdmin } from "@/lib/auth";
import { database } from "@egocapture/core/server/database";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  await requireAdmin();
  const locale = await requestLocale();
  const i18n = createTranslator(locale);
  const db = database();
  const [participants, versions, devices] = await Promise.all([
    db<{ publicId: string; displayAlias: string }[]>`
      select participant.public_id, participant.display_alias
      from egocapture.participants participant
      where participant.status = 'active' and participant.consent_status = 'valid'
      order by participant.display_alias
    `,
    db<{ taskPublicId: string; taskTitle: string; version: number }[]>`
      select task.public_id as task_public_id, version.instructions ->> 'title' as task_title, version.version
      from egocapture.task_versions version
      join egocapture.tasks task on task.id = version.task_id
      order by task.title, version.version desc
    `,
    db<{ publicId: string; label: string }[]>`
      select device.public_id, device.manufacturer || ' ' || device.model as label
      from egocapture.devices device
      where device.status in ('active', 'shared')
      order by device.manufacturer, device.model
    `,
  ]);
  return <main className="content-page"><Link href="/assignments" className={buttonVariants({ variant: "outline", className: "" })}>← {i18n.t("adminUi.assignmentsBack")}</Link><p className="page-kicker mt-10">{i18n.t("adminUi.assignmentsKicker")}</p><h1 className="page-title">{i18n.t("adminUi.createAssignment")}</h1><p className="mt-4 text-sm leading-7 text-[var(--muted)]">{i18n.t("adminUi.assignmentAuthorityHelp")}</p><AssignmentForm participants={participants} versions={versions} devices={devices} /></main>;
}
