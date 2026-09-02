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

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const query = reviewListSchema.parse({ status: typeof params.status === "string" && params.status ? params.status : undefined, caseType: typeof params.caseType === "string" && params.caseType ? params.caseType : undefined, page: parsePageParam(params.page), pageSize: parsePageSizeParam(params.pageSize, 50) });
  const result = await listReviewCases(viewer, query);
  return (
    <main className="app-page">
      <header className="border-b border-[var(--line)] pb-7"><p className="page-kicker">Human authority queue</p><h1 className="page-title">Review Cases</h1><p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">自动证据只提示异常；业务关系由不可变 MatchDecision 和人工 Reason 决定。</p></header>
      <form className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl my-7 flex flex-wrap gap-3 p-3"><input type="hidden" name="pageSize" value={query.pageSize} /><NativeSelect name="status" defaultValue={query.status || ""} className="border border-[var(--line)] bg-[var(--paper)] px-3 py-2"><NativeSelectOption value="">全部状态</NativeSelectOption>{["open","in_review","resolved","dismissed"].map((status) => <NativeSelectOption key={status}>{status}</NativeSelectOption>)}</NativeSelect><NativeSelect name="caseType" defaultValue={query.caseType || ""} className="border border-[var(--line)] bg-[var(--paper)] px-3 py-2"><NativeSelectOption value="">全部类型</NativeSelectOption>{["missing","upload_failed","metadata_failed","duplicate_candidate","unmatched","device_mismatch","needs_review"].map((type) => <NativeSelectOption key={type}>{type}</NativeSelectOption>)}</NativeSelect><Button>筛选</Button></form>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table className="min-w-[72rem]">
          <TableHeader><TableRow><TableHead className="px-5">Case</TableHead><TableHead>类型</TableHead><TableHead>参与者</TableHead><TableHead>关联对象</TableHead><TableHead>原因</TableHead><TableHead>状态</TableHead><TableHead className="pr-5 text-right">操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {result.items.map((review) => (
              <TableRow key={review.publicId}>
                <TableCell className="px-5 py-4 font-semibold text-[var(--signal-dark)]">{review.publicId}{review.isFixture ? <p className="mt-1"><Badge>Demo Fixture</Badge></p> : null}</TableCell>
                <TableCell className="font-semibold">{review.caseType}</TableCell>
                <TableCell className="max-w-xs whitespace-normal">{review.participantAlias || "Unresolved participant"}<p className="mt-1 text-xs text-[var(--muted)]">{review.participantPublicId || "—"}</p></TableCell>
                <TableCell className="max-w-xs whitespace-normal">{review.uploadPublicId || review.assignmentPublicId || review.videoAssetPublicId || "—"}<p className="mt-1 text-xs text-[var(--muted)]">{review.decisionType || "no decision"}</p></TableCell>
                <TableCell className="max-w-sm whitespace-normal text-xs text-[var(--muted)]">{review.reason || "No machine reason"}</TableCell>
                <TableCell><Badge>{review.status}</Badge></TableCell>
                <TableCell className="pr-5 text-right"><Link href={`/review/${review.publicId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>查看</Link></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {result.items.length === 0 ? <Empty><EmptyDescription>当前筛选没有 ReviewCase。</EmptyDescription></Empty> : null}
      <div className="mt-6"><TablePagination pathname="/review" query={query} pagination={result} /></div>
    </main>
  );
}
