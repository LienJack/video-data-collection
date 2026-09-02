import { Badge } from "@egocapture/ui/components/badge";
import { BookOpenText, Broadcast, CloudArrowUp, FlowArrow, TreeStructure } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { LiveCaptureArticle } from "./live-capture-article";
import { ResumableUploadArticle } from "./resumable-upload-article";
import { SystemArchitectureArticle } from "./system-architecture-article";
import { SystemWorkflowArticle } from "./system-workflow-article";

export const metadata: Metadata = {
  title: "系统说明 · EgoCapture",
  description: "EgoCapture 系统架构、双端流程、大型文件断点上传与未来直播录制方案。",
};

const contents = [
  { href: "#system-architecture", number: "01", label: "整个系统的架构", status: "当前系统", icon: TreeStructure },
  { href: "#system-workflow", number: "02", label: "管理员与参与者流程", status: "当前系统", icon: FlowArrow },
  { href: "#resumable-upload", number: "03", label: "大型文件断点上传", status: "当前 + 演进", icon: CloudArrowUp },
  { href: "#live-capture", number: "04", label: "直播推流与视频保存", status: "未来方案", icon: Broadcast },
] as const;

export default function SystemGuidePage() {
  return (
    <main className="app-page">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-white/75 bg-white/76 px-5 py-8 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[var(--teal-soft)] blur-3xl" aria-hidden="true" />
        <div className="relative max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="page-kicker">EgoCapture · System Guide</p>
            <Badge variant="outline" className="border-[var(--line)] bg-white/75 px-2.5 py-1 text-[var(--muted)]">随代码版本发布</Badge>
          </div>
          <div className="mt-5 flex items-start gap-4 sm:gap-5">
            <span className="mt-1 hidden size-12 shrink-0 place-items-center rounded-2xl bg-[var(--ink)] text-white sm:grid" aria-hidden="true">
              <BookOpenText className="size-6" weight="duotone" />
            </span>
            <div>
              <h1 className="page-title">系统说明</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
                面向管理员与演示者的技术说明中心。先看懂当前双端系统如何运行，再了解大型文件上传和直播采集可以如何演进。
              </p>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap gap-2 sm:ms-[4.25rem]">
            <Badge className="bg-[var(--teal-soft)] px-3 py-1 text-[var(--signal-dark)]">当前实现与证据</Badge>
            <Badge variant="outline" className="border-violet-200 bg-violet-50 px-3 py-1 text-violet-700">未来参考方案</Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">不等同于生产承诺</Badge>
          </div>
        </div>
      </header>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[17rem_minmax(0,1fr)] xl:items-start">
        <nav aria-label="系统说明文章目录" className="apple-toolbar min-w-0 p-2.5 xl:sticky xl:top-6">
          <p className="hidden px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] xl:block">文章目录</p>
          <ol className="flex min-w-0 gap-2 overflow-x-auto pb-1 xl:grid xl:overflow-visible xl:pb-0">
            {contents.map(({ href, number, label, status, icon: Icon }) => (
              <li key={href} className="shrink-0 xl:shrink">
                <a
                  href={href}
                  className="group flex min-h-14 w-64 items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 xl:w-full"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--signal-dark)] shadow-sm transition group-hover:bg-[var(--teal-soft)]" aria-hidden="true"><Icon className="size-[1.15rem]" weight="duotone" /></span>
                  <span className="min-w-0">
                    <span className="block text-[0.69rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{number} · {status}</span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--ink)]">{label}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-6 lg:space-y-8">
          <SystemArchitectureArticle />
          <SystemWorkflowArticle />
          <ResumableUploadArticle />
          <LiveCaptureArticle />
        </div>
      </div>
    </main>
  );
}
