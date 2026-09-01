import Link from "next/link";
import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[0.8fr_1.2fr]">
      <section className="flex flex-col justify-between bg-[var(--ink)] p-7 text-[var(--paper)] sm:p-12">
        <Link href="/" className="display text-2xl font-semibold">EgoCapture</Link>
        <div className="my-20 max-w-lg">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-[var(--yellow)]">Field note / 001</p>
          <blockquote className="display text-4xl font-medium leading-tight tracking-[-0.035em] sm:text-6xl">
            采集不是一个上传按钮，而是一条需要被证明的过程。
          </blockquote>
        </div>
        <p className="text-xs leading-6 text-white/55">Demo 仅使用合成身份与无敏感信息的视频。</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md reveal">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[var(--teal)]">Workspace access</p>
          <h1 className="display text-5xl font-semibold tracking-[-0.045em]">进入采集现场</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">管理员使用邮箱；参与者使用 PT 开头的 Participant ID。</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
