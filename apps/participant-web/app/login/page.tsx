import { CheckCircle, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[0.92fr_1.08fr]">
      <section className="relative hidden overflow-hidden bg-[var(--ink)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-28 top-1/3 size-96 rounded-full bg-[rgb(57_117_173_/_22%)] blur-3xl" aria-hidden="true" />
        <Link href="/" className="display relative z-10 text-xl font-semibold">EgoCapture</Link>
        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Field operation</p>
          <blockquote className="display mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.055em]">
            采集不是一个上传按钮，而是一条需要被证明的过程。
          </blockquote>
          <div className="mt-10 grid grid-cols-2 gap-3 text-sm text-white/65">
            <p className="flex items-center gap-2"><CheckCircle className="size-4 text-white" weight="fill" /> 私有对象存储</p>
            <p className="flex items-center gap-2"><CheckCircle className="size-4 text-white" weight="fill" /> 追加写审计</p>
          </div>
        </div>
        <p className="relative z-10 text-xs leading-6 text-white/45">Demo 仅使用合成身份与无敏感信息的视频。</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-lg reveal">
          <Link href="/" className="display mb-16 inline-block text-xl font-semibold lg:hidden">EgoCapture</Link>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--teal-soft)] text-[var(--signal-dark)]">
            <ShieldCheck className="size-6" weight="duotone" />
          </div>
          <p className="page-kicker mt-8">Participant access</p>
          <h1 className="page-title">继续你的采集任务</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">使用邀请中 PT 开头的 Participant ID 登录。管理控制台位于独立域名。</p>
          <div className="surface mt-8 p-5 sm:p-7"><LoginForm /></div>
        </div>
      </section>
    </main>
  );
}
