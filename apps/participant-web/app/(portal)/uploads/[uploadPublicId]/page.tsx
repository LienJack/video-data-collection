import { Card } from "@egocapture/ui/components/card";
import Link from "next/link";
import { requireParticipant } from "@/lib/auth";
import { getParticipantUpload } from "@egocapture/core/server/services/uploads";

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
    <main className="content-page max-w-3xl">
      <Link href="/uploads" className="text-sm font-bold text-[var(--teal)]">← 上传列表</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7"><p className="page-kicker">{upload.uploadPublicId}</p><h1 className="page-title break-all">{upload.originalFilename}</h1><p className="mt-3 text-sm text-[var(--muted)]">{upload.sizeBytes.toLocaleString()} bytes · {upload.contentType}</p></header>
      <section className="mt-8 grid gap-3 sm:grid-cols-2">{statusLayers.map(([label, status]) => <Card as="article" key={label} className="border border-[var(--line)] bg-white/40 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p><p className="display mt-2 text-2xl font-semibold">{status}</p></Card>)}</section>
      <section className="mt-10"><h2 className="display text-2xl font-semibold">Upload Attempts</h2><div className="mt-4 space-y-3">{upload.attempts.map((attempt) => <Card as="article" key={attempt.publicId} className="border border-[var(--line)] bg-white/35 p-4"><div className="flex justify-between gap-3"><p className="font-bold">#{attempt.attemptNumber} · {attempt.publicId}</p><span className="text-xs font-bold uppercase">{attempt.status}</span></div><p className="mt-2 text-xs text-[var(--muted)]">bytes {attempt.bytesUploaded.toLocaleString()} · expires {attempt.expiresAt?.toLocaleString("zh-CN") || "—"} · {attempt.errorCode || "no error"}</p></Card>)}</div></section>
      {upload.asset ? <section className="mt-10"><h2 className="display text-2xl font-semibold">轻量 Metadata</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Card as="article" className="border border-[var(--line)] bg-white/35 p-4"><p className="text-xs font-bold uppercase text-[var(--muted)]">Container / Codec</p><p className="mt-2 font-bold">{upload.asset.containerFormat || "Metadata Unavailable"} · {upload.asset.videoCodec || "—"}</p><p className="mt-2 text-xs text-[var(--muted)]">{upload.asset.width && upload.asset.height ? `${upload.asset.width} × ${upload.asset.height}` : "resolution unavailable"} · {upload.asset.frameRate ? `${upload.asset.frameRate} FPS` : "FPS unavailable"}</p></Card><Card as="article" className="border border-[var(--line)] bg-white/35 p-4"><p className="text-xs font-bold uppercase text-[var(--muted)]">Evidence</p><p className="mt-2 font-bold">Device {upload.asset.deviceConsistency || "pending"}</p><p className="mt-2 text-xs text-[var(--muted)]">Capture time: {upload.asset.captureTimeSource || "unknown"} · Review {upload.asset.reviewCount}</p></Card></div><div className="mt-3 space-y-2">{upload.metadataAttempts.map((attempt) => <p key={attempt.attemptNumber} className="border border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">Metadata #{attempt.attemptNumber} · {attempt.status} · {attempt.rangeRequestCount}/24 ranges · {attempt.bytesRead.toLocaleString()}/16,777,216 bytes · {attempt.errorCode || "no warning"}</p>)}</div></section> : null}
    </main>
  );
}
