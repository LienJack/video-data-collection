import { buttonVariants } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import { Compass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export default async function NotFound() {
  const { t } = createTranslator(await requestLocale());
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-lg p-8 text-center sm:p-12">
        <Compass className="mx-auto size-12 text-[var(--signal)]" weight="duotone" />
        <p className="page-kicker mt-7">404</p>
        <h1 className="display mt-2 text-4xl font-semibold">{t("shell.adminNotFoundTitle")}</h1>
        <Link href="/dashboard" className={buttonVariants({ className: " mt-7" })}>{t("nav.overview")}</Link>
      </Card>
    </main>
  );
}
