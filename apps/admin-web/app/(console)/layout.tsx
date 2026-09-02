import { List } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { LogoutButton } from "@/app/(console)/logout-button";
import { DesktopNavigation, MobileAllFeatures, MobileNavigation, SystemGuideLink } from "@/app/(console)/console-navigation";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[264px_1fr]">
      <header className="glass-nav sticky top-0 z-50 mx-2 mt-2 flex items-center justify-between rounded-2xl px-4 py-2.5 text-white lg:hidden">
        <div><Link href="/dashboard" className="display text-lg font-semibold">EgoCapture</Link><p className="text-[10px] text-white/45">{viewer.displayName}</p></div>
        <div className="flex items-center gap-1">
          <SystemGuideLink compact />
          <details className="group relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-xs font-semibold text-white/75 hover:bg-white/10"><List className="size-5" weight="duotone" />全部功能</summary>
            <div className="absolute right-0 top-12 w-64 rounded-2xl border border-white/10 bg-[rgb(29_29_31_/_96%)] p-2 shadow-2xl">
              <MobileAllFeatures />
              <div className="mt-2 border-t border-white/10 pt-2"><LogoutButton className="min-h-11 w-full rounded-xl px-3 text-left text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white" /></div>
            </div>
          </details>
        </div>
      </header>
      <aside className="glass-nav z-30 mx-3 mt-3 hidden rounded-[26px] px-4 py-4 text-white lg:sticky lg:top-3 lg:ml-3 lg:mr-0 lg:block lg:h-[calc(100dvh-1.5rem)] lg:px-4 lg:py-6">
        <div className="flex items-center justify-between px-2 lg:block">
          <Link href="/dashboard" className="display text-xl font-semibold tracking-[-0.04em]">EgoCapture</Link>
          <p className="hidden text-xs font-medium tracking-[0.04em] text-white/45 lg:mt-2 lg:block">视频采集运营</p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/65 lg:mt-5 lg:inline-flex">{viewer.displayName}</span>
        </div>
        <DesktopNavigation />
        <div className="hidden border-t border-white/10 px-3 pt-5 lg:absolute lg:bottom-6 lg:left-4 lg:right-4 lg:block"><LogoutButton /></div>
      </aside>
      <div className="min-w-0">
        <div className="hidden min-h-16 items-center justify-end px-6 lg:flex xl:px-10"><SystemGuideLink /></div>
        {children}
      </div>
      <MobileNavigation />
    </div>
  );
}
