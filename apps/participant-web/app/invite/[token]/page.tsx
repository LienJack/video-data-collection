import Link from "next/link";
import { Card } from "@egocapture/ui/components/card";
import { AcceptInvitationForm } from "@/app/invite/[token]/accept-form";
import { openInvitation } from "@egocapture/core/server/services/participants";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";
import { LanguageSwitcher } from "@egocapture/ui/components/language-switcher";

export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, locale] = await Promise.all([params, requestLocale()]);
  const { t } = createTranslator(locale);
  const valid = await openInvitation(token);
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-lg p-7 sm:p-10">
        <div className="mb-5 flex justify-end"><LanguageSwitcher /></div>
        <p className="page-kicker">{t("participantUi.invitationActivation")}</p>
        <h1 className="page-title text-[clamp(2.5rem,7vw,4rem)]">{valid ? t("participantUi.acceptResearch") : t("participantUi.invitationInvalid")}</h1>
        {valid ? (
          <>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{t("participantUi.invitationBody")}</p>
            <AcceptInvitationForm token={token} />
          </>
        ) : (
          <div className="mt-8">
            <p className="text-sm leading-7 text-[var(--muted)]">{t("participantUi.invitationContactAdmin")}</p>
            <Link href="/login" className="mt-6 inline-block border-b-2 border-[var(--signal)] pb-1 font-semibold">{t("participantUi.backToLogin")}</Link>
          </div>
        )}
      </Card>
    </main>
  );
}
