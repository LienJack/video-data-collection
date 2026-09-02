import { CloudArrowUp, House } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { LogoutButton } from "@/app/(portal)/logout-button";

export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[rgb(245_245_247_/_78%)] px-4 py-2.5 backdrop-blur-2xl sm:px-5 sm:py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/tasks" className="display font-semibold">EgoCapture</Link>
          <div className="flex items-center gap-1 sm:gap-2"><span className="status-pill">Participant</span><LogoutButton /></div>
        </div>
      </header>
      {children}
      <nav className="surface fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-40 grid w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2 grid-cols-2 gap-1 rounded-full p-1.5 shadow-[0_14px_45px_rgb(15_23_42_/_16%)]" aria-label="参与者导航">
        <Link href="/tasks" className="flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold"><House className="size-4" weight="duotone" />任务</Link>
        <Link href="/uploads" className="flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold"><CloudArrowUp className="size-4" weight="duotone" />上传</Link>
      </nav>
    </div>
  );
}
