import { Badge } from "@egocapture/ui/components/badge";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Input } from "@egocapture/ui/components/input";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { adminUploadListSchema, listAdminUploads } from "@egocapture/core/server/services/review";

export const dynamic = "force-dynamic";

export default async function AdminUploadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const query = adminUploadListSchema.parse({ search: typeof params.search === "string" && params.search ? params.search : undefined, transferStatus: typeof params.transferStatus === "string" && params.transferStatus ? params.transferStatus : undefined, metadataStatus: typeof params.metadataStatus === "string" && params.metadataStatus ? params.metadataStatus : undefined, cursor: typeof params.cursor === "string" && params.cursor ? params.cursor : undefined, limit: 50 });
  const result = await listAdminUploads(viewer, query);
  const next = new URLSearchParams({ ...(query.search ? { search: query.search } : {}), ...(query.transferStatus ? { transferStatus: query.transferStatus } : {}), ...(query.metadataStatus ? { metadataStatus: query.metadataStatus } : {}), ...(result.nextCursor ? { cursor: result.nextCursor } : {}) });
  return (
    <main className="app-page">
      <header className="border-b border-[var(--line)] pb-7"><p className="page-kicker">Transfer / Metadata / Match</p><h1 className="page-title">Uploads</h1></header>
      <form className="rounded-xl border bg-card/80 text-card-foreground shadow-sm backdrop-blur-xl my-7 grid gap-3 p-3 sm:grid-cols-4"><Input name="search" defaultValue={query.search} placeholder="Upload / 文件名 / Participant" className="border border-[var(--line)] bg-[var(--paper)] px-3 py-3 sm:col-span-2" /><NativeSelect name="transferStatus" aria-label="Transfer Status" defaultValue={query.transferStatus ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><NativeSelectOption value="">全部 Transfer</NativeSelectOption>{["created","uploading","reconciling","verified","failed","aborted","expired"].map((item) => <NativeSelectOption key={item}>{item}</NativeSelectOption>)}</NativeSelect><NativeSelect name="metadataStatus" aria-label="Metadata Status" defaultValue={query.metadataStatus ?? ""} className="border border-[var(--line)] bg-[var(--paper)] px-3"><NativeSelectOption value="">全部 Metadata</NativeSelectOption>{["pending","processing","extracted","partial","unsupported","failed"].map((item) => <NativeSelectOption key={item}>{item}</NativeSelectOption>)}</NativeSelect><Button className=" sm:col-span-4">筛选</Button></form>
      <div className="grid gap-4 xl:grid-cols-2">{result.items.map((upload) => <Link href={`/uploads/${upload.publicId}`} key={upload.publicId} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow)]"><div className="flex flex-wrap justify-between gap-3"><p className="text-xs font-bold text-[var(--signal)]">{upload.publicId}</p><Badge>{upload.transferStatus}</Badge></div><h2 className="mt-4 break-all font-bold">{upload.originalFilename}</h2><p className="mt-3 text-sm">{upload.participantAlias} · {upload.participantPublicId}</p><p className="mt-2 text-xs text-[var(--muted)]">metadata {upload.metadataStatus} · match {upload.decisionType || "pending"} · device {upload.deviceConsistency || "pending"} · review {upload.reviewCount}</p></Link>)}</div>
      {result.items.length === 0 ? <Empty><EmptyDescription>当前筛选没有 Upload。</EmptyDescription></Empty> : null}
      {result.nextCursor ? <Link href={`?${next.toString()}`} className={buttonVariants({ variant: "outline", className: " mt-8" })}>下一页 →</Link> : null}
    </main>
  );
}
