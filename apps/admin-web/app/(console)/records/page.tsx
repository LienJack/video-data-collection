import { Card } from "@egocapture/ui/components/card";
import { ArrowRight, ClockCountdown, CloudArrowUp, StackSimple, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ActivityRecordsPanel } from "@/app/(console)/records/activity-records-panel";
import { SessionRecordsPanel } from "@/app/(console)/records/session-records-panel";
import { VideoRecordsPanel } from "@/app/(console)/records/video-records-panel";
import { requireAdmin } from "@/lib/auth";
import { parseRecordsQuery, type RecordsQuery } from "@/lib/records-query";
import { getAdminRecordSummary } from "@egocapture/core/server/services/records";
import { adminUploadListSchema, auditListSchema, listAdminUploads, listAuditEvents } from "@egocapture/core/server/services/review";
import { adminSessionListSchema, listAdminSessions } from "@egocapture/core/server/services/sessions";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

async function loadTab(viewer: Awaited<ReturnType<typeof requireAdmin>>, query: RecordsQuery) {
  if (query.tab === "videos") {
    const input = adminUploadListSchema.parse({
      search: query.search,
      transferStatus: query.transferStatus,
      metadataStatus: query.metadataStatus,
      attention: query.attention,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { tab: "videos" as const, query, result: await listAdminUploads(viewer, input) };
  }
  if (query.tab === "sessions") {
    const input = adminSessionListSchema.parse({
      search: query.search,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { tab: "sessions" as const, query, result: await listAdminSessions(viewer, input) };
  }
  const input = auditListSchema.parse({
    search: query.search,
    category: query.category,
    page: query.page,
    pageSize: query.pageSize,
  });
  return { tab: "activity" as const, query, result: await listAuditEvents(viewer, input) };
}

export default async function RecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const locale = await requestLocale();
  const i18n = createTranslator(locale);
  const tabs = [
    { value: "videos", label: i18n.t("adminUi.videoRecords") },
    { value: "sessions", label: i18n.t("adminUi.sessionRecords") },
    { value: "activity", label: i18n.t("adminUi.activityLog") },
  ] as const;
  const query = parseRecordsQuery(await searchParams);
  const summary = await getAdminRecordSummary(viewer);
  const tab = await loadTab(viewer, query);

  const attentionItems = [
    { label: i18n.t("adminUi.missingUpload"), value: summary.attention.missingUploads, href: "/participants?missing=yes" },
    { label: i18n.t("adminUi.uploadFailed"), value: summary.attention.uploadFailed, href: "/review?caseType=upload_failed" },
    { label: i18n.t("adminUi.metadataFailed"), value: summary.attention.metadataFailed, href: "/review?caseType=metadata_failed" },
    { label: i18n.t("adminUi.duplicateCandidate"), value: summary.attention.duplicateCandidates, href: "/review?caseType=duplicate_candidate" },
    { label: i18n.t("adminUi.unmatched"), value: summary.attention.unmatched, href: "/review?caseType=unmatched" },
    { label: i18n.t("adminUi.deviceMismatch"), value: summary.attention.deviceMismatch, href: "/review?caseType=device_mismatch" },
    { label: i18n.t("adminUi.totalReviews"), value: summary.attention.needsReview, href: "/review" },
  ];

  return (
    <main className="app-page">
      <header className="border-b border-[var(--line)] pb-7">
        <p className="page-kicker">{i18n.t("adminUi.recordsKicker")}</p>
        <h1 className="page-title">{i18n.t("adminUi.records")}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">{i18n.t("adminUi.recordsIntro")}</p>
      </header>

      <section className="mt-7 grid gap-3 sm:grid-cols-3" aria-label={i18n.t("adminUi.recordsSummary")}>
        <Metric label={i18n.t("adminUi.totalUploads")} value={summary.totalUploads} icon={StackSimple} />
        <Metric label={i18n.t("adminUi.transfersInProgress")} value={summary.transfersInProgress} icon={CloudArrowUp} />
        <Metric label={i18n.t("adminUi.openSessions")} value={summary.openSessions} icon={ClockCountdown} href="/records?tab=sessions&status=open" />
      </section>

      <section className="mt-4 rounded-[1.35rem] border border-white/70 bg-white/72 p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:p-6" aria-labelledby="attention-overview-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="page-kicker">{i18n.t("adminUi.needsAttention")}</p>
            <h2 id="attention-overview-heading" className="display mt-1 text-2xl font-semibold">{i18n.t("adminUi.anomalyOverview")}</h2>
          </div>
          <WarningCircle className="size-7 text-[var(--signal)]" weight="duotone" aria-hidden="true" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {attentionItems.map((item) => (
            <Link key={item.label} href={item.href} className="group flex min-h-24 flex-col justify-between rounded-xl border border-[var(--line)] bg-white/64 p-3 outline-none transition-[background-color,transform] hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98]">
              <span className="text-xs font-semibold leading-5 text-[var(--muted)]">{item.label}</span>
              <span className="flex items-end justify-between gap-2"><strong className="text-2xl tabular-nums">{item.value}</strong><ArrowRight className="size-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      </section>

      <nav className="apple-toolbar mt-6 flex gap-1 overflow-x-auto p-1.5" aria-label={i18n.t("adminUi.recordsView")}>
        {tabs.map((item) => (
          <Link key={item.value} href={`/records?tab=${item.value}&pageSize=${query.pageSize}`} aria-current={query.tab === item.value ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center rounded-xl px-4 text-sm font-semibold outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${query.tab === item.value ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab.tab === "videos" ? <VideoRecordsPanel locale={locale} query={tab.query} result={tab.result} /> : null}
        {tab.tab === "sessions" ? <SessionRecordsPanel locale={locale} query={tab.query} result={tab.result} /> : null}
        {tab.tab === "activity" ? <ActivityRecordsPanel locale={locale} query={tab.query} result={tab.result} /> : null}
      </div>
    </main>
  );
}

function Metric({ label, value, icon: Icon, href }: { label: string; value: number; icon: typeof StackSimple; href?: string }) {
  const content = <><span className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--muted)]">{label}<Icon className="size-5 text-[var(--signal)]" weight="duotone" aria-hidden="true" /></span><strong className="mt-4 block text-3xl tabular-nums">{value}</strong></>;
  const className = "rounded-2xl bg-white/82 p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl";
  return href ? <Link href={href} className={`${className} outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98]`}>{content}</Link> : <Card as="div" className={`${className} gap-0 border-0 py-5`}>{content}</Card>;
}
