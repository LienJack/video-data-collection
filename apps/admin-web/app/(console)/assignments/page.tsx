import { Badge } from "@egocapture/ui/components/badge";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Input } from "@egocapture/ui/components/input";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AssignmentActions } from "@/app/(console)/assignments/assignment-actions";
import { TablePagination } from "@/app/_components/table-pagination";
import { requireAdmin } from "@/lib/auth";
import { parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { assignmentListSchema, listAssignments } from "@egocapture/core/server/services/tasks";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const locale = await requestLocale();
  const i18n = createTranslator(locale);
  const params = await searchParams;
  const query = assignmentListSchema.parse({ search: typeof params.search === "string" && params.search ? params.search : undefined, status: typeof params.status === "string" && params.status ? params.status : undefined, page: parsePageParam(params.page), pageSize: parsePageSizeParam(params.pageSize) });
  const result = await listAssignments(viewer, query);
  return (
    <main className="app-page">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--line)] pb-7">
        <div><p className="page-kicker">{i18n.t("adminUi.assignmentsKicker")}</p><h1 className="page-title">{i18n.t("adminUi.assignments")}</h1></div>
        <Link href="/assignments/new" className={buttonVariants({ className: "" })}><Plus className="size-4" weight="bold" />{i18n.t("adminUi.createAssignment")}</Link>
      </header>
      <form className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl my-7 flex flex-wrap gap-3 p-3">
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <Input name="search" defaultValue={query.search} placeholder={i18n.t("adminUi.assignmentSearch")} className="min-w-56 flex-1 border border-[var(--line)] bg-[var(--paper)] px-4 py-3" />
        <NativeSelect name="status" defaultValue={query.status || ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><NativeSelectOption value="">{i18n.t("adminUi.allStatuses")}</NativeSelectOption>{["assigned","acknowledged","session_created","uploading","submitted","needs_review","rework_required","accepted","expired","missing_upload","canceled"].map((status) => <NativeSelectOption key={status} value={status}>{i18n.state("assignment.status", status)}</NativeSelectOption>)}</NativeSelect>
        <Button>{i18n.t("adminUi.filter")}</Button>
      </form>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table className="min-w-[70rem]">
          <TableHeader><TableRow><TableHead className="px-5">{i18n.t("adminUi.assignment")}</TableHead><TableHead>{i18n.t("adminUi.taskVersion")}</TableHead><TableHead>{i18n.t("adminUi.participants")}</TableHead><TableHead>{i18n.t("adminUi.due")}</TableHead><TableHead>{i18n.t("adminUi.statusSignals")}</TableHead><TableHead className="pr-5">{i18n.t("common.actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((assignment) => (
              <TableRow key={assignment.publicId}>
                <TableCell className="px-5 py-4 font-semibold text-[var(--signal-dark)]">{assignment.publicId}</TableCell>
                <TableCell className="max-w-xs whitespace-normal"><Link href={`/tasks/${assignment.taskPublicId}`} className="font-semibold underline decoration-[var(--signal)] underline-offset-4">{assignment.taskTitle}</Link><p className="mt-1 text-xs text-[var(--muted)]">{assignment.taskPublicId} · {i18n.t("common.version", { value: assignment.taskVersion })}</p></TableCell>
                <TableCell className="max-w-xs whitespace-normal"><Link href={`/participants/${assignment.participantPublicId}`} className="font-semibold underline decoration-[var(--signal)] underline-offset-4">{assignment.participantAlias}</Link><p className="mt-1 text-xs text-[var(--muted)]">{assignment.participantPublicId}</p></TableCell>
                <TableCell className="text-xs text-[var(--muted)]">{i18n.date(assignment.dueAt)}</TableCell>
                <TableCell><div className="flex flex-wrap gap-2"><Badge>{i18n.state("assignment.status", assignment.status)}</Badge>{assignment.isMissing ? <Badge variant="destructive">{i18n.t("adminUi.missing")}</Badge> : null}</div></TableCell>
                <TableCell className="pr-5 align-top"><AssignmentActions assignmentPublicId={assignment.publicId} status={assignment.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {result.items.length === 0 ? <Empty><EmptyDescription>{i18n.t("adminUi.noAssignments")}</EmptyDescription></Empty> : null}
      <div className="mt-6"><TablePagination pathname="/assignments" query={query} pagination={result} /></div>
    </main>
  );
}
