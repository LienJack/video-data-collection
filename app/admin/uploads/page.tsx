import Link from "next/link";
import { requireAdmin } from "@/src/server/auth";
import { listAdminUploads } from "@/src/server/services/review";

export const dynamic = "force-dynamic";

export default async function AdminUploadsPage() {
  const viewer = await requireAdmin();
  const uploads = await listAdminUploads(viewer);
  return <main className="px-5 py-8 sm:px-10"><header className="border-b border-[var(--line)] pb-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--teal)]">Transfer / Metadata / Match</p><h1 className="display mt-2 text-5xl font-semibold">Uploads</h1></header><div className="mt-8 grid gap-4 xl:grid-cols-2">{uploads.map((upload) => <Link href={`/admin/uploads/${upload.publicId}`} key={upload.publicId} className="border border-[var(--line)] bg-white/35 p-6"><div className="flex flex-wrap justify-between gap-3"><p className="text-xs font-bold text-[var(--signal)]">{upload.publicId}</p><span className="text-xs font-bold uppercase">{upload.transferStatus}</span></div><h2 className="mt-4 break-all font-bold">{upload.originalFilename}</h2><p className="mt-3 text-sm">{upload.participantAlias} · {upload.participantPublicId}</p><p className="mt-2 text-xs text-[var(--muted)]">metadata {upload.metadataStatus} · match {upload.decisionType || "pending"} · device {upload.deviceConsistency || "pending"} · review {upload.reviewCount}</p></Link>)}</div></main>;
}
