import Link from "next/link";
import { NewParticipantForm } from "@/app/(console)/participants/new/new-participant-form";
import { requireAdmin } from "@/lib/auth";

export default async function NewParticipantPage() {
  await requireAdmin();
  return (
    <main className="content-page">
      <Link href="/participants" className="text-sm font-bold text-[var(--teal)]">← Participants</Link>
      <p className="page-kicker mt-10">Create registry entry</p>
      <h1 className="page-title">创建 Participant</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">先创建 Draft，再生成一次性模拟邀请。真实邮件不在 MVP 范围内。</p>
      <NewParticipantForm />
    </main>
  );
}
