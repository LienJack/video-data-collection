import Link from "next/link";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react/dist/ssr";
import { requireAdmin } from "@/src/server/auth";
import { database } from "@/src/server/database";
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
    consentStatus: typeof params.consentStatus === "string" && params.consentStatus ? params.consentStatus : undefined,
    studyPublicId: typeof params.studyPublicId === "string" && params.studyPublicId ? params.studyPublicId : undefined,
    locale: typeof params.locale === "string" && params.locale ? params.locale : undefined,
    countryRegion: typeof params.countryRegion === "string" && params.countryRegion ? params.countryRegion : undefined,
    missing: typeof params.missing === "string" && params.missing ? params.missing : undefined,
    needsReview: typeof params.needsReview === "string" && params.needsReview ? params.needsReview : undefined,
    cursor: typeof params.cursor === "string" && params.cursor ? params.cursor : undefined,
    limit: 25,
  });
  const db = database();
  const [result, studies] = await Promise.all([
    listParticipants(viewer, query),
    db<{ publicId: string; name: string }[]>`
      select study.public_id, study.name
      from egocapture.studies study
      join egocapture.study_memberships membership on membership.study_id = study.id
      where membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
      order by study.name
    `,
  ]);
  const nextParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key !== "cursor" && key !== "limit" && value !== undefined) nextParams.set(key, String(value));
  }
  if (result.nextCursor) nextParams.set("cursor", result.nextCursor);
  return (
    <main className="app-page">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--line)] pb-7">
        <div>
          <p className="page-kicker">Participant registry</p>
          <h1 className="page-title">参与者</h1>
        </div>
        <Link href="/admin/participants/new" className="primary-action"><Plus className="size-4" weight="bold" />创建 Participant</Link>
      </header>
      <form className="surface my-7 grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex items-center gap-2 border border-[var(--line)] bg-[var(--paper)] px-3"><MagnifyingGlass className="size-4 text-[var(--muted)]" /><input name="search" defaultValue={query.search} placeholder="Public ID 或 Alias" className="w-full bg-transparent py-3 outline-none" /></label>
        <select name="status" defaultValue={query.status ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3">
          <option value="">全部状态</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select name="consentStatus" aria-label="Consent" defaultValue={query.consentStatus ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><option value="">全部 Consent</option>{["pending", "valid", "expired", "withdrawn"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select name="studyPublicId" aria-label="Study" defaultValue={query.studyPublicId ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><option value="">全部 Study</option>{studies.map((study) => <option key={study.publicId} value={study.publicId}>{study.name} · {study.publicId}</option>)}</select>
        <input name="locale" defaultValue={query.locale} placeholder="Locale，例如 zh-CN" className="border border-[var(--line)] bg-[var(--paper)] px-3 py-3" />
        <input name="countryRegion" defaultValue={query.countryRegion} placeholder="Country / Region" className="border border-[var(--line)] bg-[var(--paper)] px-3 py-3" />
        <select name="missing" aria-label="Missing" defaultValue={query.missing ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><option value="">全部 Missing 状态</option><option value="yes">仅 Missing</option><option value="no">排除 Missing</option></select>
        <select name="needsReview" aria-label="Needs Review" defaultValue={query.needsReview ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><option value="">全部 Review 状态</option><option value="yes">仅 Needs Review</option><option value="no">排除 Needs Review</option></select>
        <button className="primary-action">筛选</button>
      </form>
      <div className="data-table overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.12em]"><tr><th className="p-4">Participant</th><th className="p-4">Study</th><th className="p-4">Status</th><th className="p-4">Consent</th><th className="p-4">Locale / Region</th><th className="p-4">Signals</th></tr></thead>
          <tbody>
            {result.items.map((participant) => (
              <tr key={participant.publicId} className="border-t border-[var(--line)] hover:bg-white/35">
                <td className="p-4"><Link className="font-bold underline decoration-[var(--signal)] decoration-2 underline-offset-4" href={`/admin/participants/${participant.publicId}`}>{participant.publicId}</Link><p className="mt-1 text-[var(--muted)]">{participant.displayAlias}{participant.isFixture ? " · Demo Fixture" : ""}</p></td>
                <td className="p-4"><p>{participant.studyName}</p><p className="text-xs text-[var(--muted)]">{participant.studyPublicId}</p></td>
                <td className="p-4"><span className="status-pill">{statusLabels[participant.status]}</span></td>
                <td className="p-4">{participant.consentStatus}</td>
                <td className="p-4">{participant.locale}<span className="text-[var(--muted)]"> · {participant.countryRegion || "—"}</span></td>
                <td className="p-4"><div className="flex flex-wrap gap-2">{participant.isMissing ? <span className="bg-[var(--yellow)] px-2 py-1 text-xs font-bold">Missing</span> : null}{participant.needsReview ? <span className="bg-[var(--signal)] px-2 py-1 text-xs font-bold text-white">Needs Review</span> : null}{!participant.isMissing && !participant.needsReview ? <span className="text-[var(--muted)]">—</span> : null}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 ? <p className="empty-state m-4">没有符合条件的 Participant。</p> : null}
      </div>
      {result.nextCursor ? <Link className="mt-6 inline-block border-b-2 border-[var(--signal)] pb-1 font-bold" href={`/admin/participants?${nextParams.toString()}`}>下一页 →</Link> : null}
    </main>
  );
}
