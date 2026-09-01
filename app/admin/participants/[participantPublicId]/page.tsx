import Link from "next/link";
import { ParticipantControls } from "@/app/admin/participants/[participantPublicId]/participant-controls";
import { requireAdmin } from "@/src/server/auth";
import { getParticipant, listDevices } from "@/src/server/services/participants";

export const dynamic = "force-dynamic";

export default async function ParticipantDetailPage({ params }: { params: Promise<{ participantPublicId: string }> }) {
  const viewer = await requireAdmin();
  const { participantPublicId } = await params;
  const [participant, devices] = await Promise.all([
    getParticipant(viewer, participantPublicId),
    listDevices(viewer, participantPublicId),
  ]);
  return (
    <main className="px-5 py-8 sm:px-10">
      <Link href="/admin/participants" className="text-sm font-bold text-[var(--teal)]">← Participants</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <div className="flex flex-wrap items-center gap-3"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--signal)]">{participant.publicId}</p>{participant.isFixture ? <span className="bg-[var(--yellow)] px-2 py-1 text-xs font-bold">Demo Fixture</span> : null}</div>
        <h1 className="display mt-2 text-5xl font-semibold">{participant.displayAlias}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{participant.studyName} · {participant.studyPublicId}</p>
      </header>
      <div className="grid gap-8 py-8 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="space-y-3">
          {[
            ["Status", participant.status], ["Consent", `${participant.consentStatus} · ${participant.consentVersion}`],
            ["Locale", `${participant.locale} · ${participant.timezone}`], ["Region", participant.countryRegion || "—"],
            ["Management email", participant.managementEmail || "—"], ["Default device", participant.defaultDevicePublicId || "—"],
          ].map(([label, value]) => <div key={label} className="grid grid-cols-[140px_1fr] border-b border-[var(--line)] py-3 text-sm"><span className="font-bold text-[var(--muted)]">{label}</span><span>{value}</span></div>)}
          <div className="pt-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{participant.notes || "—"}</p></div>
        </section>
        <ParticipantControls
          participantPublicId={participant.publicId}
          status={participant.status}
          isFixture={participant.isFixture}
          fixtureProtected={viewer.isDemoAdmin && participant.isFixture}
          profile={{
            displayAlias: participant.displayAlias,
            managementEmail: participant.managementEmail,
            locale: participant.locale,
            timezone: participant.timezone,
            countryRegion: participant.countryRegion,
            notes: participant.notes,
            updatedAt: participant.updatedAt.toISOString(),
          }}
          invitationStatus={participant.invitationStatus}
          invitationExpiresAt={participant.invitationExpiresAt?.toISOString() ?? null}
          devices={devices.map((device) => ({ ...device, assignedAt: device.assignedAt.toISOString(), updatedAt: device.updatedAt.toISOString() }))}
        />
      </div>
    </main>
  );
}
