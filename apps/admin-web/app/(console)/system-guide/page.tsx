import { requestLocale } from "@egocapture/core/server/i18n";
import { Badge } from "@egocapture/ui/components/badge";
import { BookOpenText, Broadcast, CloudArrowUp, FlowArrow, TreeStructure } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { guideContent } from "./guide-content";
import { LiveCaptureArticle } from "./live-capture-article";
import { ResumableUploadArticle } from "./resumable-upload-article";
import { SystemArchitectureArticle } from "./system-architecture-article";
import { SystemWorkflowArticle } from "./system-workflow-article";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const content = guideContent[locale];
  return { title: content.metadataTitle, description: content.metadataDescription };
}

export default async function SystemGuidePage() {
  const locale = await requestLocale();
  const content = guideContent[locale];
  const contents = [
    { href: "#system-architecture", number: "01", label: content.articles.architecture.title, status: content.statusLabels.current, icon: TreeStructure },
    { href: "#system-workflow", number: "02", label: content.articles.workflow.title, status: content.statusLabels.current, icon: FlowArrow },
    { href: "#resumable-upload", number: "03", label: content.articles.upload.title, status: `${content.statusLabels.current} + ${content.statusLabels.future}`, icon: CloudArrowUp },
    { href: "#live-capture", number: "04", label: content.articles.live.title, status: content.statusLabels.future, icon: Broadcast },
  ] as const;

  return (
    <main className="app-page">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-white/75 bg-white/76 px-5 py-8 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[var(--teal-soft)] blur-3xl" aria-hidden="true" />
        <div className="relative max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="page-kicker">{content.kicker}</p>
            <Badge variant="outline" className="border-[var(--line)] bg-white/75 px-2.5 py-1 text-[var(--muted)]">{content.releaseLabel}</Badge>
          </div>
          <div className="mt-5 flex items-start gap-4 sm:gap-5">
            <span className="mt-1 hidden size-12 shrink-0 place-items-center rounded-2xl bg-[var(--ink)] text-white sm:grid" aria-hidden="true">
              <BookOpenText className="size-6" weight="duotone" />
            </span>
            <div>
              <h1 className="page-title">{content.title}</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">{content.intro}</p>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap gap-2 sm:ms-[4.25rem]">
            <Badge className="bg-[var(--teal-soft)] px-3 py-1 text-[var(--signal-dark)]">{content.evidenceLabel}</Badge>
            <Badge variant="outline" className="border-violet-200 bg-violet-50 px-3 py-1 text-violet-700">{content.futureLabel}</Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">{content.noPromiseLabel}</Badge>
          </div>
        </div>
      </header>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[17rem_minmax(0,1fr)] xl:items-start">
        <nav aria-label={content.contentsLabel} className="apple-toolbar min-w-0 p-2.5 xl:sticky xl:top-6">
          <p className="hidden px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] xl:block">{content.contentsLabel}</p>
          <ol className="flex min-w-0 gap-2 overflow-x-auto pb-1 xl:grid xl:overflow-visible xl:pb-0">
            {contents.map(({ href, number, label, status, icon: Icon }) => (
              <li key={href} className="shrink-0 xl:shrink">
                <a href={href} className="group flex min-h-14 w-64 items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 xl:w-full">
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
          <SystemArchitectureArticle locale={locale} content={content} />
          <SystemWorkflowArticle locale={locale} content={content} />
          <ResumableUploadArticle locale={locale} content={content} />
          <LiveCaptureArticle locale={locale} content={content} />
        </div>
      </div>
    </main>
  );
}
