import Link from "next/link";
import { NewParticipantForm } from "@/app/(console)/participants/new/new-participant-form";
import { requireAdmin } from "@/lib/auth";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export default async function NewParticipantPage() {
  await requireAdmin();
  const locale = await requestLocale();
  const i18n = createTranslator(locale);
  return (
    <main className="content-page">
      <Link href="/participants" className="text-sm font-bold text-[var(--teal)]">← {i18n.t("adminUi.participantsBack")}</Link>
      <p className="page-kicker mt-10">{i18n.t("adminUi.createRegistryEntry")}</p>
      <h1 className="page-title">{i18n.t("adminUi.createParticipant")}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">{i18n.t("adminUi.createParticipantHelp")}</p>
      <NewParticipantForm />
    </main>
  );
}
