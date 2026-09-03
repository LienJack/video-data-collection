import { buttonVariants } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import { LockKey, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { MarkerControls } from "@/app/(portal)/sessions/[sessionPublicId]/marker-controls";
import { requireParticipant } from "@/lib/auth";
import { getMarker } from "@egocapture/core/server/services/sessions";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

export default async function SessionMarkerPage({ params }: { params: Promise<{ sessionPublicId: string }> }) {
  const [viewer, { sessionPublicId }, locale] = await Promise.all([requireParticipant(), params, requestLocale()]);
  const i18n = createTranslator(locale);
  const marker = await getMarker(viewer, sessionPublicId);
  return (
    <main className="content-page max-w-3xl">
      <div className="flex justify-between gap-4"><Link href="/tasks" className={buttonVariants({ variant: "outline", className: "" })}>← {i18n.t("participantUi.myTasks")}</Link><Link href={{ pathname: "/uploads", query: { session: marker.sessionPublicId } }} className={buttonVariants({ className: "" })}>{i18n.t("participantUi.uploadFiles")} → <UploadSimple className="size-4" /></Link></div>
      <header className="mt-10 text-left">
        <div className="flex items-center gap-2"><LockKey className="size-5 text-[var(--signal)]" weight="duotone" /><p className="page-kicker">{i18n.t("participantUi.signedMarker")} · {marker.keyId}</p></div>
        <h1 className="page-title">{marker.sessionPublicId}</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">{i18n.t("common.device")} {marker.devicePublicId} · {i18n.t("participantUi.validUntil", { date: i18n.date(marker.expiresAt, { dateStyle: "medium", timeStyle: "short" }) })}</p>
      </header>
      <Card className="mt-8 p-4 sm:p-8">
        <div className="rounded-[20px] bg-white p-3 sm:p-5"><Image src={marker.qrDataUrl} alt={i18n.t("participantUi.markerQrAlt", { session: marker.sessionPublicId })} width={900} height={900} unoptimized className="mx-auto aspect-square w-full max-w-xl" /></div>
        <div className="mt-6 border-t border-[var(--line)] pt-6 text-center"><p className="page-kicker text-[var(--muted)]">{i18n.t("participantUi.shortCode")}</p><p className="display mt-2 text-5xl font-semibold tracking-[0.12em] sm:text-6xl">{marker.shortCode}</p><p className="mx-auto mt-4 max-w-xl text-xs leading-6 text-[var(--muted)]">{i18n.t("participantUi.markerPrivacy")}</p></div>
      </Card>
      <MarkerControls sessionPublicId={marker.sessionPublicId} qrDataUrl={marker.qrDataUrl} markerAcknowledgedAt={marker.markerAcknowledgedAt} sessionStatus={marker.sessionStatus} />
    </main>
  );
}
