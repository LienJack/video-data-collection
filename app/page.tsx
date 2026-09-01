import { ArrowUpRight, CheckCircle, Database, Fingerprint, QrCode, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { MagneticLink } from "@/app/_components/magnetic-link";

const steps = [
  { code: "01", title: "冻结任务", copy: "发布不可变 TaskVersion，让每次采集都绑定清晰、可追溯的说明。", icon: Fingerprint },
  { code: "02", title: "标记录制", copy: "为应用外录制生成不含个人信息的 Ed25519 签名二维码。", icon: QrCode },
  { code: "03", title: "直接上传", copy: "视频以 6 MiB 分片直达私有 Storage，不经过 Next.js 数据面。", icon: UploadSimple },
];

export default function Home() {
  return (
    <main className="min-h-[100dvh] overflow-hidden px-5 py-5 sm:px-8 lg:px-12">
      <header className="surface mx-auto flex max-w-[1500px] items-center justify-between rounded-full px-5 py-3 sm:px-6">
        <Link href="/" className="display text-lg font-semibold tracking-[-0.04em]">EgoCapture</Link>
        <div className="hidden items-center gap-2 text-xs text-[var(--muted)] sm:flex">
          <span className="size-1.5 rounded-full bg-[var(--signal)]" />
          Research operations system
        </div>
        <Link href="/login" className="secondary-action min-h-9 px-4 py-2">
          登录 <ArrowUpRight className="size-4" weight="bold" />
        </Link>
      </header>

      <section className="relative mx-auto grid max-w-[1500px] gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-28">
        <div className="reveal relative z-10 max-w-4xl">
          <p className="page-kicker flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-[var(--signal)]" />
            Egocentric video fieldwork
          </p>
          <h1 className="display mt-6 text-[clamp(3.8rem,8vw,8.8rem)] font-semibold leading-[0.88] tracking-[-0.075em]">
            让每段录制，
            <br />
            <span className="text-[var(--signal)]">都有来路。</span>
          </h1>
          <p className="mt-8 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
            从不可变任务、应用外录制，到断点直传与人工复核。EgoCapture 把第一人称视频采集变成一条可信、可恢复的证据链。
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <MagneticLink href="/login">
              进入控制台 <ArrowUpRight className="size-4" weight="bold" />
            </MagneticLink>
            <p className="max-w-xs text-xs leading-5 text-[var(--muted)]">公开 Demo 仅使用合成身份与无敏感信息视频。</p>
          </div>
        </div>

        <aside className="reveal-delay relative min-h-[560px]">
          <div className="absolute right-[-15%] top-[-18%] size-[430px] rounded-full bg-[rgb(57_117_173_/_10%)] blur-3xl" aria-hidden="true" />
          <div className="surface absolute inset-x-0 top-6 p-7 sm:left-10 sm:p-9">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="page-kicker">Live architecture</p>
                <h2 className="display mt-2 text-3xl font-semibold">控制面与数据面分离</h2>
              </div>
              <span className="status-pill">Ready</span>
            </div>
            <div className="mt-9 space-y-1">
              {["浏览器创建 UploadIntent", "Storage 接收 TUS 字节", "PostgreSQL 保存业务权威"].map((item, index) => (
                <div key={item} className="flex items-center gap-4 border-b border-[var(--line)] py-4 last:border-0">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--paper)] text-xs font-semibold">{index + 1}</span>
                  <p className="text-sm font-medium">{item}</p>
                  <CheckCircle className="ml-auto size-5 text-[var(--signal)]" weight="fill" />
                </div>
              ))}
            </div>
          </div>
          <div className="surface-solid absolute bottom-0 right-0 grid w-[78%] grid-cols-2 gap-px overflow-hidden p-1 sm:w-[72%]">
            <Metric value="50 MB" label="单文件上限" />
            <Metric value="6 MiB" label="TUS 分片" />
            <Metric value="24 h" label="Marker 有效期" />
            <Metric value="0 byte" label="经 Next.js 视频" accent />
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-[1500px] pb-16 lg:pb-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="page-kicker">Operational chain</p>
            <h2 className="display mt-2 text-3xl font-semibold sm:text-5xl">三个清晰节点，一条完整证据链。</h2>
          </div>
          <p className="flex items-center gap-2 text-sm text-[var(--muted)]"><Database className="size-4" /> PostgreSQL 是业务权威</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.95fr_0.95fr]">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article key={step.code} className={`surface-solid group p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow)] ${index === 0 ? "lg:py-10" : ""}`}>
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold tracking-[0.16em] text-[var(--muted)]">{step.code}</span>
                  <span className="flex size-11 items-center justify-center rounded-full bg-[var(--teal-soft)] text-[var(--signal-dark)]"><Icon className="size-5" weight="duotone" /></span>
                </div>
                <h3 className="display mt-12 text-2xl font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{step.copy}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Metric({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-[18px] bg-[var(--paper)] p-4">
      <p className={`display text-2xl font-semibold ${accent ? "text-[var(--signal)]" : ""}`}>{value}</p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">{label}</p>
    </div>
  );
}
