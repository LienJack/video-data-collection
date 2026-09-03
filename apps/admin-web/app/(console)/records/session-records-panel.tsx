import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { ArrowRight, CheckCircle, ClockCounterClockwise, MagnifyingGlass, Radio, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { listAdminSessions } from "@egocapture/core/server/services/sessions";
import { SessionClose } from "@/app/(console)/sessions/session-close";
import { TablePagination } from "@/app/_components/table-pagination";
import { formatRecordDate, sessionStatusLabel } from "@/lib/record-presenters";
import type { SessionRecordsQuery } from "@/lib/records-query";
import { createTranslator, type UiLocale } from "@egocapture/core/i18n";

type SessionRecordsResult = Awaited<ReturnType<typeof listAdminSessions>>;

export function SessionRecordsPanel({ locale, query, result }: { locale: UiLocale; query: SessionRecordsQuery; result: SessionRecordsResult }) {
  const i18n = createTranslator(locale);
  const hasCustomFilters = Boolean(query.search || query.status !== "open");
  return (
    <section aria-labelledby="session-records-heading" className="space-y-5">
      <div><h2 id="session-records-heading" className="display text-2xl font-semibold">{i18n.t("adminUi.sessionRecords")}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{i18n.t("adminUi.sessionsIntro")}</p></div>
      <form className="apple-toolbar grid gap-3 p-3 sm:grid-cols-[minmax(15rem,1fr)_minmax(10rem,auto)_auto]" action="/records">
        <input type="hidden" name="tab" value="sessions" />
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>{i18n.t("adminUi.searchSessions")}</span><span className="relative block"><MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" /><Input name="search" defaultValue={query.search} placeholder={i18n.t("adminUi.sessionSearchPlaceholder")} className="pl-10" /></span></label>
        <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]"><span>{i18n.t("adminUi.sessionStatus")}</span><NativeSelect name="status" defaultValue={query.status} className="w-full"><NativeSelectOption value="open">{i18n.t("adminUi.notClosed")}</NativeSelectOption><NativeSelectOption value="closed">{i18n.state("recording_session.status", "closed")}</NativeSelectOption><NativeSelectOption value="all">{i18n.t("adminUi.allHistory")}</NativeSelectOption></NativeSelect></label>
        <div className="flex items-end gap-2"><Button className="flex-1">{i18n.t("adminUi.filter")}</Button>{hasCustomFilters ? <Link href={`/records?tab=sessions&pageSize=${query.pageSize}`} className={buttonVariants({ variant: "outline", className: "flex-1" })}>{i18n.t("adminUi.clearFilters")}</Link> : null}</div>
      </form>

      <div className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/80 shadow-[var(--shadow-soft)]">
        <Table className="min-w-[88rem]">
          <TableHeader><TableRow><TableHead className="px-5">{i18n.t("adminUi.sessionRecords")}</TableHead><TableHead>{i18n.t("adminUi.participants")}</TableHead><TableHead>{i18n.t("adminUi.taskDevice")}</TableHead><TableHead>{i18n.t("common.status")}</TableHead><TableHead>{i18n.t("adminUi.markerVideos")}</TableHead><TableHead>{i18n.t("adminUi.createdTime")}</TableHead><TableHead className="pr-5 text-right">{i18n.t("common.actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((session) => (
              <TableRow key={session.publicId}>
                <TableCell className="px-5 py-4"><p className="break-all font-semibold">{session.publicId}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{session.assignmentPublicId}</p></TableCell>
                <TableCell className="max-w-xs whitespace-normal"><Link href={`/participants/${session.participantPublicId}`} className="font-semibold underline decoration-[var(--signal)] underline-offset-4">{session.participantAlias}</Link><p className="mt-1 break-all text-xs text-[var(--muted)]">{session.participantPublicId}</p></TableCell>
                <TableCell className="max-w-sm whitespace-normal"><Link href={`/tasks/${session.taskPublicId}`} className="font-semibold underline decoration-[var(--signal)] underline-offset-4">{session.taskTitle}</Link><p className="mt-1 text-xs text-[var(--muted)]">{session.taskPublicId}</p><p className="mt-1 text-xs">{session.deviceLabel} · {session.devicePublicId}</p></TableCell>
                <TableCell><Badge variant={session.status === "open" ? "default" : "secondary"}>{session.status === "closed" ? <CheckCircle weight="fill" /> : <ClockCounterClockwise weight="duotone" />}{sessionStatusLabel(session.status, i18n)}</Badge>{session.closedAt ? <p className="mt-2 text-xs text-[var(--muted)]">{i18n.t("adminUi.closedAt", { date: formatRecordDate(session.closedAt, i18n) })}</p> : null}</TableCell>
                <TableCell className="whitespace-normal"><p className="font-semibold">{session.markerAcknowledgedAt ? i18n.t("adminUi.markerConfirmed") : i18n.t("adminUi.markerPending")}</p><p className="mt-1 text-xs text-[var(--muted)]">{i18n.t("adminUi.matchedVideos", { count: session.matchedVideoCount })}</p></TableCell>
                <TableCell className="text-xs text-[var(--muted)]">{formatRecordDate(session.createdAt, i18n)}</TableCell>
                <TableCell className="pr-5"><div className="flex flex-col items-stretch gap-2"><Link href={`/records?tab=videos&search=${encodeURIComponent(session.publicId)}`} className={buttonVariants({ variant: "outline", size: "sm" })}><VideoCamera aria-hidden="true" />{i18n.t("adminUi.viewRelatedVideos")}<ArrowRight aria-hidden="true" /></Link>{session.status === "open" ? <SessionClose sessionPublicId={session.publicId} /> : null}</div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {result.items.length === 0 ? <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/60 px-5 py-12 text-center shadow-sm"><Radio className="mx-auto size-10 text-[var(--signal)]" weight="duotone" aria-hidden="true" /><h3 className="mt-4 font-semibold">{hasCustomFilters ? i18n.t("adminUi.noSessionsFiltered") : i18n.t("adminUi.noOpenSessions")}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{hasCustomFilters ? i18n.t("adminUi.noSessionsFilteredHelp") : i18n.t("adminUi.noOpenSessionsHelp")}</p><Link href={hasCustomFilters ? "/records?tab=sessions" : "/records?tab=sessions&status=all"} className={buttonVariants({ variant: "outline", className: "mt-5" })}>{hasCustomFilters ? i18n.t("adminUi.clearFilters") : i18n.t("adminUi.allHistory")}</Link></div> : null}
      <TablePagination pathname="/records" query={query} pagination={result} />
    </section>
  );
}
