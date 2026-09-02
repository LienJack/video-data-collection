import { Badge } from "@egocapture/ui/components/badge";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listReviewCases, reviewListSchema } from "@egocapture/core/server/services/review";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const query = reviewListSchema.parse({ status: typeof params.status === "string" && params.status ? params.status : undefined, caseType: typeof params.caseType === "string" && params.caseType ? params.caseType : undefined, cursor: typeof params.cursor === "string" && params.cursor ? params.cursor : undefined, limit: 50 });
  const result = await listReviewCases(viewer, query);
  return (
    <main className="app-page">
      <header className="border-b border-[var(--line)] pb-7"><p className="page-kicker">Human authority queue</p><h1 className="page-title">Review Cases</h1><p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">自动证据只提示异常；业务关系由不可变 MatchDecision 和人工 Reason 决定。</p></header>
      <form className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl my-7 flex flex-wrap gap-3 p-3"><NativeSelect name="status" defaultValue={query.status || ""} className="border border-[var(--line)] bg-[var(--paper)] px-3 py-2"><NativeSelectOption value="">全部状态</NativeSelectOption>{["open","in_review","resolved","dismissed"].map((status) => <NativeSelectOption key={status}>{status}</NativeSelectOption>)}</NativeSelect><NativeSelect name="caseType" defaultValue={query.caseType || ""} className="border border-[var(--line)] bg-[var(--paper)] px-3 py-2"><NativeSelectOption value="">全部类型</NativeSelectOption>{["missing","upload_failed","metadata_failed","duplicate_candidate","unmatched","device_mismatch","needs_review"].map((type) => <NativeSelectOption key={type}>{type}</NativeSelectOption>)}</NativeSelect><Button>筛选</Button></form>
      <div className="grid gap-4 xl:grid-cols-2">{result.items.map((review) => <Link href={`/review/${review.publicId}`} key={review.publicId} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow)]"><div className="flex flex-wrap justify-between gap-3"><p className="text-xs font-bold text-[var(--signal)]">{review.publicId}</p><div className="flex gap-2">{review.isFixture ? <Badge>Demo Fixture</Badge> : null}<Badge>{review.status}</Badge></div></div><h2 className="display mt-4 text-2xl font-semibold">{review.caseType}</h2><p className="mt-3 text-sm">{review.participantAlias || "Unresolved participant"} · {review.participantPublicId || "—"}</p><p className="mt-2 text-xs text-[var(--muted)]">{review.uploadPublicId || review.assignmentPublicId || review.videoAssetPublicId || "—"} · {review.decisionType || "no decision"}</p><p className="mt-3 line-clamp-2 text-xs text-[var(--muted)]">{review.reason || "No machine reason"}</p></Link>)}</div>
      {result.items.length === 0 ? <Empty><EmptyDescription>当前筛选没有 ReviewCase。</EmptyDescription></Empty> : null}
      {result.nextCursor ? <Link href={`?${new URLSearchParams({ ...(query.status ? { status: query.status } : {}), ...(query.caseType ? { caseType: query.caseType } : {}), cursor: result.nextCursor }).toString()}`} className={buttonVariants({ variant: "outline", className: " mt-8" })}>下一页 →</Link> : null}
    </main>
  );
}
