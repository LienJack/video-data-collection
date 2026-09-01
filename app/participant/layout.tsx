import { CheckSquare, CloudArrowUp, House } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[rgb(245_245_247_/_78%)] px-5 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/participant/tasks" className="display font-semibold">EgoCapture</Link>
          <span className="status-pill">Participant</span>
        </div>
      </header>
      {children}
      <nav className="surface fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 shadow-[0_14px_45px_rgb(15_23_42_/_16%)]" aria-label="参与者导航">
        <Link href="/participant/tasks" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold"><House className="size-4" weight="duotone" />任务</Link>
        <Link href="/participant/uploads" className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold"><CloudArrowUp className="size-4" weight="duotone" />上传</Link>
        <span className="hidden items-center gap-2 rounded-full px-4 py-2.5 text-xs text-[var(--muted)] sm:flex"><CheckSquare className="size-4" />可审计</span>
      </nav>
    </div>
  );
}
