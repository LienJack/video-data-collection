import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireAdmin } from "@/src/server/auth";
import { listParticipants, participantListSchema } from "@/src/server/services/participants";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "Draft", invited: "Invited", expired: "Expired", active: "Active",
  suspended: "Suspended", withdrawn: "Withdrawn",
};

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const query = participantListSchema.parse({
    search: typeof params.search === "string" && params.search ? params.search : undefined,
    status: typeof params.status === "string" && params.status ? params.status : undefined,
    cursor: typeof params.cursor === "string" && params.cursor ? params.cursor : undefined,
    limit: 25,
  });
  const result = await listParticipants(viewer, query);
  return (
    <main className="px-5 py-8 sm:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--line)] pb-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--teal)]">Participant registry</p>
          <h1 className="display mt-2 text-5xl font-semibold">参与者</h1>
        </div>
        <Link href="/admin/participants/new" className="inline-flex items-center gap-2 bg-[var(--signal)] px-5 py-3 font-bold text-white"><Plus className="h-4 w-4" />创建 Participant</Link>
      </header>
      <form className="my-7 grid gap-3 border border-[var(--line)] bg-white/30 p-3 sm:grid-cols-[1fr_180px_auto]">
        <label className="flex items-center gap-2 border border-[var(--line)] bg-[var(--paper)] px-3"><Search className="h-4 w-4 text-[var(--muted)]" /><input name="search" defaultValue={query.search} placeholder="Public ID 或 Alias" className="w-full bg-transparent py-3 outline-none" /></label>
        <select name="status" defaultValue={query.status ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3">
          <option value="">全部状态</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="bg-[var(--ink)] px-5 py-3 font-bold text-[var(--paper)]">筛选</button>
      </form>
      <div className="overflow-x-auto border border-[var(--line)]">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-[var(--ink)] text-left text-xs uppercase tracking-[0.12em] text-[var(--paper)]"><tr><th className="p-4">Participant</th><th className="p-4">Study</th><th className="p-4">Status</th><th className="p-4">Consent</th><th className="p-4">Locale / Region</th></tr></thead>
          <tbody>
            {result.items.map((participant) => (
              <tr key={participant.publicId} className="border-t border-[var(--line)] hover:bg-white/35">
                <td className="p-4"><Link className="font-bold underline decoration-[var(--signal)] decoration-2 underline-offset-4" href={`/admin/participants/${participant.publicId}`}>{participant.publicId}</Link><p className="mt-1 text-[var(--muted)]">{participant.displayAlias}{participant.isFixture ? " · Demo Fixture" : ""}</p></td>
                <td className="p-4"><p>{participant.studyName}</p><p className="text-xs text-[var(--muted)]">{participant.studyPublicId}</p></td>
                <td className="p-4"><span className="border border-[var(--line)] px-2.5 py-1 text-xs font-bold">{statusLabels[participant.status]}</span></td>
                <td className="p-4">{participant.consentStatus}</td>
                <td className="p-4">{participant.locale}<span className="text-[var(--muted)]"> · {participant.countryRegion || "—"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 ? <p className="p-10 text-center text-sm text-[var(--muted)]">没有符合条件的 Participant。</p> : null}
      </div>
      {result.nextCursor ? <Link className="mt-6 inline-block border-b-2 border-[var(--signal)] pb-1 font-bold" href={`/admin/participants?cursor=${result.nextCursor}`}>下一页 →</Link> : null}
    </main>
  );
}
