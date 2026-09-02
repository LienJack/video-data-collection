import Link from "next/link";
import { FieldSessionPreview } from "@/app/_components/field-session-preview";
import { MagneticLink } from "@/app/_components/magnetic-link";
import styles from "@/app/home.module.css";

const proofPoints = [
  { value: "TaskVersion", label: "任务说明不可变" },
  { value: "Ed25519", label: "Session Marker 签名" },
  { value: "6 MiB", label: "可恢复上传分片" },
  { value: "0 byte", label: "视频经 Next.js" },
];

const workflow = [
  {
    code: "01",
    title: "接收一份不会变的任务",
    copy: "参与者看到的是已发布版本。后续草稿修改不会悄悄改变已经开始的采集。",
  },
  {
    code: "02",
    title: "在录制前建立 Session",
    copy: "系统生成不含个人信息的签名标记，让应用外拍摄也能与本次任务准确对应。",
  },
  {
    code: "03",
    title: "直接上传，交给人工复核",
    copy: "文件可暂停、可恢复地直达私有存储；异常和重复候选进入复核，不做草率的自动删除。",
  },
];

export default function Home() {
  return (
    <main className={`${styles.page} min-h-[100dvh] overflow-hidden px-4 pb-6 pt-3 sm:px-6 lg:px-10`}>
      <header className={`${styles.header} sticky top-3 mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-5`}>
        <Link href="/" className="display text-[1.05rem] font-semibold tracking-[-0.045em]">
          EgoCapture
        </Link>
        <p className="hidden text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--home-muted)] sm:block">
          Research field system
        </p>
        <Link href="/login" className={styles.navAction}>
          登录工作台
        </Link>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-12 pb-16 pt-16 md:pt-24 lg:grid-cols-12 lg:items-center lg:gap-8 lg:pb-28 lg:pt-24">
        <div className="lg:col-span-7 lg:pr-10 xl:pr-20">
          <p className={styles.kicker}>
            <span aria-hidden="true" />
            第一人称视频采集 / 工作台
          </p>
          <h1 className={`${styles.heroTitle} mt-7 max-w-[12ch]`}>
            视频记录现场。
            <span>我们记录来路。</span>
          </h1>
          <p className="mt-7 max-w-[39rem] text-[1rem] leading-8 text-[var(--home-muted)] sm:mt-8 sm:text-[1.08rem]">
            任务说明、录制会话、分片上传和人工复核，落在同一条证据链上。参与者按任务行动，研究团队随时知道每段视频为何采集、属于哪次会话、现在走到哪一步。
          </p>
          <div className={`${styles.heroActions} mt-9 flex flex-wrap items-center gap-5`}>
            <MagneticLink href="/login">进入工作台</MagneticLink>
            <Link href="#workflow" className={styles.textAction}>
              查看采集流程
            </Link>
          </div>
          <p className="mt-7 flex max-w-lg items-start gap-3 text-xs leading-6 text-[var(--home-muted)]">
            <span className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-[var(--home-accent)]" aria-hidden="true" />
            演示环境仅使用合成身份与无敏感信息的视频；真实采集仍需遵守项目知情同意与数据治理要求。
          </p>
        </div>

        <div className="lg:col-span-5">
          <FieldSessionPreview />
        </div>
      </section>

      <section className={`${styles.proofBand} mx-auto max-w-[1400px] px-6 py-8 sm:px-9 sm:py-10 lg:px-12`} aria-labelledby="proof-title">
        <div className="grid gap-9 lg:grid-cols-[1fr_2fr] lg:items-end">
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/48">Provenance, not just storage</p>
            <h2 id="proof-title" className="display mt-3 max-w-md text-2xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-3xl">
              每段视频都有可检查的上下文。
            </h2>
          </div>
          <dl className="grid grid-cols-2 border-l border-white/10 lg:grid-cols-4">
            {proofPoints.map((item) => (
              <div key={item.value} className="border-r border-white/10 px-4 py-1 last:border-r-0 sm:px-6">
                <dt className="font-mono text-lg font-medium tracking-[-0.04em] text-white sm:text-xl">{item.value}</dt>
                <dd className="mt-2 text-[0.7rem] leading-5 text-white/48">{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="workflow" className="mx-auto grid max-w-[1400px] gap-12 px-1 py-20 sm:px-3 lg:grid-cols-12 lg:gap-8 lg:py-32">
        <div className="lg:col-span-5">
          <p className={styles.kicker}>
            <span aria-hidden="true" />
            一次可信采集
          </p>
          <h2 className="display mt-6 max-w-[12ch] text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-5xl">
            参与者只管完成任务，研究团队掌握每一步。
          </h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-[var(--home-muted)]">
            常用路径保持简单，系统在背后保存任务版本、会话标记、上传状态与复核决定。
          </p>
        </div>

        <div className="lg:col-span-7 lg:pl-8">
          {workflow.map((step) => (
            <article key={step.code} className={styles.workflowRow}>
              <p className={styles.stepCode}>{step.code}</p>
              <div>
                <h3 className="display text-2xl font-semibold tracking-[-0.04em] sm:text-[1.75rem]">{step.title}</h3>
                <p className="mt-3 max-w-[42rem] text-sm leading-7 text-[var(--home-muted)]">{step.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className={`${styles.footer} mx-auto flex max-w-[1400px] flex-col gap-7 px-2 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-4`}>
        <div>
          <p className="display text-xl font-semibold tracking-[-0.04em]">准备好后，从身份验证开始。</p>
          <p className="mt-2 text-xs leading-5 text-[var(--home-muted)]">参与者使用 Participant ID，管理员使用工作邮箱。</p>
        </div>
        <Link href="/login" className={styles.footerAction}>
          打开登录页
        </Link>
      </footer>
    </main>
  );
}
