import Link from "next/link";
import { requireParticipant } from "@/src/server/auth";
import { getParticipantUpload } from "@/src/server/services/uploads";

export const dynamic = "force-dynamic";

export default async function ParticipantUploadPage({ params }: { params: Promise<{ uploadPublicId: string }> }) {
  const viewer = await requireParticipant();
  const { uploadPublicId } = await params;
  const upload = await getParticipantUpload(viewer, uploadPublicId);
  const statusLayers = [
    ["Transfer", upload.transferStatus],
    ["Object reconciliation", upload.transferStatus === "verified" ? "verified" : upload.failureCode || "pending"],
    ["Metadata", upload.metadataStatus],
    ["Match", upload.asset?.decisionType || "pending"],
  ];
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-8">
      <Link href="/participant/uploads" className="text-sm font-bold text-[var(--teal)]">← 上传列表</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7"><p className="text-xs font-bold text-[var(--signal)]">{upload.uploadPublicId}</p><h1 className="display mt-3 break-all text-4xl font-semibold">{upload.originalFilename}</h1><p className="mt-3 text-sm text-[var(--muted)]">{upload.sizeBytes.toLocaleString()} bytes · {upload.contentType}</p></header>
      <section className="mt-8 grid gap-3 sm:grid-cols-2">{statusLayers.map(([label, status]) => <article key={label} className="border border-[var(--line)] bg-white/40 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p><p className="display mt-2 text-2xl font-semibold">{status}</p></article>)}</section>
      <section className="mt-10"><h2 className="display text-2xl font-semibold">Upload Attempts</h2><div className="mt-4 space-y-3">{upload.attempts.map((attempt) => <article key={attempt.publicId} className="border border-[var(--line)] bg-white/35 p-4"><div className="flex justify-between gap-3"><p className="font-bold">#{attempt.attemptNumber} · {attempt.publicId}</p><span className="text-xs font-bold uppercase">{attempt.status}</span></div><p className="mt-2 text-xs text-[var(--muted)]">bytes {attempt.bytesUploaded.toLocaleString()} · expires {attempt.expiresAt?.toLocaleString("zh-CN") || "—"} · {attempt.errorCode || "no error"}</p></article>)}</div></section>
    </main>
  );
}
