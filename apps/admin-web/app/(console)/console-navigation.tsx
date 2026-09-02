"use client";

import {
  BookOpenText,
  ClipboardText,
  Pulse,
  Scan,
  StackSimple,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryNavigation = [
  { href: "/dashboard", label: "总览", icon: Pulse },
  { href: "/tasks", label: "采集任务", icon: ClipboardText },
  { href: "/participants", label: "参与者", icon: UsersThree },
  { href: "/review", label: "待处理", icon: Scan },
  { href: "/records", label: "采集记录", icon: StackSimple },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === "/records") return pathname === "/records" || pathname.startsWith("/uploads/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SystemGuideLink({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const current = isCurrent(pathname, "/system-guide");
  return (
    <Link
      href="/system-guide"
      aria-current={current ? "page" : undefined}
      aria-label={compact ? "系统说明" : undefined}
      className={compact
        ? `flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] ${current ? "bg-white/16 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`
        : `flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-sm outline-none transition-[background-color,border-color,color,transform] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${current ? "border-[var(--signal)]/20 bg-[var(--teal-soft)] text-[var(--signal-dark)]" : "border-white/80 bg-white/72 text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]"}`}
    >
      <BookOpenText className={compact ? "size-5" : "size-[18px]"} weight={current ? "fill" : "duotone"} aria-hidden="true" />
      {compact ? null : <span>系统说明</span>}
    </Link>
  );
}

export function DesktopNavigation() {
  const pathname = usePathname();
  return (
    <nav className="mt-9 space-y-1" aria-label="主要管理导航">
      {primaryNavigation.map(({ href, label, icon: Icon }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-[background-color,color,transform] ${current ? "bg-white/14 text-white shadow-[inset_0_1px_rgb(255_255_255_/_10%)]" : "text-white/62 hover:bg-white/9 hover:text-white"}`}
          >
            <Icon className="size-[19px]" weight={current ? "fill" : "duotone"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav className="mobile-tab-bar lg:hidden" aria-label="主要管理导航" style={{ gridTemplateColumns: `repeat(${primaryNavigation.length}, minmax(0, 1fr))` }}>
      {primaryNavigation.map(({ href, label, icon: Icon }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link key={href} href={href} aria-current={current ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-[background-color,color,transform] ${current ? "bg-white/78 text-[var(--signal-dark)] shadow-sm" : "text-[var(--muted)]"}`}>
            <Icon className="size-[19px]" weight={current ? "fill" : "duotone"} />{label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileAllFeatures() {
  const pathname = usePathname();
  return (
    <nav className="grid grid-cols-2 gap-1" aria-label="全部管理功能">
      {primaryNavigation.map(({ href, label, icon: Icon }) => {
        const current = isCurrent(pathname, href);
        return <Link key={href} href={href} aria-current={current ? "page" : undefined} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${current ? "bg-white/14 text-white" : "text-white/66 hover:bg-white/10 hover:text-white"}`}><Icon className="size-4" weight="duotone" />{label}</Link>;
      })}
    </nav>
  );
}
