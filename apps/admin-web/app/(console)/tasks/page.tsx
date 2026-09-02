import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Empty, EmptyDescription } from "@egocapture/ui/components/empty";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { ArrowRight, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { TablePagination } from "@/app/_components/table-pagination";
import { requireAdmin } from "@/lib/auth";
import { parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { listTasks, taskListSchema } from "@egocapture/core/server/services/tasks";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export const dynamic = "force-dynamic";

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  awaiting_participants: "outline",
  running: "default",
  needs_attention: "destructive",
  completed: "secondary",
  archived: "outline",
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [viewer, params, locale] = await Promise.all([requireAdmin(), searchParams, requestLocale()]);
  const i18n = createTranslator(locale);
  const query = taskListSchema.parse({
    search: typeof params.search === "string" && params.search ? params.search : undefined,
    lifecycle: typeof params.lifecycle === "string" && params.lifecycle ? params.lifecycle : undefined,
    page: parsePageParam(params.page),
    pageSize: parsePageSizeParam(params.pageSize),
  });
  const result = await listTasks(viewer, query);

  return (
    <main className="app-page">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-7">
        <div>
          <p className="page-kicker">{i18n.t("adminUi.taskCollaboration")}</p>
          <h1 className="page-title">{i18n.t("adminUi.tasksTitle")}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">{i18n.t("adminUi.tasksBody")}</p>
        </div>
        <Link href="/tasks/new" className={buttonVariants({ size: "lg", className: "shadow-[0_10px_30px_rgb(57_117_173_/_20%)]" })}><Plus className="size-4" weight="bold" />{i18n.t("adminUi.createTask")}</Link>
      </header>

      <form className="apple-toolbar my-5 flex flex-wrap gap-3 p-2.5" aria-label={i18n.t("adminUi.taskFilterAria")}>
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <Input aria-label={i18n.t("adminUi.taskSearchAria")} name="search" defaultValue={query.search} placeholder={i18n.t("adminUi.taskSearchPlaceholder")} className="min-w-64 flex-1 border-0 bg-white/70 px-4 py-3 shadow-inner" />
        <NativeSelect aria-label={i18n.t("adminUi.taskLifecycle")} name="lifecycle" defaultValue={query.lifecycle || ""} className="border-0 bg-white/70 px-4 shadow-inner">
          <NativeSelectOption value="">{i18n.t("adminUi.allTasks")}</NativeSelectOption>
          <NativeSelectOption value="draft">{i18n.state("task.lifecycle", "draft")}</NativeSelectOption>
          <NativeSelectOption value="active">{i18n.t("adminUi.published")}</NativeSelectOption>
          <NativeSelectOption value="archived">{i18n.state("task.lifecycle", "archived")}</NativeSelectOption>
        </NativeSelect>
        <Button variant="secondary">{i18n.t("adminUi.filter")}</Button>
      </form>

      <section className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/78 shadow-[var(--shadow-soft)] backdrop-blur-xl" aria-label={i18n.t("adminUi.taskListAria")}>
        <Table className="min-w-[72rem]">
          <TableHeader><TableRow><TableHead className="px-6">{i18n.t("adminUi.task")}</TableHead><TableHead>{i18n.t("common.status")}</TableHead><TableHead>{i18n.t("adminUi.participants")}</TableHead><TableHead>{i18n.t("adminUi.completed")}</TableHead><TableHead>{i18n.t("adminUi.videos")}</TableHead><TableHead>{i18n.t("adminUi.attention")}</TableHead><TableHead>{i18n.t("adminUi.nextDue")}</TableHead><TableHead className="pr-6 text-right">{i18n.t("common.actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
          {result.items.map((task) => (
            <TableRow key={task.publicId}>
              <TableCell className="max-w-sm whitespace-normal px-6 py-4">
                <Link href={`/tasks/${task.publicId}`} className="text-base font-semibold tracking-[-0.01em] underline decoration-[var(--signal)] underline-offset-4">{task.title}</Link>
                <p className="mt-1 text-xs font-medium text-[var(--muted)]">{task.publicId}{task.latestVersion ? ` · ${i18n.t("common.version", { value: task.latestVersion })}` : ` · ${i18n.t("adminUi.unpublished")}`}</p>
              </TableCell>
              <TableCell><Badge variant={statusVariants[task.operationalStatus] ?? "outline"}>{i18n.label("taskOperational", task.operationalStatus)}</Badge></TableCell>
              <TableCell className="tabular-nums">{task.participantCount}</TableCell>
              <TableCell className="tabular-nums">{task.completedCount}/{task.participantCount || "—"}</TableCell>
              <TableCell className="tabular-nums">{task.videoCount}</TableCell>
              <TableCell className={`tabular-nums ${task.attentionCount > 0 ? "font-semibold text-[var(--destructive)]" : "text-[var(--muted)]"}`}>{task.attentionCount}</TableCell>
              <TableCell className="text-xs text-[var(--muted)]">{task.nextDueAt ? i18n.date(task.nextDueAt, { dateStyle: "medium" }) : "—"}</TableCell>
              <TableCell className="pr-6 text-right"><Link href={`/tasks/${task.publicId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{i18n.t("common.view")}<ArrowRight aria-hidden="true" /></Link></TableCell>
            </TableRow>
          ))}
          </TableBody>
        </Table>
      </section>

      {result.items.length === 0 ? <Empty className="mt-8"><EmptyDescription>{i18n.t("adminUi.noMatchingTasks")}</EmptyDescription></Empty> : null}
      <div className="mt-6"><TablePagination pathname="/tasks" query={query} pagination={result} /></div>
    </main>
  );
}
