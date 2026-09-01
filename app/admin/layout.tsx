import Link from "next/link";
import { LayoutDashboard, Users } from "lucide-react";
import { LogoutButton } from "@/app/admin/logout-button";
import { requireAdmin } from "@/src/server/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-[var(--line)] bg-[var(--ink)] px-6 py-6 text-[var(--paper)] lg:min-h-screen lg:border-b-0 lg:border-r lg:py-8">
        <div className="flex items-center justify-between lg:block">
          <Link href="/admin/dashboard" className="display text-2xl font-semibold">EgoCapture</Link>
          <span className="text-xs text-white/50 lg:mt-2 lg:block">{viewer.displayName}</span>
        </div>
        <nav className="mt-6 flex gap-2 lg:mt-14 lg:block lg:space-y-2" aria-label="管理导航">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-3 py-3 text-sm hover:bg-white/10"><LayoutDashboard className="h-4 w-4" />总览</Link>
          <Link href="/admin/participants" className="flex items-center gap-3 px-3 py-3 text-sm hover:bg-white/10"><Users className="h-4 w-4" />Participants</Link>
        </nav>
        <div className="mt-8 lg:fixed lg:bottom-8"><LogoutButton /></div>
      </aside>
      <div>{children}</div>
    </div>
  );
}
