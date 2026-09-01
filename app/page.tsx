import { ArrowUpRight, CheckCircle2, Database, ScanLine, UploadCloud } from "lucide-react";
import Link from "next/link";

const steps = [
  { code: "01", title: "任务冻结", copy: "发布不可变说明版本，让每次采集都有可追溯上下文。" },
  { code: "02", title: "会话标记", copy: "为每次外部录制生成签名二维码和短码。" },
  { code: "03", title: "断点直传", copy: "视频从浏览器直达私有对象存储，不经过应用服务器。" },
  { code: "04", title: "证据复核", copy: "提取轻量元数据，并由研究人员保留人工决策链。" },
];

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-5 sm:px-8 lg:px-12">
      <header className="mx-auto flex max-w-[1500px] items-center justify-between border-b border-[var(--line)] pb-4">
        <div className="flex items-baseline gap-3">
          <span className="display text-2xl font-semibold tracking-[-0.03em]">EgoCapture</span>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] sm:inline">Research Operations</span>
        </div>
        <Link href="/login" className="group flex items-center gap-2 border-b border-[var(--ink)] pb-1 text-sm font-semibold">
          进入控制台
          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </header>

      <section className="mx-auto grid max-w-[1500px] gap-10 border-b border-[var(--line)] py-12 lg:grid-cols-[1.3fr_0.7fr] lg:py-20">
        <div className="reveal max-w-5xl">
          <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--teal)]">
            <span className="inline-block size-2 rounded-full bg-[var(--signal)]" />
            Egocentric video fieldwork system
          </p>
          <h1 className="display text-[clamp(3.4rem,8vw,8.4rem)] font-semibold leading-[0.86] tracking-[-0.065em]">
            让每段录制，
            <br />
            <em className="font-medium text-[var(--signal)]">都有来路。</em>
          </h1>
          <p className="mt-8 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
            从任务说明、外部录制到断点上传与人工复核，EgoCapture 把第一人称视频采集变成一条可审计、可恢复的证据链。
          </p>
        </div>

        <aside className="reveal flex flex-col justify-between border-l-0 border-[var(--line)] pt-3 lg:border-l lg:pl-10" style={{ animationDelay: "120ms" }}>
          <div className="grid grid-cols-2 gap-px bg-[var(--line)] border border-[var(--line)]">
            <Metric value="50 MB" label="Demo 单文件上限" />
            <Metric value="6 MiB" label="TUS 固定分片" />
            <Metric value="24 h" label="录制标记有效期" />
            <Metric value="0 byte" label="经 Vercel 的视频" signal />
          </div>
          <div className="mt-8 border-t border-[var(--line)] pt-5 text-sm leading-7 text-[var(--muted)]">
            <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--ink)]">
              <CheckCircle2 className="size-4 text-[var(--teal)]" />
              当前实施边界
            </div>
            生成录制二维码并由参与者手工选择会话；不做视频中的二维码识别，也不声称完成内容验证。
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-[1500px] py-10 lg:py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Operational chain</p>
            <h2 className="display text-4xl font-semibold tracking-[-0.035em]">四个不可越过的节点</h2>
          </div>
          <div className="hidden items-center gap-2 text-sm text-[var(--muted)] md:flex">
            <Database className="size-4" /> PostgreSQL 保存业务权威
          </div>
        </div>
        <div className="grid border-x border-t border-[var(--line)] md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <article key={step.code} className="group min-h-64 border-b border-r border-[var(--line)] p-6 transition-colors hover:bg-[var(--paper-deep)]">
              <div className="mb-14 flex items-start justify-between">
                <span className="display text-5xl font-semibold text-[var(--line)] transition-colors group-hover:text-[var(--signal)]">{step.code}</span>
                {index === 0 ? <ScanLine className="size-5" /> : index === 2 ? <UploadCloud className="size-5" /> : null}
              </div>
              <h3 className="mb-3 text-lg font-bold">{step.title}</h3>
              <p className="text-sm leading-7 text-[var(--muted)]">{step.copy}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ value, label, signal = false }: { value: string; label: string; signal?: boolean }) {
  return (
    <div className="bg-[var(--paper)] p-5">
      <div className={`display text-3xl font-semibold ${signal ? "text-[var(--signal)]" : ""}`}>{value}</div>
      <div className="mt-2 text-xs leading-5 text-[var(--muted)]">{label}</div>
    </div>
  );
}
