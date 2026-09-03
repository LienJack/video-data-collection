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
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

const participantStatuses = ["draft", "invited", "expired", "active", "suspended", "withdrawn"] as const;
const consentStatuses = ["pending", "valid", "expired", "withdrawn"] as const;

const filterFieldClass = "w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3";

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [viewer, params, locale] = await Promise.all([requireAdmin(), searchParams, requestLocale()]);
  const i18n = createTranslator(locale);
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
          <p className="page-kicker">{i18n.t("adminUi.participantList.kicker")}</p>
          <h1 className="page-title">{i18n.t("adminUi.participants")}</h1>
        </div>
        <Link
          href="/participants/new"
          className={buttonVariants({ className: "" })}
          style={{ color: "var(--primary-foreground)" }}
        >
          <Plus className="size-4" weight="bold" />{i18n.t("adminUi.createParticipant")}
        </Link>
      </header>
      <form aria-label={i18n.t("adminUi.participantList.filters")} className="my-7 grid items-stretch gap-2 rounded-xl border bg-card/80 p-3 text-card-foreground shadow-sm backdrop-blur-xl sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <div className="relative">
          <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input name="search" aria-label={i18n.t("adminUi.searchParticipants")} defaultValue={query.search} placeholder={i18n.t("adminUi.participantSearchPlaceholder")} className={`${filterFieldClass} pl-10`} />
        </div>
        <NativeSelect name="status" defaultValue={query.status ?? ""} className={filterFieldClass}>
          <NativeSelectOption value="">{i18n.t("adminUi.allStatuses")}</NativeSelectOption>
          {participantStatuses.map((value) => <NativeSelectOption key={value} value={value}>{i18n.state("participant.status", value)}</NativeSelectOption>)}
        </NativeSelect>
        <NativeSelect name="consentStatus" aria-label={i18n.t("adminUi.consent")} defaultValue={query.consentStatus ?? ""} className={filterFieldClass}><NativeSelectOption value="">{i18n.t("adminUi.participantList.allConsentStatuses")}</NativeSelectOption>{consentStatuses.map((value) => <NativeSelectOption key={value} value={value}>{i18n.state("participant.consent_status", value)}</NativeSelectOption>)}</NativeSelect>
        <LocaleSelect name="locale" defaultValue={query.locale} blankLabel={i18n.t("adminUi.participantList.allLocales")} aria-label={i18n.t("adminUi.locale")} className={filterFieldClass} />
        <CountrySelect name="countryRegion" defaultValue={query.countryRegion} blankLabel={i18n.t("adminUi.participantList.allCountriesRegions")} aria-label={i18n.t("adminUi.countryRegion")} className={filterFieldClass} />
        <NativeSelect name="missing" aria-label={i18n.t("adminUi.missing")} defaultValue={query.missing ?? ""} className={filterFieldClass}><NativeSelectOption value="">{i18n.t("adminUi.participantList.allMissingSignals")}</NativeSelectOption><NativeSelectOption value="yes">{i18n.t("adminUi.participantList.onlyMissing")}</NativeSelectOption><NativeSelectOption value="no">{i18n.t("adminUi.participantList.excludeMissing")}</NativeSelectOption></NativeSelect>
        <NativeSelect name="needsReview" aria-label={i18n.t("adminUi.awaitingReview")} defaultValue={query.needsReview ?? ""} className={filterFieldClass}><NativeSelectOption value="">{i18n.t("adminUi.participantList.allReviewSignals")}</NativeSelectOption><NativeSelectOption value="yes">{i18n.t("adminUi.participantList.onlyNeedsReview")}</NativeSelectOption><NativeSelectOption value="no">{i18n.t("adminUi.participantList.excludeNeedsReview")}</NativeSelectOption></NativeSelect>
        <Button className="w-full">{i18n.t("adminUi.filter")}</Button>
      </form>
      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <Table className="w-full min-w-[820px] border-collapse text-sm">
          <TableHeader className="text-left text-xs uppercase tracking-[0.12em]"><TableRow><TableHead className="p-4">{i18n.t("common.participant")}</TableHead><TableHead className="p-4">{i18n.t("common.status")}</TableHead><TableHead className="p-4">{i18n.t("adminUi.consent")}</TableHead><TableHead className="p-4">{i18n.t("adminUi.countryRegion")}</TableHead><TableHead className="p-4">{i18n.t("adminUi.statusSignals")}</TableHead><TableHead className="p-4 text-right">{i18n.t("common.actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((participant) => (
              <TableRow key={participant.publicId} className="border-t border-[var(--line)] hover:bg-white/35">
                <TableCell className="p-4"><Link className="font-bold underline decoration-[var(--signal)] decoration-2 underline-offset-4" href={`/participants/${participant.publicId}`}>{participant.publicId}</Link><p className="mt-1 text-[var(--muted)]">{participant.displayAlias}{participant.isFixture ? ` · ${i18n.t("adminUi.demoData")}` : ""}</p></TableCell>
                <TableCell className="p-4"><Badge>{i18n.state("participant.status", participant.status)}</Badge></TableCell>
                <TableCell className="p-4">{i18n.state("participant.consent_status", participant.consentStatus)}</TableCell>
                <TableCell className="p-4">{i18n.languageName(participant.locale)}<span className="text-[var(--muted)]"> · {participant.countryRegion ? i18n.regionName(participant.countryRegion) : "—"}</span></TableCell>
                <TableCell className="p-4"><div className="flex flex-wrap gap-2">{participant.isMissing ? <Badge variant="secondary">{i18n.t("adminUi.missing")}</Badge> : null}{participant.needsReview ? <Badge>{i18n.t("adminUi.awaitingReview")}</Badge> : null}{!participant.isMissing && !participant.needsReview ? <span className="text-[var(--muted)]">—</span> : null}</div></TableCell>
                <TableCell className="p-4 text-right"><Link href={`/participants/${participant.publicId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{i18n.t("common.view")}</Link></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {result.items.length === 0 ? <Empty className="m-4"><EmptyDescription>{i18n.t("adminUi.noParticipantMatches")}</EmptyDescription></Empty> : null}
      </div>
      <div className="mt-6"><TablePagination pathname="/participants" query={query} pagination={result} /></div>
    </main>
  );
}
