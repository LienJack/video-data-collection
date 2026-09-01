import Link from "next/link";
import { UploadActions } from "@/app/admin/uploads/[uploadPublicId]/upload-actions";
import { requireAdmin } from "@/src/server/auth";
import { getAdminUpload } from "@/src/server/services/review";

export const dynamic = "force-dynamic";

function value(item: unknown) {
  if (item === null || item === undefined || item === "") return "—";
  if (item instanceof Date) return item.toLocaleString("zh-CN");
  if (typeof item === "boolean") return item ? "yes" : "no";
  return String(item);
}

export default async function AdminUploadPage({ params }: { params: Promise<{ uploadPublicId: string }> }) {
  const viewer = await requireAdmin();
  const { uploadPublicId } = await params;
  const upload = await getAdminUpload(viewer, uploadPublicId);
  const metadataRows: Array<[string, unknown]> = upload.metadata ? [
    ["Parser", `${upload.metadata.parserName} ${upload.metadata.parserVersion}`],
    ["Container", upload.metadata.containerFormat],
    ["Duration", upload.metadata.durationMs === null ? null : `${upload.metadata.durationMs} ms`],
    ["Video", [upload.metadata.videoCodec, upload.metadata.width && upload.metadata.height ? `${upload.metadata.width} × ${upload.metadata.height}` : null, upload.metadata.frameRate ? `${upload.metadata.frameRate} FPS` : null].filter(Boolean).join(" · ")],
    ["Audio", [upload.metadata.audioCodec, upload.metadata.audioChannels === null ? null : `${upload.metadata.audioChannels} channels`].filter(Boolean).join(" · ")],
    ["Capture time", [upload.metadata.normalizedCaptureTime?.toLocaleString("zh-CN"), upload.metadata.captureTimeSource, upload.metadata.captureTimeConfidence, upload.metadata.timezoneOffset].filter(Boolean).join(" · ")],
    ["Camera", [upload.metadata.cameraManufacturer, upload.metadata.cameraModel].filter(Boolean).join(" ")],
    ["Serial HMAC", upload.metadata.cameraSerialHash ? `${upload.metadata.cameraSerialHash.slice(0, 12)}…` : null],
    ["GPS metadata present", upload.metadata.gpsMetadataPresent],
    ["Projection / 360", [upload.metadata.projectionType, upload.metadata.is360 === null ? null : upload.metadata.is360 ? "360" : "not 360"].filter(Boolean).join(" · ")],
    ["Device consistency", upload.metadata.deviceConsistency],
    ["Extracted", upload.metadata.extractedAt],
  ] : [];
  const claimRows: Array<[string, unknown]> = [
    ["Claimed Session", upload.claimedSessionPublicId || (upload.unableToDetermine ? "Unable to Determine" : null)],
    ["Local modified", upload.localModifiedAt],
    ["Participant note", upload.participantNote],
    ["Failure code", upload.failureCode],
    ["Verified at", upload.verifiedAt],
    ["Intent expires", upload.expectedExpiresAt],
    ["Video Asset", upload.videoAssetPublicId],
    ["Object key", upload.objectKey],
  ];

  return (
    <main className="app-page">
      <Link href="/admin/uploads" className="text-sm font-bold text-[var(--teal)]">← Uploads</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <p className="text-xs font-bold text-[var(--signal)]">{upload.publicId}</p>
        <h1 className="page-title break-all">{upload.originalFilename}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{upload.participantAlias} · {upload.participantPublicId} · {upload.sizeBytes.toLocaleString()} bytes · {upload.contentType}{upload.storageDeletedAt ? " · Demo object retention expired" : ""}</p>
        <UploadActions uploadPublicId={upload.publicId} canPreview={upload.transferStatus === "verified" && !upload.storageDeletedAt} />
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[["Transfer", upload.transferStatus], ["Metadata", upload.metadataStatus], ["Match / Device", `${upload.decisionType || "pending"} / ${upload.deviceConsistency || "pending"}`]].map(([label, item]) => <article key={label} className="border border-[var(--line)] bg-white/35 p-5"><p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p><p className="display mt-2 text-2xl font-semibold">{item}</p></article>)}
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-2">
        <article className="border border-[var(--line)] bg-white/35 p-6">
          <h2 className="display text-2xl font-semibold">对象与 Participant 声明</h2>
          <dl className="mt-5 space-y-3 text-sm">
            {claimRows.map(([label, item]) => <div key={label} className="grid grid-cols-[140px_1fr] gap-3 border-b border-[var(--line)] pb-3"><dt className="font-bold text-[var(--muted)]">{label}</dt><dd className="break-all">{value(item)}</dd></div>)}
          </dl>
        </article>
        <article className="border border-[var(--line)] bg-white/35 p-6">
          <h2 className="display text-2xl font-semibold">Upload Attempts</h2>
          <div className="mt-5 space-y-3">{upload.attempts.map((attempt) => <div key={attempt.publicId} className="border-l-2 border-[var(--teal)] pl-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">#{attempt.attemptNumber} · {attempt.publicId}</p><span className="text-xs font-bold uppercase">{attempt.status}</span></div><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{attempt.provider} · {attempt.bytesUploaded.toLocaleString()} bytes · {attempt.errorCode || "no error"}<br />{value(attempt.startedAt)} → {value(attempt.completedAt)} · expires {value(attempt.expiresAt)}</p></div>)}</div>
        </article>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl font-semibold">归一化 Metadata</h2>
        {upload.metadata ? <div className="mt-4 overflow-x-auto border border-[var(--line)]"><table className="w-full min-w-[680px] text-sm"><tbody>{metadataRows.map(([label, item]) => <tr key={label} className="border-t border-[var(--line)] first:border-t-0"><th className="w-52 bg-white/35 p-4 text-left text-[var(--muted)]">{label}</th><td className="p-4">{value(item)}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-[var(--muted)]">Metadata 尚不可用；Transfer 状态保持独立。</p>}
        <div className="mt-5 space-y-2">{upload.metadataAttempts.map((attempt) => <article key={attempt.attemptNumber} className="border border-[var(--line)] bg-white/35 p-4 text-xs"><div className="flex flex-wrap justify-between gap-3"><p className="font-bold">Metadata #{attempt.attemptNumber} · {attempt.parserName} {attempt.parserVersion}</p><span className="font-bold uppercase">{attempt.status}</span></div><p className="mt-2 text-[var(--muted)]">Range {attempt.rangeRequestCount}/24 · {attempt.bytesRead.toLocaleString()}/16,777,216 bytes · {attempt.errorCode || "no warning"} · {value(attempt.startedAt)} → {value(attempt.completedAt)}</p></article>)}</div>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-2">
        <article><h2 className="display text-2xl font-semibold">字段证据</h2><div className="mt-4 space-y-2">{upload.evidence.map((item) => <div key={item.fieldName} className="border border-[var(--line)] bg-white/35 p-4 text-xs"><p className="font-bold">{item.fieldName}: {JSON.stringify(item.normalizedValue)}</p><p className="mt-1 break-all text-[var(--muted)]">{item.parserName} · {item.source}</p></div>)}{upload.evidence.length === 0 ? <p className="text-sm text-[var(--muted)]">尚无 allowlist evidence。</p> : null}</div></article>
        <article><h2 className="display text-2xl font-semibold">相关 ReviewCase</h2><div className="mt-4 space-y-3">{upload.relatedReviews.map((review) => <Link key={review.publicId} href={`/admin/review/${review.publicId}`} className="block border border-[var(--line)] bg-white/35 p-4 font-bold">{review.publicId} · {review.caseType} · {review.status}{review.isFixture ? " · Demo Fixture" : ""}</Link>)}{upload.relatedReviews.length === 0 ? <p className="text-sm text-[var(--muted)]">没有相关 ReviewCase。</p> : null}</div></article>
      </section>
    </main>
  );
}
