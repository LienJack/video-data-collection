"use client";

import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) router.push("/login");
  }

  return (
    <button type="button" onClick={logout} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]">
      <SignOut className="size-4" weight="duotone" />
      <span className="hidden sm:inline">退出</span>
    </button>
  );
}
