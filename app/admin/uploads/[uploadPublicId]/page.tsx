import Link from "next/link";
import { UploadActions } from "@/app/admin/uploads/[uploadPublicId]/upload-actions";
import { requireAdmin } from "@/src/server/auth";
import { getAdminUpload, listReviewCases } from "@/src/server/services/review";

export const dynamic = "force-dynamic";

export default async function AdminUploadPage({ params }: { params: Promise<{ uploadPublicId: string }> }) {
  const viewer = await requireAdmin();
  const { uploadPublicId } = await params;
  const [upload, reviews] = await Promise.all([getAdminUpload(viewer, uploadPublicId), listReviewCases(viewer, { limit: 100 })]);
  const related = reviews.items.filter((review) => review.uploadPublicId === uploadPublicId);
  return <main className="px-5 py-8 sm:px-10"><Link href="/admin/uploads" className="text-sm font-bold text-[var(--teal)]">← Uploads</Link><header className="mt-8 border-b border-[var(--line)] pb-7"><p className="text-xs font-bold text-[var(--signal)]">{upload.publicId}</p><h1 className="display mt-3 break-all text-4xl font-semibold">{upload.originalFilename}</h1><p className="mt-3 text-sm text-[var(--muted)]">{upload.participantAlias} · {upload.participantPublicId} · {upload.sizeBytes.toLocaleString()} bytes{upload.storageDeletedAt ? " · Demo object retention expired" : ""}</p><UploadActions uploadPublicId={upload.publicId} canPreview={upload.transferStatus === "verified" && !upload.storageDeletedAt} /></header><section className="mt-8 grid gap-4 sm:grid-cols-3">{[["Transfer",upload.transferStatus],["Metadata",upload.metadataStatus],["Match / Device",`${upload.decisionType || "pending"} / ${upload.deviceConsistency || "pending"}`]].map(([label,value]) => <article key={label} className="border border-[var(--line)] bg-white/35 p-5"><p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p><p className="display mt-2 text-2xl font-semibold">{value}</p></article>)}</section><section className="mt-10"><h2 className="display text-2xl font-semibold">相关 ReviewCase</h2><div className="mt-4 space-y-3">{related.map((review) => <Link key={review.publicId} href={`/admin/review/${review.publicId}`} className="block border border-[var(--line)] bg-white/35 p-4 font-bold">{review.publicId} · {review.caseType} · {review.status}</Link>)}{related.length === 0 ? <p className="text-sm text-[var(--muted)]">没有相关 ReviewCase。</p> : null}</div></section></main>;
}
