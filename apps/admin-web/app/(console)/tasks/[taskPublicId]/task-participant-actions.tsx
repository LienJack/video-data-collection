"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button } from "@egocapture/ui/components/button";
import { Input } from "@egocapture/ui/components/input";
import { Label } from "@egocapture/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { ArrowsLeftRight, CalendarBlank, Prohibit, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useI18n } from "@egocapture/ui/lib/i18n";

type Candidate = {
  publicId: string;
  displayAlias: string;
  status: string;
  consentStatus: string;
  currentAssignmentPublicId: string | null;
  defaultDevicePublicId: string | null;
  devices: Array<{ publicId: string; label: string }>;
};

function localDateTime(date: string) {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}

export function TaskParticipantActions({
  assignment,
  versions,
  candidates,
}: {
  assignment: {
    assignmentPublicId: string;
    participantPublicId: string;
    participantAlias: string;
    status: string;
    taskVersion: number;
    dueAt: string;
    sessionCount: number;
    videoCount: number;
  };
  versions: Array<{ version: number }>;
  candidates: Candidate[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const i18n = useI18n();
  const [mode, setMode] = useState<"extend" | "cancel" | "replace">("replace");
  const [reason, setReason] = useState("");
  const [dueAt, setDueAt] = useState(() => localDateTime(assignment.dueAt));
  const [participantPublicId, setParticipantPublicId] = useState("");
  const [taskVersion, setTaskVersion] = useState(assignment.taskVersion);
  const [preferredDevicePublicId, setPreferredDevicePublicId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const eligibleCandidates = useMemo(() => candidates.filter((candidate) => candidate.status === "active" && candidate.consentStatus === "valid" && !candidate.currentAssignmentPublicId && candidate.publicId !== assignment.participantPublicId), [assignment.participantPublicId, candidates]);
  const selectedCandidate = eligibleCandidates.find((candidate) => candidate.publicId === participantPublicId);

  if (["accepted", "canceled"].includes(assignment.status)) return null;

  function open(nextMode: typeof mode) {
    setMode(nextMode);
    setError("");
    setReason("");
    setDueAt(localDateTime(assignment.dueAt));
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function submit() {
    if (reason.trim().length < 10) {
      setError(i18n.t("adminUi.reasonMinError"));
      return;
    }
    if ((mode === "extend" || mode === "replace") && !dueAt) {
      setError(i18n.t("adminUi.chooseDueError"));
      return;
    }
    if (mode === "replace" && !participantPublicId) {
      setError(i18n.t("adminUi.chooseReplacementError"));
      return;
    }
    setBusy(true);
    setError("");
    const endpoint = mode === "replace"
      ? `/api/admin/assignments/${assignment.assignmentPublicId}/replace`
      : `/api/admin/assignments/${assignment.assignmentPublicId}/${mode}`;
    const body = mode === "replace"
      ? { participantPublicId, taskVersion, dueAt: new Date(dueAt).toISOString(), preferredDevicePublicId: preferredDevicePublicId || null, reason }
      : mode === "extend"
        ? { dueAt: new Date(dueAt).toISOString(), reason }
        : { reason };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...(mode === "replace" ? { "idempotency-key": crypto.randomUUID() } : {}) },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) {
      setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.operationFailed"));
    } else {
      close();
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => open("extend")}><CalendarBlank className="size-4" />{i18n.t("adminUi.extend")}</Button>
        <Button size="sm" variant="outline" onClick={() => open("replace")}><ArrowsLeftRight className="size-4" />{i18n.t("adminUi.replace")}</Button>
        <Button size="sm" variant="ghost" className="text-[var(--destructive)] hover:bg-red-50 hover:text-[var(--destructive)]" onClick={() => open("cancel")}><Prohibit className="size-4" />{i18n.t("adminUi.stop")}</Button>
      </div>

      <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); close(); }} className="apple-dialog w-[min(34rem,calc(100%-1.5rem))] p-0 text-[var(--ink)] backdrop:bg-[rgb(15_23_42_/_28%)]">
        <div className="apple-dialog-header flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
          <div><p className="page-kicker">{assignment.assignmentPublicId}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{mode === "replace" ? i18n.t("adminUi.replaceParticipant") : mode === "cancel" ? i18n.t("adminUi.stopParticipation") : i18n.t("adminUi.adjustDue")}</h2></div>
          <Button type="button" variant="ghost" size="icon" onClick={close} aria-label={i18n.t("adminUi.closePeopleManager")}><X className="size-5" /></Button>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <section className="rounded-2xl bg-[var(--paper)] p-4"><p className="font-semibold">{assignment.participantAlias}</p><p className="mt-1 text-xs text-[var(--muted)]">{assignment.participantPublicId} · {i18n.t("adminUi.participantStats", { version: assignment.taskVersion, sessions: assignment.sessionCount, videos: assignment.videoCount })}</p></section>

          {mode === "replace" ? <>
            <Alert><AlertDescription>{i18n.t("adminUi.replaceHistoryHelp")}</AlertDescription></Alert>
            <Label htmlFor={`replacement-${assignment.assignmentPublicId}`}>{i18n.t("adminUi.replacementParticipant")}<NativeSelect id={`replacement-${assignment.assignmentPublicId}`} value={participantPublicId} onChange={(event) => { setParticipantPublicId(event.target.value); const candidate = eligibleCandidates.find((item) => item.publicId === event.target.value); setPreferredDevicePublicId(candidate?.defaultDevicePublicId ?? ""); }} className="mt-2 w-full"><NativeSelectOption value="">{i18n.t("adminUi.chooseAvailableParticipant")}</NativeSelectOption>{eligibleCandidates.map((candidate) => <NativeSelectOption key={candidate.publicId} value={candidate.publicId}>{candidate.displayAlias} · {candidate.publicId}</NativeSelectOption>)}</NativeSelect></Label>
            <div className="grid gap-4 sm:grid-cols-2"><Label htmlFor={`replacement-version-${assignment.assignmentPublicId}`}>{i18n.t("adminUi.taskVersion")}<NativeSelect id={`replacement-version-${assignment.assignmentPublicId}`} value={String(taskVersion)} onChange={(event) => setTaskVersion(Number(event.target.value))} className="mt-2 w-full">{versions.map((version) => <NativeSelectOption key={version.version} value={String(version.version)}>{i18n.t("common.version", { value: version.version })}{version.version === assignment.taskVersion ? ` · ${i18n.t("adminUi.sameAsOriginal")}` : ""}</NativeSelectOption>)}</NativeSelect></Label><Label htmlFor={`replacement-due-${assignment.assignmentPublicId}`}>{i18n.t("adminUi.newDue")}<Input id={`replacement-due-${assignment.assignmentPublicId}`} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2" /></Label></div>
            {selectedCandidate ? <Label htmlFor={`replacement-device-${assignment.assignmentPublicId}`}>{i18n.t("adminUi.preferredDevice")}<NativeSelect id={`replacement-device-${assignment.assignmentPublicId}`} value={preferredDevicePublicId} onChange={(event) => setPreferredDevicePublicId(event.target.value)} className="mt-2 w-full"><NativeSelectOption value="">{i18n.t("adminUi.noDeviceSpecified")}</NativeSelectOption>{selectedCandidate.devices.map((device) => <NativeSelectOption key={device.publicId} value={device.publicId}>{device.label} · {device.publicId}</NativeSelectOption>)}</NativeSelect></Label> : null}
          </> : null}

          {mode === "extend" ? <Label htmlFor={`extend-due-${assignment.assignmentPublicId}`}>{i18n.t("adminUi.newDue")}<Input id={`extend-due-${assignment.assignmentPublicId}`} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2" /></Label> : null}
          {mode === "cancel" ? <Alert variant="destructive"><AlertDescription>{i18n.t("adminUi.cancelHistoryHelp")}</AlertDescription></Alert> : null}

          <Label htmlFor={`participant-reason-${assignment.assignmentPublicId}`}>{i18n.t("adminUi.operationReason")}<Input id={`participant-reason-${assignment.assignmentPublicId}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder={i18n.t("adminUi.reasonPlaceholder")} className="mt-2" /></Label>
          {error ? <Alert role="alert" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        </div>
        <div className="apple-dialog-footer flex justify-end gap-2 px-5 py-4 sm:px-6"><Button type="button" variant="ghost" onClick={close}>{i18n.t("common.cancel")}</Button><Button type="button" disabled={busy} variant={mode === "cancel" ? "destructive" : "default"} onClick={() => void submit()}>{busy ? i18n.t("adminUi.processing") : mode === "replace" ? i18n.t("adminUi.stopAndAssign", { name: assignment.participantAlias }) : mode === "cancel" ? i18n.t("adminUi.stopParticipation") : i18n.t("adminUi.saveNewDue")}</Button></div>
      </dialog>
    </>
  );
}
