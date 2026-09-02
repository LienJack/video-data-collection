import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { Badge } from "@egocapture/ui/components/badge";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Input } from "@egocapture/ui/components/input";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import Link from "next/link";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react/dist/ssr";
import { requireAdmin } from "@/lib/auth";
import { listParticipants, participantListSchema } from "@egocapture/core/server/services/participants";
import { CountrySelect, LocaleSelect } from "@/app/_components/regional-preferences-fields";
import { TablePagination } from "@/app/_components/table-pagination";
import { parsePageParam, parsePageSizeParam } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "Draft", invited: "Invited", expired: "Expired", active: "Active",
  suspended: "Suspended", withdrawn: "Withdrawn",
};

const filterFieldClass = "w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3";

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
    page: parsePageParam(params.page),
    pageSize: parsePageSizeParam(params.pageSize),
  });
  const result = await listParticipants(viewer, query);
  return (
    <main className="app-page">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--line)] pb-7">
        <div>
          <p className="page-kicker">Participant registry</p>
          <h1 className="page-title">参与者</h1>
        </div>
        <Link
          href="/participants/new"
          className={buttonVariants({ className: "" })}
          style={{ color: "var(--primary-foreground)" }}
        >
          <Plus className="size-4" weight="bold" />创建 Participant
        </Link>
      </header>
      <form className="my-7 grid items-stretch gap-2 rounded-xl border bg-card/80 p-3 text-card-foreground shadow-sm backdrop-blur-xl sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <div className="relative">
          <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input name="search" aria-label="Public ID 或 Alias" defaultValue={query.search} placeholder="Public ID 或 Alias" className={`${filterFieldClass} pl-10`} />
        </div>
        <NativeSelect name="status" defaultValue={query.status ?? ""} className={filterFieldClass}>
          <NativeSelectOption value="">全部状态</NativeSelectOption>
          {Object.entries(statusLabels).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
        </NativeSelect>
        <NativeSelect name="consentStatus" aria-label="Consent" defaultValue={query.consentStatus ?? ""} className={filterFieldClass}><NativeSelectOption value="">全部 Consent</NativeSelectOption>{["pending", "valid", "expired", "withdrawn"].map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}</NativeSelect>
        <LocaleSelect name="locale" defaultValue={query.locale} blankLabel="全部 Locale" aria-label="Locale" className={filterFieldClass} />
        <CountrySelect name="countryRegion" defaultValue={query.countryRegion} blankLabel="全部国家 / 地区" aria-label="Country / Region" className={filterFieldClass} />
        <NativeSelect name="missing" aria-label="Missing" defaultValue={query.missing ?? ""} className={filterFieldClass}><NativeSelectOption value="">全部 Missing 状态</NativeSelectOption><NativeSelectOption value="yes">仅 Missing</NativeSelectOption><NativeSelectOption value="no">排除 Missing</NativeSelectOption></NativeSelect>
        <NativeSelect name="needsReview" aria-label="Needs Review" defaultValue={query.needsReview ?? ""} className={filterFieldClass}><NativeSelectOption value="">全部 Review 状态</NativeSelectOption><NativeSelectOption value="yes">仅 Needs Review</NativeSelectOption><NativeSelectOption value="no">排除 Needs Review</NativeSelectOption></NativeSelect>
        <Button className="w-full">筛选</Button>
      </form>
      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <Table className="w-full min-w-[820px] border-collapse text-sm">
          <TableHeader className="text-left text-xs uppercase tracking-[0.12em]"><TableRow><TableHead className="p-4">Participant</TableHead><TableHead className="p-4">Status</TableHead><TableHead className="p-4">Consent</TableHead><TableHead className="p-4">Locale / Region</TableHead><TableHead className="p-4">Signals</TableHead><TableHead className="p-4 text-right">操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((participant) => (
              <TableRow key={participant.publicId} className="border-t border-[var(--line)] hover:bg-white/35">
                <TableCell className="p-4"><Link className="font-bold underline decoration-[var(--signal)] decoration-2 underline-offset-4" href={`/participants/${participant.publicId}`}>{participant.publicId}</Link><p className="mt-1 text-[var(--muted)]">{participant.displayAlias}{participant.isFixture ? " · Demo Fixture" : ""}</p></TableCell>
                <TableCell className="p-4"><Badge>{statusLabels[participant.status]}</Badge></TableCell>
                <TableCell className="p-4">{participant.consentStatus}</TableCell>
                <TableCell className="p-4">{participant.locale}<span className="text-[var(--muted)]"> · {participant.countryRegion || "—"}</span></TableCell>
                <TableCell className="p-4"><div className="flex flex-wrap gap-2">{participant.isMissing ? <Badge variant="secondary">Missing</Badge> : null}{participant.needsReview ? <Badge>Needs Review</Badge> : null}{!participant.isMissing && !participant.needsReview ? <span className="text-[var(--muted)]">—</span> : null}</div></TableCell>
                <TableCell className="p-4 text-right"><Link href={`/participants/${participant.publicId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>查看</Link></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {result.items.length === 0 ? <Empty className="m-4"><EmptyDescription>没有符合条件的 Participant。</EmptyDescription></Empty> : null}
      </div>
      <div className="mt-6"><TablePagination pathname="/participants" query={query} pagination={result} /></div>
    </main>
  );
}
