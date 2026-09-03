import { Badge } from "@egocapture/ui/components/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@egocapture/ui/components/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@egocapture/ui/components/table";
import { Clock, VideoCamera, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { PlannedTaskParticipantActions } from "@/app/(console)/tasks/[taskPublicId]/planned-task-participant-actions";
import { TaskParticipantActions } from "@/app/(console)/tasks/[taskPublicId]/task-participant-actions";
import { createTranslator, type Translator, type UiLocale } from "@egocapture/core/i18n";

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

function StatusBadge({ participant, i18n }: { participant: Participant; i18n: Translator }) {
  const attention = participant.isMissing || participant.reviewCount > 0 || ["needs_review", "rework_required", "expired", "missing_upload"].includes(participant.status);
  return <Badge variant={attention ? "destructive" : participant.status === "accepted" ? "secondary" : participant.status === "canceled" ? "outline" : "default"}>{attention ? <WarningCircle weight="fill" /> : null}{participant.status === "planned" ? i18n.t("adminUi.draftRosterState") : i18n.state("assignment.status", participant.status)}</Badge>;
}

function ParticipantRows({ taskPublicId, participants, versions, candidates, i18n }: { taskPublicId: string; participants: Participant[]; versions: Array<{ version: number }>; candidates: Candidate[]; i18n: Translator }) {
  return participants.map((participant) => (
    <TableRow key={participant.assignmentPublicId ?? `planned-${participant.participantPublicId}`}>
      <TableCell className="min-w-48 whitespace-normal py-4"><p className="font-semibold">{participant.participantAlias}</p><p className="mt-1 text-xs text-[var(--muted)]">{participant.participantPublicId}{participant.assignmentPublicId ? ` · ${participant.assignmentPublicId}` : ` · ${i18n.t("adminUi.draftRoster")}`}</p></TableCell>
      <TableCell><Badge variant="outline">{participant.taskVersion ? i18n.t("common.version", { value: participant.taskVersion }) : i18n.t("adminUi.bindOnFirstPublish")}</Badge></TableCell>
      <TableCell><StatusBadge participant={participant} i18n={i18n} /></TableCell>
      <TableCell className="text-xs text-[var(--muted)]">{i18n.date(participant.dueAt, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</TableCell>
      <TableCell><span className="inline-flex items-center gap-1 text-sm tabular-nums"><Clock className="size-4 text-[var(--muted)]" />{participant.sessionCount}</span></TableCell>
      <TableCell><span className="inline-flex items-center gap-1 text-sm tabular-nums"><VideoCamera className="size-4 text-[var(--muted)]" />{participant.videoCount}</span></TableCell>
      <TableCell>{participant.assignmentPublicId && participant.taskVersion ? <TaskParticipantActions assignment={{ ...participant, assignmentPublicId: participant.assignmentPublicId, taskVersion: participant.taskVersion }} versions={versions} candidates={candidates} /> : <PlannedTaskParticipantActions taskPublicId={taskPublicId} participantPublicId={participant.participantPublicId} participantAlias={participant.participantAlias} />}</TableCell>
    </TableRow>
  ));
}

export function TaskParticipantsPanel({ locale, taskPublicId, participants, versions, candidates }: { locale: UiLocale; taskPublicId: string; participants: Participant[]; versions: Array<{ version: number }>; candidates: Candidate[] }) {
  const i18n = createTranslator(locale);
  const current = participants.filter((participant) => participant.status !== "canceled");
  const history = participants.filter((participant) => participant.status === "canceled");
  if (participants.length === 0) return <Empty className="rounded-[1.35rem] border border-dashed bg-white/70 py-16"><EmptyHeader><EmptyTitle>{i18n.t("adminUi.noTaskParticipants")}</EmptyTitle><EmptyDescription>{i18n.t("adminUi.addParticipantsHelp")}</EmptyDescription></EmptyHeader></Empty>;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/82 shadow-[var(--shadow-soft)] backdrop-blur-xl" aria-labelledby="current-participants-heading">
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"><div><h2 id="current-participants-heading" className="text-lg font-semibold tracking-[-0.02em]">{i18n.t("adminUi.currentParticipants")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{i18n.t("adminUi.currentProgressCount", { count: current.length })}</p></div></div>
        <Table>
          <TableHeader><TableRow><TableHead className="pl-5 sm:pl-6">{i18n.t("adminUi.participants")}</TableHead><TableHead>{i18n.t("common.version", { value: "" }).trim()}</TableHead><TableHead>{i18n.t("common.status")}</TableHead><TableHead>{i18n.t("common.dueAt")}</TableHead><TableHead>{i18n.t("adminUi.sessions")}</TableHead><TableHead>{i18n.t("adminUi.videos")}</TableHead><TableHead className="pr-5 text-right sm:pr-6">{i18n.t("common.actions")}</TableHead></TableRow></TableHeader>
          <TableBody><ParticipantRows taskPublicId={taskPublicId} participants={current} versions={versions} candidates={candidates} i18n={i18n} /></TableBody>
        </Table>
      </section>
      {history.length > 0 ? <details className="rounded-[1.35rem] border border-[var(--line)] bg-white/55 p-3"><summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-sm font-semibold">{i18n.t("adminUi.historicalParticipants")} <span className="ml-2 rounded-full bg-[var(--paper-deep)] px-2 py-0.5 text-xs tabular-nums">{history.length}</span><span aria-hidden="true" className="ml-auto">›</span></summary><div className="mt-2 overflow-hidden rounded-xl bg-white/72"><Table><TableBody><ParticipantRows taskPublicId={taskPublicId} participants={history} versions={versions} candidates={candidates} i18n={i18n} /></TableBody></Table></div></details> : null}
    </div>
  );
}
