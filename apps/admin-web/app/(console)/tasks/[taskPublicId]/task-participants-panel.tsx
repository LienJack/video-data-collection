import { Badge } from "@egocapture/ui/components/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@egocapture/ui/components/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { Clock, VideoCamera, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { PlannedTaskParticipantActions } from "@/app/(console)/tasks/[taskPublicId]/planned-task-participant-actions";
import { TaskParticipantActions } from "@/app/(console)/tasks/[taskPublicId]/task-participant-actions";

type Participant = {
  assignmentPublicId: string | null;
  participantPublicId: string;
  participantAlias: string;
  participantStatus: string;
  status: string;
  taskVersion: number | null;
  locale: string;
  dueAt: string;
  createdAt: string;
  canceledAt: string | null;
  sessionCount: number;
  videoCount: number;
  isMissing: boolean;
  reviewCount: number;
  preferredDevicePublicId: string | null;
  replacesAssignmentPublicId: string | null;
  replacedByAssignmentPublicId: string | null;
};

type Candidate = {
  publicId: string;
  displayAlias: string;
  status: string;
  consentStatus: string;
  currentAssignmentPublicId: string | null;
  currentTaskState: "planned" | "assigned" | null;
  defaultDevicePublicId: string | null;
  devices: Array<{ publicId: string; label: string }>;
};

const statusLabels: Record<string, string> = {
  assigned: "待确认",
  planned: "待发布",
  acknowledged: "已确认",
  session_created: "已创建会话",
  uploading: "上传中",
  submitted: "已提交",
  needs_review: "待处理",
  rework_required: "需要重录",
  accepted: "已完成",
  expired: "已逾期",
  missing_upload: "缺少上传",
  canceled: "已停止",
};

function StatusBadge({ participant }: { participant: Participant }) {
  const attention = participant.isMissing || participant.reviewCount > 0 || ["needs_review", "rework_required", "expired", "missing_upload"].includes(participant.status);
  return <Badge variant={attention ? "destructive" : participant.status === "accepted" ? "secondary" : participant.status === "canceled" ? "outline" : "default"}>{attention ? <WarningCircle weight="fill" /> : null}{statusLabels[participant.status] ?? participant.status}</Badge>;
}

function ParticipantRows({ taskPublicId, participants, versions, candidates }: { taskPublicId: string; participants: Participant[]; versions: Array<{ version: number }>; candidates: Candidate[] }) {
  return participants.map((participant) => (
    <TableRow key={participant.assignmentPublicId ?? `planned-${participant.participantPublicId}`}>
      <TableCell className="min-w-48 whitespace-normal py-4"><p className="font-semibold">{participant.participantAlias}</p><p className="mt-1 text-xs text-[var(--muted)]">{participant.participantPublicId}{participant.assignmentPublicId ? ` · ${participant.assignmentPublicId}` : " · 草稿名单"}</p></TableCell>
      <TableCell><Badge variant="outline">{participant.taskVersion ? `版本 ${participant.taskVersion}` : "首版发布时绑定"}</Badge></TableCell>
      <TableCell><StatusBadge participant={participant} /></TableCell>
      <TableCell className="text-xs text-[var(--muted)]">{new Date(participant.dueAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</TableCell>
      <TableCell><span className="inline-flex items-center gap-1 text-sm tabular-nums"><Clock className="size-4 text-[var(--muted)]" />{participant.sessionCount}</span></TableCell>
      <TableCell><span className="inline-flex items-center gap-1 text-sm tabular-nums"><VideoCamera className="size-4 text-[var(--muted)]" />{participant.videoCount}</span></TableCell>
      <TableCell>{participant.assignmentPublicId && participant.taskVersion ? <TaskParticipantActions assignment={{ ...participant, assignmentPublicId: participant.assignmentPublicId, taskVersion: participant.taskVersion }} versions={versions} candidates={candidates} /> : <PlannedTaskParticipantActions taskPublicId={taskPublicId} participantPublicId={participant.participantPublicId} participantAlias={participant.participantAlias} />}</TableCell>
    </TableRow>
  ));
}

export function TaskParticipantsPanel({ taskPublicId, participants, versions, candidates }: { taskPublicId: string; participants: Participant[]; versions: Array<{ version: number }>; candidates: Candidate[] }) {
  const current = participants.filter((participant) => participant.status !== "canceled");
  const history = participants.filter((participant) => participant.status === "canceled");
  if (participants.length === 0) return <Empty className="rounded-[1.35rem] border border-dashed bg-white/70 py-16"><EmptyHeader><EmptyTitle>这个任务还没有参与者</EmptyTitle><EmptyDescription>使用页面右上角的“添加参与者”，选择一人或多人后开始采集。</EmptyDescription></EmptyHeader></Empty>;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/82 shadow-[var(--shadow-soft)] backdrop-blur-xl" aria-labelledby="current-participants-heading">
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"><div><h2 id="current-participants-heading" className="text-lg font-semibold tracking-[-0.02em]">当前参与者</h2><p className="mt-1 text-xs text-[var(--muted)]">{current.length} 人计入当前任务进度</p></div></div>
        <Table>
          <TableHeader><TableRow><TableHead className="pl-5 sm:pl-6">参与者</TableHead><TableHead>版本</TableHead><TableHead>状态</TableHead><TableHead>截止时间</TableHead><TableHead>会话</TableHead><TableHead>视频</TableHead><TableHead className="pr-5 text-right sm:pr-6">操作</TableHead></TableRow></TableHeader>
          <TableBody><ParticipantRows taskPublicId={taskPublicId} participants={current} versions={versions} candidates={candidates} /></TableBody>
        </Table>
      </section>
      {history.length > 0 ? <details className="rounded-[1.35rem] border border-[var(--line)] bg-white/55 p-3"><summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-sm font-semibold">历史参与者 <span className="ml-2 rounded-full bg-[var(--paper-deep)] px-2 py-0.5 text-xs tabular-nums">{history.length}</span><span aria-hidden="true" className="ml-auto">›</span></summary><div className="mt-2 overflow-hidden rounded-xl bg-white/72"><Table><TableBody><ParticipantRows taskPublicId={taskPublicId} participants={history} versions={versions} candidates={candidates} /></TableBody></Table></div></details> : null}
    </div>
  );
}
