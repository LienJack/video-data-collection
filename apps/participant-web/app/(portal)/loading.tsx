"use client";

import { Card } from "@egocapture/ui/components/card";
import { Skeleton } from "@egocapture/ui/components/skeleton";
import { useTranslations } from "@egocapture/ui/lib/i18n";

export default function ParticipantLoading() {
  const t = useTranslations();
  return (
    <main className="content-page max-w-3xl" aria-busy="true" aria-label={t("shell.loadingParticipant")}>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-4 h-12 w-64 max-w-full" />
      <Skeleton className="mt-5 h-5 w-full" />
      <Card className="mt-10 p-6"><Skeleton className="h-52" /></Card>
      <Card className="mt-4 p-6"><Skeleton className="h-36" /></Card>
    </main>
  );
}
