"use client";

import {
  ClipboardText,
  Database,
  HardDrives,
  Pulse,
  Radio,
  Scan,
  Scroll,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primaryNavigation = [
  { href: "/dashboard", label: "总览", icon: Pulse },
  { href: "/tasks", label: "采集任务", icon: ClipboardText },
  { href: "/participants", label: "参与者", icon: UsersThree },
  { href: "/review", label: "待处理", icon: Scan },
] as const;

const dataNavigation = [
  { href: "/sessions", label: "录制会话", icon: Radio },
  { href: "/uploads", label: "上传记录", icon: HardDrives },
  { href: "/audit", label: "审计日志", icon: Scroll },
] as const;

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNavigation() {
  const pathname = usePathname();
  const dataRouteCurrent = dataNavigation.some(({ href }) => isCurrent(pathname, href));
  const [dataOpen, setDataOpen] = useState(false);
  return (
    <>
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
      <details open={dataRouteCurrent || dataOpen} onToggle={(event) => { if (!dataRouteCurrent) setDataOpen(event.currentTarget.open); }} className="group mt-5 border-t border-white/10 pt-5">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/54 transition-colors hover:bg-white/9 hover:text-white">
          <Database className="size-[19px]" weight="duotone" />
          数据记录
          <span aria-hidden="true" className="ml-auto text-xs transition-transform group-open:rotate-90">›</span>
        </summary>
        <nav className="mt-1 space-y-1 pl-3" aria-label="数据记录">
          {dataNavigation.map(({ href, label, icon: Icon }) => {
            const current = isCurrent(pathname, href);
            return <Link key={href} href={href} aria-current={current ? "page" : undefined} className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-semibold ${current ? "bg-white/12 text-white" : "text-white/48 hover:bg-white/8 hover:text-white"}`}><Icon className="size-4" weight="duotone" />{label}</Link>;
          })}
        </nav>
      </details>
    </>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav className="mobile-tab-bar lg:hidden" aria-label="主要管理导航">
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
      {[...primaryNavigation, ...dataNavigation].map(({ href, label, icon: Icon }) => {
        const current = isCurrent(pathname, href);
        return <Link key={href} href={href} aria-current={current ? "page" : undefined} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${current ? "bg-white/14 text-white" : "text-white/66 hover:bg-white/10 hover:text-white"}`}><Icon className="size-4" weight="duotone" />{label}</Link>;
      })}
    </nav>
  );
}
