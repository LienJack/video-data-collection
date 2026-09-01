import Link from "next/link";
import Image from "next/image";
import { MarkerControls } from "@/app/participant/sessions/[sessionPublicId]/marker-controls";
import { requireParticipant } from "@/src/server/auth";
import { getMarker } from "@/src/server/services/sessions";

export const dynamic = "force-dynamic";

export default async function SessionMarkerPage({ params }: { params: Promise<{ sessionPublicId: string }> }) {
  const viewer = await requireParticipant();
  const { sessionPublicId } = await params;
  const marker = await getMarker(viewer, sessionPublicId);
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-8"><Link href="/participant/tasks" className="text-sm font-bold text-[var(--teal)]">← 我的任务</Link><header className="mt-8 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--signal)]">Signed Session Marker · {marker.keyId}</p><h1 className="display mt-3 text-4xl font-semibold">{marker.sessionPublicId}</h1><p className="mt-3 text-sm text-[var(--muted)]">Device {marker.devicePublicId} · 有效至 {new Date(marker.expiresAt).toLocaleString("zh-CN")}</p></header><section className="mt-8 border border-[var(--line)] bg-white p-4 shadow-[12px_12px_0_var(--ink)] sm:p-8"><Image src={marker.qrDataUrl} alt={`Recording Session ${marker.sessionPublicId} 的签名二维码`} width={900} height={900} unoptimized className="mx-auto aspect-square w-full max-w-xl" /><div className="mt-6 border-t border-[var(--line)] pt-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Short code</p><p className="display mt-2 text-5xl font-semibold tracking-[0.12em]">{marker.shortCode}</p><p className="mt-4 text-xs leading-6 text-[var(--muted)]">二维码仅包含 Session、Assignment、Device Public ID、时间、nonce 和 Ed25519 签名，不含姓名、邮箱或 Study。</p></div></section><MarkerControls sessionPublicId={marker.sessionPublicId} qrDataUrl={marker.qrDataUrl} markerAcknowledgedAt={marker.markerAcknowledgedAt} sessionStatus={marker.sessionStatus} /></main>;
}
