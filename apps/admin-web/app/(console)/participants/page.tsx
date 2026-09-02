import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { Badge } from "@egocapture/ui/components/badge";
import { Label } from "@egocapture/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Input } from "@egocapture/ui/components/input";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import Link from "next/link";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react/dist/ssr";
import { requireAdmin } from "@/lib/auth";
import { listParticipants, participantListSchema } from "@egocapture/core/server/services/participants";
import { CountrySelect, LocaleSelect } from "@/app/_components/regional-preferences-fields";

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
    locale: typeof params.locale === "string" && params.locale ? params.locale : undefined,
    countryRegion: typeof params.countryRegion === "string" && params.countryRegion ? params.countryRegion : undefined,
    missing: typeof params.missing === "string" && params.missing ? params.missing : undefined,
    needsReview: typeof params.needsReview === "string" && params.needsReview ? params.needsReview : undefined,
    cursor: typeof params.cursor === "string" && params.cursor ? params.cursor : undefined,
    limit: 25,
  });
  const result = await listParticipants(viewer, query);
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
        <Link href="/participants/new" className={buttonVariants({ className: "" })}><Plus className="size-4" weight="bold" />创建 Participant</Link>
      </header>
      <form className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl my-7 grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
        <Label className="flex items-center gap-2 border border-[var(--line)] bg-[var(--paper)] px-3"><MagnifyingGlass className="size-4 text-[var(--muted)]" /><Input name="search" defaultValue={query.search} placeholder="Public ID 或 Alias" className="w-full bg-transparent py-3 outline-none" /></Label>
        <NativeSelect name="status" defaultValue={query.status ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3">
          <NativeSelectOption value="">全部状态</NativeSelectOption>
          {Object.entries(statusLabels).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
        </NativeSelect>
        <NativeSelect name="consentStatus" aria-label="Consent" defaultValue={query.consentStatus ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><NativeSelectOption value="">全部 Consent</NativeSelectOption>{["pending", "valid", "expired", "withdrawn"].map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}</NativeSelect>
        <LocaleSelect name="locale" defaultValue={query.locale} blankLabel="全部 Locale" aria-label="Locale" className="border border-[var(--line)] bg-[var(--paper)] px-3 py-3" />
        <CountrySelect name="countryRegion" defaultValue={query.countryRegion} blankLabel="全部 Country / Region" aria-label="Country / Region" className="border border-[var(--line)] bg-[var(--paper)] px-3 py-3" />
        <NativeSelect name="missing" aria-label="Missing" defaultValue={query.missing ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><NativeSelectOption value="">全部 Missing 状态</NativeSelectOption><NativeSelectOption value="yes">仅 Missing</NativeSelectOption><NativeSelectOption value="no">排除 Missing</NativeSelectOption></NativeSelect>
        <NativeSelect name="needsReview" aria-label="Needs Review" defaultValue={query.needsReview ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><NativeSelectOption value="">全部 Review 状态</NativeSelectOption><NativeSelectOption value="yes">仅 Needs Review</NativeSelectOption><NativeSelectOption value="no">排除 Needs Review</NativeSelectOption></NativeSelect>
        <Button>筛选</Button>
      </form>
      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <Table className="w-full min-w-[820px] border-collapse text-sm">
          <TableHeader className="text-left text-xs uppercase tracking-[0.12em]"><TableRow><TableHead className="p-4">Participant</TableHead><TableHead className="p-4">Status</TableHead><TableHead className="p-4">Consent</TableHead><TableHead className="p-4">Locale / Region</TableHead><TableHead className="p-4">Signals</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((participant) => (
              <TableRow key={participant.publicId} className="border-t border-[var(--line)] hover:bg-white/35">
                <TableCell className="p-4"><Link className="font-bold underline decoration-[var(--signal)] decoration-2 underline-offset-4" href={`/participants/${participant.publicId}`}>{participant.publicId}</Link><p className="mt-1 text-[var(--muted)]">{participant.displayAlias}{participant.isFixture ? " · Demo Fixture" : ""}</p></TableCell>
                <TableCell className="p-4"><Badge>{statusLabels[participant.status]}</Badge></TableCell>
                <TableCell className="p-4">{participant.consentStatus}</TableCell>
                <TableCell className="p-4">{participant.locale}<span className="text-[var(--muted)]"> · {participant.countryRegion || "—"}</span></TableCell>
                <TableCell className="p-4"><div className="flex flex-wrap gap-2">{participant.isMissing ? <Badge variant="secondary">Missing</Badge> : null}{participant.needsReview ? <Badge>Needs Review</Badge> : null}{!participant.isMissing && !participant.needsReview ? <span className="text-[var(--muted)]">—</span> : null}</div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {result.items.length === 0 ? <Empty className="m-4"><EmptyDescription>没有符合条件的 Participant。</EmptyDescription></Empty> : null}
      </div>
      {result.nextCursor ? <Link className="mt-6 inline-block border-b-2 border-[var(--signal)] pb-1 font-bold" href={`/participants?${nextParams.toString()}`}>下一页 →</Link> : null}
    </main>
  );
}
