import { Card } from "@egocapture/ui/components/card";
import Link from "next/link";
import { FieldSessionPreview } from "@/app/_components/field-session-preview";
import { MagneticLink } from "@/app/_components/magnetic-link";
import styles from "@/app/home.module.css";

const proofPoints = [
  { value: "固定任务版本", label: "采集开始后不受草稿修改影响" },
  { value: "签名会话标记", label: "记录本次采集所属会话" },
  { value: "支持断点续传", label: "暂停或中断后可以继续上传" },
  { value: "直传私有存储", label: "视频不经过应用服务器" },
];

const workflow = [
  {
    code: "01",
    title: "确认本次采集任务",
    copy: "开始前查看已发布的任务说明。采集开始后，本次任务内容不会受后续草稿修改影响。",
  },
  {
    code: "02",
    title: "创建录制会话",
    copy: "录制前创建会话并生成不含个人信息的签名标记，用于记录本次录制对应的任务。",
  },
  {
    code: "03",
    title: "选择会话并上传视频",
    copy: "选择对应的录制会话后上传视频。上传可暂停、可恢复；疑似异常或重复的视频会进入人工复核，不会自动删除。",
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
          第一人称视频采集平台
        </p>
        <Link href="/login" className={styles.navAction}>
          登录工作台
        </Link>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-12 pb-16 pt-16 md:pt-24 lg:grid-cols-12 lg:items-center lg:gap-8 lg:pb-28 lg:pt-24">
        <div className="lg:col-span-7 lg:pr-10 xl:pr-20">
          <p className={styles.kicker}>
            <span aria-hidden="true" />
            第一人称视频采集平台
          </p>
          <h1 className={`${styles.heroTitle} mt-7 max-w-[12ch]`}>
            视频记录现场。
            <span>每段素材都有清晰来路。</span>
          </h1>
          <p className="mt-7 max-w-[39rem] text-[1rem] leading-8 text-[var(--home-muted)] sm:mt-8 sm:text-[1.08rem]">
            参与者根据已发布的任务完成录制和上传；研究团队可查看任务版本、录制会话、上传进度与复核结果，随时了解每段视频的来源和状态。
          </p>
          <div className={`${styles.heroActions} mt-9 flex flex-wrap items-center gap-5`}>
            <MagneticLink href="/login">登录工作台</MagneticLink>
            <Link href="#workflow" className={styles.textAction}>
              查看三步流程
            </Link>
          </div>
          <p className="mt-7 flex max-w-lg items-start gap-3 text-xs leading-6 text-[var(--home-muted)]">
            <span className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-[var(--home-accent)]" aria-hidden="true" />
            演示环境请勿使用真实身份或上传敏感视频。开展真实采集前，请确认已完成知情同意和数据治理流程。
          </p>
        </div>

        <div className="lg:col-span-5">
          <FieldSessionPreview />
        </div>
      </section>

      <section className={`${styles.proofBand} mx-auto max-w-[1400px] px-6 py-8 sm:px-9 sm:py-10 lg:px-12`} aria-labelledby="proof-title">
        <div className="grid gap-9 lg:grid-cols-[1fr_2fr] lg:items-end">
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/48">不止存储，更可追溯</p>
            <h2 id="proof-title" className="display mt-3 max-w-md text-2xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-3xl">
              每段视频的来源和处理状态都可核查。
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
            三步完成采集
          </p>
          <h2 className="display mt-6 max-w-[12ch] text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-5xl">
            参与者按步骤完成采集，研究团队随时查看进度。
          </h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-[var(--home-muted)]">
            参与者只需按页面提示操作；系统会自动保存任务版本、录制会话、上传状态和复核结果。
          </p>
        </div>

        <div className="lg:col-span-7 lg:pl-8">
          {workflow.map((step) => (
            <Card as="article" key={step.code} className={styles.workflowRow}>
              <p className={styles.stepCode}>{step.code}</p>
              <div>
                <h3 className="display text-2xl font-semibold tracking-[-0.04em] sm:text-[1.75rem]">{step.title}</h3>
                <p className="mt-3 max-w-[42rem] text-sm leading-7 text-[var(--home-muted)]">{step.copy}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <footer className={`${styles.footer} mx-auto flex max-w-[1400px] flex-col gap-7 px-2 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-4`}>
        <div>
          <p className="display text-xl font-semibold tracking-[-0.04em]">登录后开始采集或管理任务。</p>
          <p className="mt-2 text-xs leading-5 text-[var(--home-muted)]">参与者使用邀请中的 Participant ID，管理员使用工作邮箱登录。</p>
        </div>
        <Link href="/login" className={styles.footerAction}>
          登录工作台
        </Link>
      </footer>
    </main>
  );
}
