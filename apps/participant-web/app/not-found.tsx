import { buttonVariants } from "@egocapture/ui/components/button";
import { Card } from "@egocapture/ui/components/card";
import { Compass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-lg p-8 text-center sm:p-12">
        <Compass className="mx-auto size-12 text-[var(--signal)]" weight="duotone" />
        <p className="page-kicker mt-7">404 / Not found</p>
        <h1 className="display mt-2 text-4xl font-semibold">这条采集路径不存在</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">链接可能已经失效，或当前账号无权访问对应对象。</p>
        <Link href="/" className={buttonVariants({ className: " mt-7" })}>返回首页</Link>
      </Card>
    </main>
  );
}
