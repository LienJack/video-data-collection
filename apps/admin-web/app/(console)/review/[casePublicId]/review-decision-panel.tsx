"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Label } from "@egocapture/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Textarea } from "@egocapture/ui/components/textarea";
import { Input } from "@egocapture/ui/components/input";
import { Button } from "@egocapture/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@egocapture/ui/lib/i18n";

type Option = { publicId: string; label: string };

export function ReviewDecisionPanel({
  reviewPublicId,
  uploadPublicId,
  currentReviewStatus,
  currentSessionPublicId,
  currentDevicePublicId,
  participantStatus,
  assignmentStatus,
  assignmentDueAt,
  assetStatus,
  sessions,
  devices,
  terminal,
}: {
  reviewPublicId: string;
  uploadPublicId: string | null;
  currentReviewStatus: string;
  currentSessionPublicId: string | null;
  currentDevicePublicId: string | null;
  participantStatus: string | null;
  assignmentStatus: string | null;
  assignmentDueAt: string | null;
  assetStatus: string | null;
  sessions: Option[];
  devices: Option[];
  terminal: boolean;
}) {
  const router = useRouter();
  const i18n = useI18n();
  const [action, setAction] = useState("correct_match");
  const [reason, setReason] = useState("");
  const [sessionPublicId, setSessionPublicId] = useState(currentSessionPublicId || sessions[0]?.publicId || "");
  const [devicePublicId, setDevicePublicId] = useState(currentDevicePublicId || devices[0]?.publicId || "");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function decide() {
    if (reason.trim().length < 10 || reason.trim().length > 500) { setError(i18n.t("adminUi.reasonLengthError")); return; }
    setBusy("decision"); setError("");
    const response = await fetch(`/api/admin/review-cases/${reviewPublicId}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        action,
        reason,
        ...(action === "correct_match" ? { sessionPublicId, devicePublicId: devicePublicId || null } : {}),
        ...(action === "extend_assignment" && dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      }),
    });
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.reviewDecisionFailed"));
    else { setReason(""); router.refresh(); }
    setBusy("");
  }
  async function retryMetadata() {
    if (!uploadPublicId) return;
    if (reason.trim().length < 10 || reason.trim().length > 500) { setError(i18n.t("adminUi.retryReasonLengthError")); return; }
    setBusy("metadata"); setError("");
    const response = await fetch(`/api/uploads/${uploadPublicId}/extract-metadata`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.metadataRetryFailed"));
    else { setReason(""); router.refresh(); }
    setBusy("");
  }
  const preview = (() => {
    if (action === "correct_match") return { subject: `${i18n.t("adminUi.sessionRecords")} / ${i18n.t("common.device")}`, before: `${currentSessionPublicId || i18n.t("adminUi.unmatchedValue")} / ${currentDevicePublicId || "—"}`, after: `${sessionPublicId || i18n.t("adminUi.unmatchedValue")} / ${devicePublicId || "—"}` };
    if (action === "confirm_match") return { subject: i18n.t("participantUi.match"), before: `${currentSessionPublicId || i18n.t("adminUi.unmatchedValue")} / ${i18n.t("adminUi.participantClaim")}`, after: `${currentSessionPublicId || i18n.t("adminUi.unmatchedValue")} / ${i18n.label("matchDecision", "admin_confirmed")}` };
    if (action === "reject_upload") return { subject: `${i18n.t("adminUi.videos")} / ${i18n.t("participantUi.match")}`, before: `${assetStatus ? i18n.state("video_asset.status", assetStatus) : "—"} / ${i18n.t("adminUi.current")}`, after: `${i18n.state("video_asset.status", "rejected")} / ${i18n.label("matchDecision", "rejected")}` };
    if (action === "request_rerecord") return { subject: i18n.t("adminUi.assignment"), before: assignmentStatus ? i18n.state("assignment.status", assignmentStatus) : "—", after: i18n.state("assignment.status", "rework_required") };
    if (action === "extend_assignment") return { subject: i18n.t("common.dueAt"), before: assignmentDueAt ? i18n.date(assignmentDueAt) : "—", after: dueAt ? i18n.date(dueAt) : i18n.t("adminUi.chooseNewTime") };
    if (action === "suspend_participant") return { subject: i18n.t("common.participant"), before: participantStatus ? i18n.state("participant.status", participantStatus) : "—", after: i18n.state("participant.status", "suspended") };
    if (action === "dismiss_case") return { subject: i18n.t("adminUi.reviewCases"), before: i18n.state("review_case.status", currentReviewStatus), after: i18n.state("review_case.status", "dismissed") };
    return { subject: i18n.t("adminUi.reviewCases"), before: i18n.state("review_case.status", currentReviewStatus), after: i18n.state("review_case.status", "resolved") };
  })();
  return (
    <section className="border border-[var(--line)] bg-white/40 p-6">
      <h2 className="display text-2xl font-semibold">{i18n.t("adminUi.humanAction")}</h2>
      {terminal ? <p className="mt-4 text-sm text-[var(--muted)]">{i18n.t("adminUi.terminalReview")}</p> : (
        <div className="mt-5 space-y-4">
          <Label className="block text-xs font-bold uppercase text-[var(--muted)]">{i18n.t("adminUi.reviewAction")}<NativeSelect aria-label={i18n.t("adminUi.reviewAction")} value={action} onChange={(event) => setAction(event.target.value)} className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm font-normal normal-case"><NativeSelectOption value="confirm_match">{i18n.t("adminUi.confirmCurrentMatch")}</NativeSelectOption><NativeSelectOption value="correct_match">{i18n.t("adminUi.correctSessionDevice")}</NativeSelectOption><NativeSelectOption value="reject_upload">{i18n.t("adminUi.rejectUpload")}</NativeSelectOption><NativeSelectOption value="request_rerecord">{i18n.t("adminUi.requestRerecord")}</NativeSelectOption><NativeSelectOption value="extend_assignment">{i18n.t("adminUi.extendAssignment")}</NativeSelectOption><NativeSelectOption value="suspend_participant">{i18n.t("adminUi.suspendParticipant")}</NativeSelectOption><NativeSelectOption value="resolve_case">{i18n.t("adminUi.resolveWithoutMatch")}</NativeSelectOption><NativeSelectOption value="dismiss_case">{i18n.t("adminUi.dismissCase")}</NativeSelectOption></NativeSelect></Label>
          {action === "correct_match" ? <div className="grid gap-3 sm:grid-cols-2"><Label className="text-xs font-bold uppercase text-[var(--muted)]">{i18n.t("adminUi.sessionRecords")}<NativeSelect aria-label={i18n.t("adminUi.sessionRecords")} value={sessionPublicId} onChange={(event) => setSessionPublicId(event.target.value)} className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm font-normal normal-case">{sessions.map((option) => <NativeSelectOption key={option.publicId} value={option.publicId}>{option.label}</NativeSelectOption>)}</NativeSelect></Label><Label className="text-xs font-bold uppercase text-[var(--muted)]">{i18n.t("common.device")}<NativeSelect aria-label={i18n.t("common.device")} value={devicePublicId} onChange={(event) => setDevicePublicId(event.target.value)} className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm font-normal normal-case">{devices.map((option) => <NativeSelectOption key={option.publicId} value={option.publicId}>{option.label}</NativeSelectOption>)}</NativeSelect></Label></div> : null}
          {action === "extend_assignment" ? <Label className="block text-xs font-bold uppercase text-[var(--muted)]">{i18n.t("adminUi.newDueAt")}<Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm font-normal normal-case" /></Label> : null}
          <div aria-label={i18n.t("adminUi.changePreview")} className="border border-[var(--yellow)] bg-[var(--yellow)]/20 p-4 text-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{i18n.t("adminUi.confirmBeforeSubmit", { subject: preview.subject })}</p><p className="mt-2 break-all"><span className="font-bold">{i18n.t("adminUi.before")}</span> {preview.before}</p><p className="mt-1 break-all"><span className="font-bold">{i18n.t("adminUi.after")}</span> {preview.after}</p></div>
          <Label className="block text-xs font-bold uppercase text-[var(--muted)]">{i18n.t("common.reason")}<Textarea aria-label={i18n.t("common.reason")} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder={i18n.t("adminUi.reasonHelp")} className="mt-2 min-h-28 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm font-normal normal-case" /></Label>
          <div className="flex flex-wrap gap-3"><Button disabled={Boolean(busy)} onClick={() => void decide()} className="bg-[var(--signal)] px-5 py-3 font-bold text-white">{i18n.t("adminUi.submitImmutableDecision")}</Button>{uploadPublicId ? <Button variant="outline" disabled={Boolean(busy)} onClick={() => void retryMetadata()} className="border-[var(--teal)] px-5 py-3 font-bold text-[var(--teal)]">{i18n.t("adminUi.retryMetadata")}</Button> : null}</div>
          {error ? <Alert role="alert" className="text-sm text-[var(--signal-dark)]"><AlertDescription>{error}</AlertDescription></Alert> : null}
        </div>
      )}
    </section>
  );
}
