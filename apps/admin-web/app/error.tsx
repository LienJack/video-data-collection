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
        <WarningCircle className="mx-auto size-12 text-[var(--signal)]" weight="duotone" />
        <p className="page-kicker mt-7">{t("shell.safeFailure")}</p>
        <h1 className="display mt-2 text-3xl font-semibold">{t("shell.adminErrorTitle")}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{t("shell.adminErrorBody")}</p>
        <Button onClick={reset} className=" mt-7">{t("shell.reload")}</Button>
      </Card>
    </main>
  );
}
