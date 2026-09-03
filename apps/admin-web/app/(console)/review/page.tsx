import { Badge } from "@egocapture/ui/components/badge";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import Link from "next/link";
import { TablePagination } from "@/app/_components/table-pagination";
import { requireAdmin } from "@/lib/auth";
import { parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { listReviewCases, reviewListSchema } from "@egocapture/core/server/services/review";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const locale = await requestLocale();
  const i18n = createTranslator(locale);
  const params = await searchParams;
  const query = reviewListSchema.parse({ status: typeof params.status === "string" && params.status ? params.status : undefined, caseType: typeof params.caseType === "string" && params.caseType ? params.caseType : undefined, page: parsePageParam(params.page), pageSize: parsePageSizeParam(params.pageSize, 50) });
  const result = await listReviewCases(viewer, query);
  return (
    <main className="app-page">
      <header className="border-b border-[var(--line)] pb-7"><p className="page-kicker">{i18n.t("adminUi.reviewKicker")}</p><h1 className="page-title">{i18n.t("adminUi.reviewCases")}</h1><p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">{i18n.t("adminUi.reviewIntro")}</p></header>
      <form className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl my-7 flex flex-wrap gap-3 p-3"><input type="hidden" name="pageSize" value={query.pageSize} /><NativeSelect name="status" defaultValue={query.status || ""} className="border border-[var(--line)] bg-[var(--paper)] px-3 py-2"><NativeSelectOption value="">{i18n.t("adminUi.allStatuses")}</NativeSelectOption>{["open","in_review","resolved","dismissed"].map((status) => <NativeSelectOption key={status}>{i18n.state("review_case.status", status)}</NativeSelectOption>)}</NativeSelect><NativeSelect name="caseType" defaultValue={query.caseType || ""} className="border border-[var(--line)] bg-[var(--paper)] px-3 py-2"><NativeSelectOption value="">{i18n.t("adminUi.allTypes")}</NativeSelectOption>{["missing","upload_failed","metadata_failed","duplicate_candidate","unmatched","device_mismatch","needs_review"].map((type) => <NativeSelectOption key={type}>{i18n.label("reviewCaseType", type)}</NativeSelectOption>)}</NativeSelect><Button>{i18n.t("adminUi.filter")}</Button></form>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table className="min-w-[72rem]">
          <TableHeader><TableRow><TableHead className="px-5">{i18n.t("adminUi.case")}</TableHead><TableHead>{i18n.t("adminUi.type")}</TableHead><TableHead>{i18n.t("adminUi.participants")}</TableHead><TableHead>{i18n.t("adminUi.relatedObject")}</TableHead><TableHead>{i18n.t("common.reason")}</TableHead><TableHead>{i18n.t("common.status")}</TableHead><TableHead className="pr-5 text-right">{i18n.t("common.actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((review) => (
              <TableRow key={review.publicId}>
                <TableCell className="px-5 py-4 font-semibold text-[var(--signal-dark)]">{review.publicId}{review.isFixture ? <p className="mt-1"><Badge>{i18n.t("adminUi.demoData")}</Badge></p> : null}</TableCell>
                <TableCell className="font-semibold">{i18n.label("reviewCaseType", review.caseType)}</TableCell>
                <TableCell className="max-w-xs whitespace-normal">{review.participantAlias || i18n.t("adminUi.unresolvedParticipant")}<p className="mt-1 text-xs text-[var(--muted)]">{review.participantPublicId || "—"}</p></TableCell>
                <TableCell className="max-w-xs whitespace-normal">{review.uploadPublicId || review.assignmentPublicId || review.videoAssetPublicId || "—"}<p className="mt-1 text-xs text-[var(--muted)]">{review.decisionType ? i18n.label("matchDecision", review.decisionType) : i18n.t("adminUi.noDecision")}</p></TableCell>
                <TableCell className="max-w-sm whitespace-normal text-xs text-[var(--muted)]">{review.reason || i18n.t("adminUi.noMachineReason")}</TableCell>
                <TableCell><Badge>{i18n.state("review_case.status", review.status)}</Badge></TableCell>
                <TableCell className="pr-5 text-right"><Link href={`/review/${review.publicId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{i18n.t("common.view")}</Link></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {result.items.length === 0 ? <Empty><EmptyDescription>{i18n.t("adminUi.noReviewCases")}</EmptyDescription></Empty> : null}
      <div className="mt-6"><TablePagination pathname="/review" query={query} pagination={result} /></div>
    </main>
  );
}
