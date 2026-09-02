import { ChartLineUp, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { AdminLoginForm } from "@/app/login/login-form";

export default function AdminLoginPage() {
  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[0.92fr_1.08fr]">
      <section className="relative hidden overflow-hidden bg-[var(--ink)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="display relative z-10 text-xl font-semibold">EgoCapture Ops</p>
        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Research operations</p>
          <h1 className="display mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.055em]">把每一次采集，变成可追踪的研究证据。</h1>
          <p className="mt-8 flex items-center gap-2 text-sm text-white/65"><ChartLineUp className="size-5" weight="duotone" />参与者、任务、上传与复核统一审计</p>
        </div>
        <p className="relative z-10 text-xs leading-6 text-white/45">仅供获授权的研究运营人员使用。</p>
      </section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-lg reveal">
          <p className="display mb-16 text-xl font-semibold lg:hidden">EgoCapture Ops</p>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--teal-soft)] text-[var(--signal-dark)]"><ShieldCheck className="size-6" weight="duotone" /></div>
          <p className="page-kicker mt-8">Admin access</p>
          <h1 className="page-title">管理控制台</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">管理员入口与参与者门户已完全分离。</p>
          <div className="surface mt-8 p-5 sm:p-7"><AdminLoginForm /></div>
        </div>
      </section>
    </main>
  );
}
