import Link from "next/link";
import { TaskEditor } from "@/app/admin/tasks/task-editor";
import { defaultTaskInstructions } from "@/src/domain/task-template";
import { requireAdmin } from "@/src/server/auth";
import { database } from "@/src/server/database";

export default async function NewTaskPage() {
  const viewer = await requireAdmin();
  const db = database();
  const studies = await db<{ publicId: string; name: string }[]>`
    select study.public_id, study.name
    from egocapture.studies study
    join egocapture.study_memberships membership on membership.study_id = study.id
    where membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
    order by study.name
  `;
  return <main className="mx-auto max-w-5xl px-5 py-8 sm:px-10"><Link href="/admin/tasks" className="text-sm font-bold text-[var(--teal)]">← Tasks</Link><h1 className="display mt-8 text-5xl font-semibold">创建 Task Draft</h1><TaskEditor mode="create" studies={studies} initialInstructions={JSON.stringify(defaultTaskInstructions, null, 2)} /></main>;
}
