"use client";

import { Button } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import { WarningCircle } from "@phosphor-icons/react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-lg p-8 text-center sm:p-12">
        <WarningCircle className="mx-auto size-12 text-[var(--signal)]" weight="duotone" />
        <p className="page-kicker mt-7">Safe failure</p>
        <h1 className="display mt-2 text-3xl font-semibold">控制台暂时没有加载成功</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">业务数据没有被修改，请稍后重试。</p>
        <Button onClick={reset} className=" mt-7">重新加载</Button>
      </Card>
    </main>
  );
}
