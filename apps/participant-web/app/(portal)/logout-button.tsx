"use client";

import { Button } from "@egocapture/ui/components/button";
import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@egocapture/ui/lib/i18n";

export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations();

  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) router.push("/login");
  }

  return (
    <Button type="button" variant="ghost" onClick={logout} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]">
      <SignOut className="size-4" weight="duotone" />
      <span className="hidden sm:inline">{t("nav.logout")}</span>
    </Button>
  );
}
