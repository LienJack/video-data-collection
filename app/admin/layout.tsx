import { ClipboardText, HardDrives, ListChecks, Pulse, Radio, Scan, Scroll, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { LogoutButton } from "@/app/admin/logout-button";
import { requireAdmin } from "@egocapture/core/server/auth";

export const dynamic = "force-dynamic";

const navigation = [
  ["/admin/dashboard", "总览", Pulse],
  ["/admin/participants", "Participants", UsersThree],
  ["/admin/tasks", "Tasks", ClipboardText],
  ["/admin/assignments", "Assignments", ListChecks],
  ["/admin/sessions", "Sessions", Radio],
  ["/admin/uploads", "Uploads", HardDrives],
  ["/admin/review", "Review", Scan],
  ["/admin/audit", "Audit", Scroll],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="glass-nav z-30 mx-3 mt-3 rounded-[26px] px-4 py-4 text-white lg:sticky lg:top-3 lg:ml-3 lg:mr-0 lg:h-[calc(100dvh-1.5rem)] lg:px-4 lg:py-6">
        <div className="flex items-center justify-between px-2 lg:block">
          <Link href="/admin/dashboard" className="display text-xl font-semibold tracking-[-0.04em]">EgoCapture</Link>
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
    </div>
  );
}
