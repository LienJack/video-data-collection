import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { CheckCircle, MagnifyingGlass, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { listAuditEvents } from "@egocapture/core/server/services/review";
import { TablePagination } from "@/app/_components/table-pagination";
import { auditActionLabel, auditEntityLabel, changedAuditFields, formatRecordDate } from "@/lib/record-presenters";
import type { ActivityRecordsQuery } from "@/lib/records-query";
import { createTranslator, type UiLocale } from "@egocapture/core/i18n";

type ActivityRecordsResult = Awaited<ReturnType<typeof listAuditEvents>>;

export function ActivityRecordsPanel({ locale, query, result }: { locale: UiLocale; query: ActivityRecordsQuery; result: ActivityRecordsResult }) {
  const i18n = createTranslator(locale);
  const categories = [
    ["task", i18n.t("adminUi.categoryTask")], ["participant", i18n.t("adminUi.categoryParticipant")], ["assignment", i18n.t("adminUi.categoryAssignment")], ["session", i18n.t("adminUi.categorySession")],
    ["upload", i18n.t("adminUi.categoryUpload")], ["metadata", i18n.t("adminUi.categoryMetadata")], ["review", i18n.t("adminUi.categoryReview")], ["system", i18n.t("adminUi.categorySystem")],
  ] as const;
  const hasFilters = Boolean(query.search || query.category);
  return (
    <section aria-labelledby="activity-records-heading" className="space-y-5">
      <div><h2 id="activity-records-heading" className="display text-2xl font-semibold">{i18n.t("adminUi.activityLog")}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{i18n.t("adminUi.auditRecordsIntro")}</p></div>
      <form className="apple-toolbar grid gap-3 p-3 sm:grid-cols-[minmax(15rem,1fr)_minmax(11rem,auto)_auto]" action="/records">
        <input type="hidden" name="tab" value="activity" />
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>{i18n.t("adminUi.searchActivity")}</span><span className="relative block"><MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" /><Input name="search" defaultValue={query.search} placeholder={i18n.t("adminUi.activitySearchPlaceholder")} className="pl-10" /></span></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>{i18n.t("adminUi.actionCategory")}</span><NativeSelect name="category" defaultValue={query.category ?? ""} className="w-full"><NativeSelectOption value="">{i18n.t("adminUi.allActions")}</NativeSelectOption>{categories.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></label>
        <div className="flex items-end gap-2"><Button className="flex-1">{i18n.t("adminUi.filter")}</Button>{hasFilters ? <Link href={`/records?tab=activity&pageSize=${query.pageSize}`} className={buttonVariants({ variant: "outline", className: "flex-1" })}>{i18n.t("adminUi.clearFilters")}</Link> : null}</div>
      </form>

      <div className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/80 shadow-[var(--shadow-soft)]">
        <Table className="min-w-[80rem]">
          <TableHeader><TableRow><TableHead className="px-5">{i18n.t("adminUi.reviewAction")}</TableHead><TableHead>{i18n.t("adminUi.object", { id: "" }).replace(":", "").replace("：", "").trim()}</TableHead><TableHead>{i18n.t("adminUi.actor")}</TableHead><TableHead>{i18n.t("adminUi.reasonChanges")}</TableHead><TableHead>{i18n.t("adminUi.time")}</TableHead><TableHead className="pr-5">{i18n.t("common.actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((event) => {
              const changes = changedAuditFields(event.beforeValues, event.afterValues);
              return (
                <TableRow key={event.id}>
                  <TableCell className="max-w-xs whitespace-normal px-5 py-4"><p className="font-semibold">{auditActionLabel(event.action, i18n)}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{event.action}</p><Badge className="mt-2" variant="outline"><CheckCircle weight="fill" />{i18n.t("adminUi.recorded")}</Badge></TableCell>
                  <TableCell className="max-w-xs whitespace-normal"><p className="font-semibold">{auditEntityLabel(event.entityType, i18n)}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{event.entityPublicId ?? i18n.t("adminUi.noPublicId")}</p></TableCell>
                  <TableCell className="max-w-xs whitespace-normal">{event.actorDisplayName ?? i18n.t("adminUi.systemActor")}</TableCell>
                  <TableCell className="max-w-md whitespace-normal"><p>{event.reason ?? i18n.t("adminUi.noReason")}</p><p className="mt-1 text-xs text-[var(--muted)]">{changes.length > 0 ? i18n.t("adminUi.changedFields", { fields: changes.map((field) => i18n.label("field", field)).join(", ") }) : i18n.t("adminUi.noBeforeAfterChanges")}</p></TableCell>
                  <TableCell className="text-xs text-[var(--muted)]">{formatRecordDate(event.createdAt, i18n)}</TableCell>
                  <TableCell className="pr-5"><details className="min-w-52 text-xs"><summary className="min-h-10 cursor-pointer py-2 font-semibold text-[var(--signal-dark)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">{i18n.t("adminUi.viewChanges")}</summary><div className="mt-2 min-w-0 space-y-2 rounded-xl bg-[var(--ink)] p-4 text-[var(--paper)]"><p className="break-all">{i18n.t("adminUi.rawAction", { value: event.action })}</p><p className="break-all">{i18n.t("adminUi.requestId", { value: event.requestId })}</p>{event.beforeValues || event.afterValues ? <pre className="max-w-full overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5">{JSON.stringify({ before: event.beforeValues, after: event.afterValues }, null, 2)}</pre> : <p>{i18n.t("adminUi.noBeforeAfterJson")}</p>}</div></details></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {result.items.length === 0 ? <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/60 px-5 py-12 text-center shadow-sm"><ShieldCheck className="mx-auto size-10 text-[var(--signal)]" weight="duotone" aria-hidden="true" /><h3 className="mt-4 font-semibold">{hasFilters ? i18n.t("adminUi.noActivityFiltered") : i18n.t("adminUi.noActivity")}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{hasFilters ? i18n.t("adminUi.noActivityFilteredHelp") : i18n.t("adminUi.noActivityImmutableHelp")}</p>{hasFilters ? <Link href="/records?tab=activity" className={buttonVariants({ variant: "outline", className: "mt-5" })}>{i18n.t("adminUi.clearFilters")}</Link> : null}</div> : null}
      <TablePagination pathname="/records" query={query} pagination={result} />
    </section>
  );
}
