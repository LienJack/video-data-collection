import { buttonVariants } from "@egocapture/ui/components/button";
import Link from "next/link";
import { AssignmentForm } from "@/app/(console)/assignments/new/assignment-form";
import { requireAdmin } from "@/lib/auth";
import { database } from "@egocapture/core/server/database";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  await requireAdmin();
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
  return <main className="content-page"><Link href="/assignments" className={buttonVariants({ variant: "outline", className: "" })}>← Assignments</Link><p className="page-kicker mt-10">Frozen delivery</p><h1 className="page-title">创建 Assignment</h1><p className="mt-4 text-sm leading-7 text-[var(--muted)]">服务端会重新核对 Active、Consent、Published Version 和 Device 归属；下拉组合不构成授权。</p><AssignmentForm participants={participants} versions={versions} devices={devices} /></main>;
}
