"use client";

import { Button } from "@egocapture/ui/components/button";
import { useRouter } from "next/navigation";
import { useTranslations } from "@egocapture/ui/lib/i18n";

export function LogoutButton({ className = "text-left text-xs font-bold uppercase tracking-[0.14em] text-white/55 hover:text-white" }: { className?: string }) {
  const router = useRouter();
  const t = useTranslations();
  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) router.push("/login");
  }
  return <Button type="button" variant="ghost" onClick={logout} className={className}>{t("nav.logout")}</Button>;
}
