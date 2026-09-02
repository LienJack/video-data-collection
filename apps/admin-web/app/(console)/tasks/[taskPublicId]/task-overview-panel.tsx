import { Badge } from "@egocapture/ui/components/badge";
import { Card } from "@egocapture/ui/components/card";
import { Progress } from "@egocapture/ui/components/progress";
import {
  CheckCircle,
  ClockCounterClockwise,
  UsersThree,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { getTaskOperations } from "@egocapture/core/server/services/tasks";

type TaskOperations = Awaited<ReturnType<typeof getTaskOperations>>;

type Participant = Omit<TaskOperations["participants"][number], "dueAt" | "createdAt" | "canceledAt"> & {
  dueAt: string | Date;
  createdAt: string | Date;
  canceledAt: string | Date | null;
};
type Upload = Omit<TaskOperations["uploads"][number], "createdAt"> & { createdAt: string | Date };
type Audit = Omit<TaskOperations["audits"][number], "createdAt"> & { createdAt: string | Date };

type TaskOverviewPanelProps = {
  summary: TaskOperations["summary"];
  participants: Participant[];
  uploads: Upload[];
  audits: Audit[];
};

const statusLabels: Record<string, string> = {
  awaiting_participants: "待分配参与者",
  running: "采集中",
  needs_attention: "需要处理",
  completed: "已完成",
  archived: "已归档",
};

const assignmentLabels: Record<string, string> = {
  assigned: "待确认",
  acknowledged: "已确认",
  session_created: "已创建录制",
  uploading: "上传中",
  submitted: "已提交",
  needs_review: "待复核",
  rework_required: "需重新采集",
  accepted: "已完成",
  expired: "已逾期",
  missing_upload: "缺少视频",
  canceled: "已停止",
};

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" });
}

export function TaskOverviewPanel({ summary, participants, uploads, audits }: TaskOverviewPanelProps) {
  const completion = summary.participantCount > 0
    ? Math.round((summary.completedCount / summary.participantCount) * 100)
    : 0;
  const activeParticipants = participants.filter((participant) => participant.status !== "canceled");
  const upcoming = activeParticipants
    .filter((participant) => participant.status !== "accepted")
    .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime())
    .slice(0, 3);
  const recentActivity = [
    ...uploads.slice(0, 3).map((upload) => ({
      id: `upload-${upload.publicId}`,
      at: upload.createdAt,
      title: `收到视频：${upload.originalFilename}`,
      detail: `${upload.participantAlias} · ${upload.transferStatus === "verified" ? "上传已验证" : "上传处理中"}`,
      href: `/uploads/${upload.publicId}`,
    })),
    ...audits.slice(0, 3).map((audit) => ({
      id: `audit-${audit.id}`,
      at: audit.createdAt,
      title: audit.action,
      detail: `${audit.actorDisplayName ?? "系统"}${audit.reason ? ` · ${audit.reason}` : ""}`,
      href: null,
    })),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime()).slice(0, 5);

  const metrics = [
    { label: "当前参与者", value: summary.participantCount, hint: "不含已停止人员", icon: UsersThree },
    { label: "已完成人数", value: summary.completedCount, hint: `完成率 ${completion}%`, icon: CheckCircle },
    { label: "有效视频", value: summary.videoCount, hint: "已匹配到本任务", icon: VideoCamera },
    { label: "需要处理", value: summary.attentionCount, hint: summary.attentionCount > 0 ? "建议尽快检查" : "当前没有异常", icon: WarningCircle },
  ];

  return (
    <div className="space-y-5">
      <section aria-labelledby="task-summary-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="task-summary-heading" className="display text-2xl font-semibold">任务概览</h2>
          <Badge variant={summary.operationalStatus === "needs_attention" ? "destructive" : "secondary"}>
            {summary.operationalStatus === "needs_attention" ? <WarningCircle weight="fill" /> : <CheckCircle weight="fill" />}
            {statusLabels[summary.operationalStatus] ?? summary.operationalStatus}
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[26rem]:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label} as="article" className="gap-4 rounded-[1.25rem] border-white/70 bg-white/80 p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--muted)]">{metric.label}</p>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--teal-soft)] text-[var(--signal-dark)]" aria-hidden="true"><Icon className="size-[1.125rem]" weight="bold" /></span>
                </div>
                <div>
                  <p className="display text-3xl font-semibold tabular-nums">{metric.value}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{metric.hint}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <Card as="section" aria-labelledby="task-progress-heading" className="gap-5 rounded-[1.35rem] border-white/70 bg-white/80 p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-[var(--muted)]">整体进度</p>
              <h3 id="task-progress-heading" className="display mt-1 text-2xl font-semibold">{summary.completedCount} / {summary.participantCount || "—"} 人完成</h3>
            </div>
            <p className="text-2xl font-semibold tabular-nums" aria-label={`完成率 ${completion}%`}>{completion}%</p>
          </div>
          <Progress value={completion} aria-label={`任务完成率 ${completion}%`} className="h-2" />
          <div className="grid gap-2 sm:grid-cols-2">
            {upcoming.map((participant) => (
              <div key={participant.assignmentPublicId} className="rounded-2xl bg-[var(--paper)] p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{participant.participantAlias}</p>
                    <p className="mt-1 break-all text-xs text-[var(--muted)]">{participant.participantPublicId}</p>
                  </div>
                  <Badge variant={participant.isMissing || participant.reviewCount > 0 ? "destructive" : "outline"}>{assignmentLabels[participant.status] ?? participant.status}</Badge>
                </div>
                <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]"><ClockCounterClockwise className="mt-0.5 size-4 shrink-0" aria-hidden="true" />截止 {formatDate(participant.dueAt)}</p>
              </div>
            ))}
            {upcoming.length === 0 ? <p className="text-sm leading-6 text-[var(--muted)]">当前没有待完成的参与者。新增参与者后，最近截止时间会显示在这里。</p> : null}
          </div>
        </Card>

        <Card as="section" aria-labelledby="recent-activity-heading" className="gap-4 rounded-[1.35rem] border-white/70 bg-white/80 p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 id="recent-activity-heading" className="display text-2xl font-semibold">最近动态</h3>
            <ClockCounterClockwise className="size-5 text-[var(--muted)]" aria-hidden="true" />
          </div>
          <ol className="divide-y divide-[var(--line)]">
            {recentActivity.map((activity) => (
              <li key={activity.id} className="py-3 first:pt-0 last:pb-0">
                {activity.href ? (
                  <Link href={activity.href} className="block rounded-lg outline-none transition-colors hover:text-[var(--signal-dark)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:opacity-70">
                    <ActivityContent activity={activity} />
                  </Link>
                ) : <ActivityContent activity={activity} />}
              </li>
            ))}
          </ol>
          {recentActivity.length === 0 ? <p className="text-sm leading-6 text-[var(--muted)]">任务还没有上传或操作记录。</p> : null}
        </Card>
      </div>
    </div>
  );
}

function ActivityContent({ activity }: { activity: { title: string; detail: string; at: string | Date } }) {
  return (
    <div className="min-w-0">
      <p className="break-words text-sm font-semibold leading-5">{activity.title}</p>
      <p className="mt-1 break-words text-xs leading-5 text-[var(--muted)]">{activity.detail}</p>
      <time className="mt-1 block text-[0.6875rem] text-[var(--muted)]">{formatDate(activity.at)}</time>
    </div>
  );
}
