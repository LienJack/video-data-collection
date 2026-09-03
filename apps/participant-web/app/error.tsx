"use client";

import { Button } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import { WarningCircle } from "@phosphor-icons/react";
import { useI18n } from "@egocapture/ui/lib/i18n";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-lg p-8 text-center sm:p-12">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--teal-soft)] text-[var(--signal)]"><WarningCircle className="size-7" weight="duotone" /></span>
        <p className="page-kicker mt-7">{t("shell.safeFailure")}</p>
        <h1 className="display mt-2 text-3xl font-semibold">{t("shell.participantErrorTitle")}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{t("shell.participantErrorBody")}</p>
        <Button onClick={reset} className=" mt-7">{t("shell.reload")}</Button>
      </Card>
    </main>
  );
}
