import { Activity, Database, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/src/server/auth";
import { database } from "@/src/server/database";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const viewer = await requireAdmin();
  const [migration] = await database()<{ count: number }[]>`
    select count(*)::integer as count from egocapture.schema_migrations
  `;
  return (
    <main className="min-h-screen px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-6 border-b border-[var(--line)] pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--teal)]">Admin control room</p>
          <h1 className="display mt-2 text-4xl font-semibold">采集控制台</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">{viewer.displayName}</p>
      </header>
      <section className="grid gap-4 py-10 md:grid-cols-3">
        {[
          [ShieldCheck, "身份与 RLS", "已启用"],
          [Database, "Migration", `${migration.count} applied`],
          [Activity, "业务数据", "等待 Demo Seed"],
        ].map(([Icon, label, value]) => (
          <article key={String(label)} className="border border-[var(--line)] bg-white/35 p-6">
            <Icon className="h-5 w-5 text-[var(--signal)]" aria-hidden />
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{String(label)}</p>
            <p className="display mt-2 text-3xl font-semibold">{String(value)}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
