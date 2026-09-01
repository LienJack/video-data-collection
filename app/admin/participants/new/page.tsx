import Link from "next/link";
import { NewParticipantForm } from "@/app/admin/participants/new/new-participant-form";
import { requireAdmin } from "@/src/server/auth";
import { database } from "@/src/server/database";

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
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-10">
      <Link href="/admin/participants" className="text-sm font-bold text-[var(--teal)]">← Participants</Link>
      <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-[var(--signal)]">Create registry entry</p>
      <h1 className="display mt-2 text-5xl font-semibold">创建 Participant</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">先创建 Draft，再生成一次性模拟邀请。真实邮件不在 MVP 范围内。</p>
      <NewParticipantForm studies={studies} />
    </main>
  );
}
