"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ className = "text-left text-xs font-bold uppercase tracking-[0.14em] text-white/55 hover:text-white" }: { className?: string }) {
  const router = useRouter();
  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) router.push("/login");
  }
  return <button type="button" onClick={logout} className={className}>退出登录</button>;
}
