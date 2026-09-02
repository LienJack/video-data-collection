import { ClipboardText, HardDrives, ListChecks, List, Pulse, Radio, Scan, Scroll, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { LogoutButton } from "@/app/(console)/logout-button";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const navigation = [
  ["/dashboard", "总览", Pulse],
  ["/participants", "Participants", UsersThree],
  ["/tasks", "Tasks", ClipboardText],
  ["/assignments", "Assignments", ListChecks],
  ["/sessions", "Sessions", Radio],
  ["/uploads", "Uploads", HardDrives],
  ["/review", "Review", Scan],
  ["/audit", "Audit", Scroll],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[264px_1fr]">
      <header className="glass-nav sticky top-0 z-50 mx-2 mt-2 flex items-center justify-between rounded-2xl px-4 py-2.5 text-white lg:hidden">
        <div><Link href="/dashboard" className="display text-lg font-semibold">EgoCapture</Link><p className="text-[10px] text-white/45">{viewer.displayName}</p></div>
        <details className="group relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-xs font-semibold text-white/75 hover:bg-white/10"><List className="size-5" weight="duotone" />全部功能</summary>
          <div className="absolute right-0 top-12 w-64 rounded-2xl border border-white/10 bg-[rgb(29_29_31_/_96%)] p-2 shadow-2xl">
            <nav className="grid grid-cols-2 gap-1" aria-label="全部管理功能">{navigation.map(([href, label, Icon]) => <Link key={href} href={href} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs text-white/72 hover:bg-white/10 hover:text-white"><Icon className="size-4" weight="duotone" />{label}</Link>)}</nav>
            <div className="mt-2 border-t border-white/10 pt-2"><LogoutButton className="min-h-11 w-full rounded-xl px-3 text-left text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white" /></div>
          </div>
        </details>
      </header>
      <aside className="glass-nav z-30 mx-3 mt-3 hidden rounded-[26px] px-4 py-4 text-white lg:sticky lg:top-3 lg:ml-3 lg:mr-0 lg:block lg:h-[calc(100dvh-1.5rem)] lg:px-4 lg:py-6">
        <div className="flex items-center justify-between px-2 lg:block">
          <Link href="/dashboard" className="display text-xl font-semibold tracking-[-0.04em]">EgoCapture</Link>
          <p className="hidden text-xs text-white/45 lg:mt-2 lg:block">Research operations</p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/65 lg:mt-5 lg:inline-flex">{viewer.displayName}</span>
        </div>
        <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:mt-9 lg:block lg:space-y-1" aria-label="管理导航">
          {navigation.map(([href, label, Icon]) => (
            <Link key={href} href={href} className="group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/66 transition hover:bg-white/10 hover:text-white">
              <Icon className="size-[18px]" weight="duotone" />{label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 px-3 pt-5 lg:absolute lg:bottom-6 lg:left-4 lg:right-4 lg:block"><LogoutButton /></div>
      </aside>
      <div className="min-w-0">{children}</div>
      <nav className="surface fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-40 grid w-[min(30rem,calc(100%-1rem))] -translate-x-1/2 grid-cols-4 gap-1 rounded-2xl p-1.5 shadow-[0_14px_45px_rgb(15_23_42_/_16%)] lg:hidden" aria-label="主要管理导航">
        {navigation.slice(0, 4).map(([href, label, Icon]) => <Link key={href} href={href} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold"><Icon className="size-[18px]" weight="duotone" />{label === "Participants" ? "参与者" : label === "Tasks" ? "任务" : label === "Assignments" ? "分配" : label}</Link>)}
      </nav>
    </div>
  );
}
