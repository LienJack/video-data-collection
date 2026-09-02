import Link from "next/link";
import { TaskEditor } from "@/app/admin/tasks/task-editor";
import { requireAdmin } from "@egocapture/core/server/auth";
import { getTask } from "@egocapture/core/server/services/tasks";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ taskPublicId: string }> }) {
  const viewer = await requireAdmin();
  const { taskPublicId } = await params;
  const task = await getTask(viewer, taskPublicId);
  return (
    <main className="app-page">
      <Link href="/admin/tasks" className="secondary-action">← Tasks</Link>
      <header className="mt-8 border-b border-[var(--line)] pb-7">
        <p className="page-kicker">{task.publicId} · {task.lifecycle}{task.isFixture ? " · Demo Fixture" : ""}</p>
        <h1 className="page-title">{task.title}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{task.studyName} · 已发布 {task.versions.length} 个不可变版本</p>
      </header>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <TaskEditor mode="edit" studies={[]} taskPublicId={task.publicId} initialInstructions={JSON.stringify(task.draftInstructions, null, 2)} initialUpdatedAt={task.updatedAt.toISOString()} />
        <aside className="surface mt-8 h-fit p-6"><h2 className="display text-2xl font-semibold">Published</h2><div className="mt-5 space-y-4">{task.versions.map((version) => <article key={version.version} className="border-t border-[var(--line)] pt-4"><div className="flex items-center justify-between"><p className="font-bold">Version {version.version}</p><span className="status-pill">Frozen</span></div><p className="mt-2 break-all font-mono text-[10px] text-[var(--muted)]">{version.contentHash}</p><p className="mt-2 text-xs text-[var(--muted)]">{version.publishedAt.toLocaleString("zh-CN")}</p></article>)}{task.versions.length === 0 ? <p className="text-sm text-[var(--muted)]">尚未发布。</p> : null}</div></aside>
      </div>
    </main>
  );
}
