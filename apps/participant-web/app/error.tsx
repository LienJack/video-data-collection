"use client";

import { Button } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import { WarningCircle } from "@phosphor-icons/react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-lg p-8 text-center sm:p-12">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--teal-soft)] text-[var(--signal)]"><WarningCircle className="size-7" weight="duotone" /></span>
        <p className="page-kicker mt-7">Safe failure</p>
        <h1 className="display mt-2 text-3xl font-semibold">这一页暂时没有加载成功</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">业务数据没有被修改。请重试；若问题持续，可返回上一页继续操作。</p>
        <Button onClick={reset} className=" mt-7">重新加载</Button>
      </Card>
    </main>
  );
}
