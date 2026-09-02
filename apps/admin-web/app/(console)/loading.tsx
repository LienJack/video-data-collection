"use client";

import { Card } from "@egocapture/ui/components/card";
import { Skeleton } from "@egocapture/ui/components/skeleton";
import { useTranslations } from "@egocapture/ui/lib/i18n";

export default function AdminLoading() {
  const t = useTranslations();
  return (
    <main className="app-page" aria-busy="true" aria-label={t("shell.loadingAdmin")}>
      <Skeleton className="h-3 w-36" />
      <Skeleton className="mt-4 h-14 w-72 max-w-full" />
      <div className="mt-10 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="p-7"><Skeleton className="h-64" /></Card>
        <Card className="p-7"><Skeleton className="h-64" /></Card>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
    </main>
  );
}
