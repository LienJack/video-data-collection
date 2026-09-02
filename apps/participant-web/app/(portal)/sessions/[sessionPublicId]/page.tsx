import { LockKey, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { MarkerControls } from "@/app/(portal)/sessions/[sessionPublicId]/marker-controls";
import { requireParticipant } from "@/lib/auth";
import { getMarker } from "@egocapture/core/server/services/sessions";

export const dynamic = "force-dynamic";

export default async function SessionMarkerPage({ params }: { params: Promise<{ sessionPublicId: string }> }) {
  const viewer = await requireParticipant();
  const { sessionPublicId } = await params;
  const marker = await getMarker(viewer, sessionPublicId);
  return (
    <main className="content-page max-w-3xl">
      <div className="flex justify-between gap-4"><Link href="/tasks" className="secondary-action">← 我的任务</Link><Link href="/uploads" className="primary-action">上传文件 → <UploadSimple className="size-4" /></Link></div>
      <header className="mt-10 text-left">
        <div className="flex items-center gap-2"><LockKey className="size-5 text-[var(--signal)]" weight="duotone" /><p className="page-kicker">Signed Session Marker · {marker.keyId}</p></div>
        <h1 className="page-title">{marker.sessionPublicId}</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">Device {marker.devicePublicId} · 有效至 {new Date(marker.expiresAt).toLocaleString("zh-CN")}</p>
      </header>
      <section className="surface-solid mt-8 p-4 sm:p-8">
        <div className="rounded-[20px] bg-white p-3 sm:p-5"><Image src={marker.qrDataUrl} alt={`Recording Session ${marker.sessionPublicId} 的签名二维码`} width={900} height={900} unoptimized className="mx-auto aspect-square w-full max-w-xl" /></div>
        <div className="mt-6 border-t border-[var(--line)] pt-6 text-center"><p className="page-kicker text-[var(--muted)]">Short code</p><p className="display mt-2 text-5xl font-semibold tracking-[0.12em] sm:text-6xl">{marker.shortCode}</p><p className="mx-auto mt-4 max-w-xl text-xs leading-6 text-[var(--muted)]">二维码仅包含 Session、Assignment、Device Public ID、时间、nonce 和 Ed25519 签名，不含姓名、邮箱或 Study。</p></div>
      </section>
      <MarkerControls sessionPublicId={marker.sessionPublicId} qrDataUrl={marker.qrDataUrl} markerAcknowledgedAt={marker.markerAcknowledgedAt} sessionStatus={marker.sessionStatus} />
    </main>
  );
}
