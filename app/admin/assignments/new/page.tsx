import Link from "next/link";
import { AssignmentForm } from "@/app/admin/assignments/new/assignment-form";
import { requireAdmin } from "@egocapture/core/server/auth";
import { database } from "@egocapture/core/server/database";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  const viewer = await requireAdmin();
  const db = database();
  const [participants, versions, devices] = await Promise.all([
    db<{ publicId: string; displayAlias: string; studyPublicId: string }[]>`
      select participant.public_id, participant.display_alias, study.public_id as study_public_id
      from egocapture.participants participant
      join egocapture.studies study on study.id = participant.study_id
      join egocapture.study_memberships membership on membership.study_id = study.id
      where membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
        and participant.status = 'active' and participant.consent_status = 'valid'
      order by participant.display_alias
    `,
    db<{ taskPublicId: string; taskTitle: string; version: number; studyPublicId: string }[]>`
      select task.public_id as task_public_id, version.instructions ->> 'title' as task_title, version.version,
             study.public_id as study_public_id
      from egocapture.task_versions version
      join egocapture.tasks task on task.id = version.task_id
      join egocapture.studies study on study.id = version.study_id
      join egocapture.study_memberships membership on membership.study_id = study.id
      where membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
      order by task.title, version.version desc
    `,
    db<{ publicId: string; label: string; studyPublicId: string }[]>`
      select device.public_id, device.manufacturer || ' ' || device.model as label,
             study.public_id as study_public_id
      from egocapture.devices device
      join egocapture.studies study on study.id = device.study_id
      join egocapture.study_memberships membership on membership.study_id = study.id
      where membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
        and device.status in ('active', 'shared')
      order by device.manufacturer, device.model
    `,
  ]);
  return <main className="content-page"><Link href="/admin/assignments" className="secondary-action">← Assignments</Link><p className="page-kicker mt-10">Frozen delivery</p><h1 className="page-title">创建 Assignment</h1><p className="mt-4 text-sm leading-7 text-[var(--muted)]">服务端会重新核对 Study、Active、Consent、Published Version 和 Device 归属；下拉组合不构成授权。</p><AssignmentForm participants={participants} versions={versions} devices={devices} /></main>;
}
