import Link from "next/link";
import { NewParticipantForm } from "@/app/admin/participants/new/new-participant-form";
import { requireAdmin } from "@egocapture/core/server/auth";
import { database } from "@egocapture/core/server/database";

export default async function NewParticipantPage() {
  const viewer = await requireAdmin();
  const db = database();
  const studies = await db<{ publicId: string; name: string }[]>`
    select study.public_id, study.name
    from egocapture.studies study
    join egocapture.study_memberships membership on membership.study_id = study.id
    where membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
    order by study.name
  `;
  return (
    <main className="content-page">
      <Link href="/admin/participants" className="text-sm font-bold text-[var(--teal)]">← Participants</Link>
      <p className="page-kicker mt-10">Create registry entry</p>
      <h1 className="page-title">创建 Participant</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">先创建 Draft，再生成一次性模拟邀请。真实邮件不在 MVP 范围内。</p>
      <NewParticipantForm studies={studies} />
    </main>
  );
}
