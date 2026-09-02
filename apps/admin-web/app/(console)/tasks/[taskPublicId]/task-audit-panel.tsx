import { Badge } from "@egocapture/ui/components/badge";
import { Card } from "@egocapture/ui/components/card";
import {
  ArrowsClockwise,
  CheckCircle,
  ClockCounterClockwise,
  ShieldCheck,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { getTaskOperations } from "@egocapture/core/server/services/tasks";

type TaskOperations = Awaited<ReturnType<typeof getTaskOperations>>;

type Audit = Omit<TaskOperations["audits"][number], "createdAt"> & { createdAt: string | Date };

type TaskAuditPanelProps = { audits: Audit[] };

const actionLabels: Record<string, string> = {
  "task.created": "创建任务",
  "task.updated": "更新任务说明",
  "task.version_published": "发布任务版本",
  "task.participant_added": "添加参与者",
  "task.participants_added": "批量添加参与者",
  "task.participant_removed": "停止参与",
  "task.participant_replaced": "替换参与者",
  "assignment.created": "创建人员分配",
  "assignment.canceled": "取消人员分配",
  "assignment.replaced": "替换参与者",
  "assignment.extended": "延长截止时间",
  "match.confirmed": "确认视频匹配",
  "match.corrected": "纠正视频匹配",
  "review.resolved": "完成视频复核",
};

const fieldLabels: Record<string, string> = {
  participantPublicId: "参与者",
  replacementParticipantPublicId: "替代参与者",
  taskVersion: "任务版本",
  dueAt: "截止时间",
  status: "状态",
  preferredDevicePublicId: "首选设备",
  sessionPublicId: "录制 Session",
  devicePublicId: "设备",
};

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" });
}

function changedFields(beforeValues: Record<string, unknown> | null, afterValues: Record<string, unknown> | null) {
  const keys = new Set([...Object.keys(beforeValues ?? {}), ...Object.keys(afterValues ?? {})]);
  return [...keys]
    .filter((key) => JSON.stringify(beforeValues?.[key]) !== JSON.stringify(afterValues?.[key]))
    .map((key) => fieldLabels[key] ?? key);
}

export function TaskAuditPanel({ audits }: TaskAuditPanelProps) {
  return (
    <section aria-labelledby="task-audit-heading" className="space-y-4">
      <div>
        <h2 id="task-audit-heading" className="display text-2xl font-semibold">操作记录</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">记录任务、参与者和视频匹配的重要变更。历史记录只读，不会随人员调整而覆盖。</p>
      </div>

      <Card as="div" className="gap-0 overflow-hidden rounded-[1.35rem] border-white/70 bg-white/80 p-0 shadow-[var(--shadow-soft)]">
        <ol className="divide-y divide-[var(--line)]">
          {audits.map((audit) => {
            const fields = changedFields(audit.beforeValues, audit.afterValues);
            const actionLabel = actionLabels[audit.action] ?? audit.action;
            return (
              <li key={audit.id} className="relative grid gap-3 px-4 py-5 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:px-6">
                <span className="grid size-10 place-items-center rounded-full bg-[var(--teal-soft)] text-[var(--signal-dark)]" aria-hidden="true">
                  {audit.action.includes("replaced") || audit.action.includes("corrected") ? <ArrowsClockwise className="size-5" weight="bold" /> : <ShieldCheck className="size-5" weight="duotone" />}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-sm font-semibold leading-5">{actionLabel}</h3>
                    <Badge variant="outline"><CheckCircle weight="fill" />已记录</Badge>
                  </div>
                  <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]"><UserCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />操作者：{audit.actorDisplayName ?? "系统"}</p>
                  {audit.entityPublicId ? <p className="mt-1 break-all text-xs leading-5 text-[var(--muted)]">对象：{audit.entityPublicId}</p> : null}
                  {fields.length > 0 ? <p className="mt-1 break-words text-xs leading-5 text-[var(--muted)]">变更内容：{fields.slice(0, 4).join("、")}{fields.length > 4 ? ` 等 ${fields.length} 项` : ""}</p> : null}
                  {audit.reason ? (
                    <blockquote className="mt-3 rounded-xl bg-[var(--paper)] px-3.5 py-3 text-sm leading-6 text-[var(--ink)]">
                      <span className="font-semibold">原因：</span>{audit.reason}
                    </blockquote>
                  ) : null}
                </div>
                <time className="flex items-start gap-1.5 text-xs leading-5 text-[var(--muted)] sm:justify-self-end sm:text-right">
                  <ClockCounterClockwise className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{formatDate(audit.createdAt)}
                </time>
              </li>
            );
          })}
        </ol>
        {audits.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--teal-soft)] text-[var(--signal-dark)]" aria-hidden="true"><ShieldCheck className="size-6" /></span>
            <h3 className="mt-4 font-semibold">暂无操作记录</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">添加或调整参与者、发布版本以及处理视频后，记录会显示在这里。</p>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
