import { Compass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-12">
      <section className="surface-solid w-full max-w-lg p-8 text-center sm:p-12">
        <Compass className="mx-auto size-12 text-[var(--signal)]" weight="duotone" />
        <p className="page-kicker mt-7">404 / Not found</p>
        <h1 className="display mt-2 text-4xl font-semibold">这条管理路径不存在</h1>
        <Link href="/dashboard" className="primary-action mt-7">返回总览</Link>
      </section>
    </main>
  );
}
