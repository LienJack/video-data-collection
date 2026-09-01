import Link from "next/link";
import { requireAdmin } from "@/src/server/auth";
import { listReviewCases, reviewListSchema } from "@/src/server/services/review";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const query = reviewListSchema.parse({
    status: typeof params.status === "string" && params.status ? params.status : undefined,
    caseType: typeof params.caseType === "string" && params.caseType ? params.caseType : undefined,
    cursor: typeof params.cursor === "string" && params.cursor ? params.cursor : undefined,
    limit: 50,
  });
  const result = await listReviewCases(viewer, query);
  return <main className="px-5 py-8 sm:px-10"><header className="border-b border-[var(--line)] pb-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--signal)]">Human authority queue</p><h1 className="display mt-2 text-5xl font-semibold">Review Cases</h1><p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">自动证据只提示异常；业务关系由不可变 MatchDecision 和人工 Reason 决定。</p></header><form className="my-7 flex flex-wrap gap-3 border border-[var(--line)] bg-white/30 p-3"><select name="status" defaultValue={query.status || ""} className="border border-[var(--line)] bg-[var(--paper)] px-3 py-2"><option value="">全部状态</option>{["open","in_review","resolved","dismissed"].map((status) => <option key={status}>{status}</option>)}</select><select name="caseType" defaultValue={query.caseType || ""} className="border border-[var(--line)] bg-[var(--paper)] px-3 py-2"><option value="">全部类型</option>{["missing","upload_failed","metadata_failed","duplicate_candidate","unmatched","device_mismatch","needs_review"].map((type) => <option key={type}>{type}</option>)}</select><button className="bg-[var(--ink)] px-5 py-2 font-bold text-[var(--paper)]">筛选</button></form><div className="grid gap-4 xl:grid-cols-2">{result.items.map((review) => <Link href={`/admin/review/${review.publicId}`} key={review.publicId} className="border border-[var(--line)] bg-white/35 p-6 transition hover:-translate-y-0.5 hover:border-[var(--ink)]"><div className="flex flex-wrap justify-between gap-3"><p className="text-xs font-bold text-[var(--signal)]">{review.publicId}</p><div className="flex gap-2">{review.isFixture ? <span className="bg-[var(--yellow)] px-2 text-xs font-bold">Demo Fixture</span> : null}<span className="text-xs font-bold uppercase">{review.status}</span></div></div><h2 className="display mt-4 text-2xl font-semibold">{review.caseType}</h2><p className="mt-3 text-sm">{review.participantAlias || "Unresolved participant"} · {review.participantPublicId || "—"}</p><p className="mt-2 text-xs text-[var(--muted)]">{review.uploadPublicId || review.assignmentPublicId || review.videoAssetPublicId || "—"} · {review.decisionType || "no decision"}</p><p className="mt-3 line-clamp-2 text-xs text-[var(--muted)]">{review.reason || "No machine reason"}</p></Link>)}</div>{result.items.length === 0 ? <p className="py-12 text-center text-sm text-[var(--muted)]">当前筛选没有 ReviewCase。</p> : null}{result.nextCursor ? <Link href={`?${new URLSearchParams({ ...(query.status ? { status: query.status } : {}), ...(query.caseType ? { caseType: query.caseType } : {}), cursor: result.nextCursor }).toString()}`} className="mt-8 inline-block font-bold text-[var(--teal)]">下一页 →</Link> : null}</main>;
}
