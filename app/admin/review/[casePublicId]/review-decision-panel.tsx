"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const [action, setAction] = useState("correct_match");
  const [reason, setReason] = useState("");
  const [sessionPublicId, setSessionPublicId] = useState(currentSessionPublicId || sessions[0]?.publicId || "");
  const [devicePublicId, setDevicePublicId] = useState(currentDevicePublicId || devices[0]?.publicId || "");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function decide() {
    if (reason.trim().length < 10 || reason.trim().length > 500) { setError("Reason 必须为 10～500 个字符"); return; }
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
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "Review 决策失败");
    else { setReason(""); router.refresh(); }
    setBusy("");
  }
  async function retryMetadata() {
    if (!uploadPublicId) return;
    if (reason.trim().length < 10 || reason.trim().length > 500) { setError("Retry Reason 必须为 10～500 个字符"); return; }
    setBusy("metadata"); setError("");
    const response = await fetch(`/api/uploads/${uploadPublicId}/extract-metadata`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) setError(payload.error?.message || "Metadata 重试失败");
    else { setReason(""); router.refresh(); }
    setBusy("");
  }
  const preview = (() => {
    if (action === "correct_match") return { subject: "Session / Device", before: `${currentSessionPublicId || "Unmatched"} / ${currentDevicePublicId || "—"}`, after: `${sessionPublicId || "Unmatched"} / ${devicePublicId || "—"}` };
    if (action === "confirm_match") return { subject: "Match authority", before: `${currentSessionPublicId || "Unmatched"} / participant claim`, after: `${currentSessionPublicId || "Unmatched"} / admin confirmed` };
    if (action === "reject_upload") return { subject: "Video Asset / Match", before: `${assetStatus || "—"} / current`, after: "rejected / rejected" };
    if (action === "request_rerecord") return { subject: "Assignment", before: assignmentStatus || "—", after: "rework_required" };
    if (action === "extend_assignment") return { subject: "Due At", before: assignmentDueAt ? new Date(assignmentDueAt).toLocaleString("zh-CN") : "—", after: dueAt ? new Date(dueAt).toLocaleString("zh-CN") : "请选择新时间" };
    if (action === "suspend_participant") return { subject: "Participant", before: participantStatus || "—", after: "suspended" };
    if (action === "dismiss_case") return { subject: "ReviewCase", before: currentReviewStatus, after: "dismissed" };
    return { subject: "ReviewCase", before: currentReviewStatus, after: "resolved" };
  })();
  return <section className="border border-[var(--line)] bg-white/40 p-6"><h2 className="display text-2xl font-semibold">人工操作</h2>{terminal ? <p className="mt-4 text-sm text-[var(--muted)]">此 ReviewCase 已终结；历史仍可查看。</p> : <div className="mt-5 space-y-4"><label className="block text-xs font-bold uppercase text-[var(--muted)]">Action<select aria-label="Action" value={action} onChange={(event) => setAction(event.target.value)} className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm font-normal normal-case"><option value="confirm_match">Confirm current match</option><option value="correct_match">Correct Session / Device</option><option value="reject_upload">Reject Upload</option><option value="request_rerecord">Request Re-record</option><option value="extend_assignment">Extend Assignment</option><option value="suspend_participant">Suspend Participant</option><option value="resolve_case">Resolve without match change</option><option value="dismiss_case">Dismiss case</option></select></label>{action === "correct_match" ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold uppercase text-[var(--muted)]">Session<select aria-label="Session" value={sessionPublicId} onChange={(event) => setSessionPublicId(event.target.value)} className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm font-normal normal-case">{sessions.map((option) => <option key={option.publicId} value={option.publicId}>{option.label}</option>)}</select></label><label className="text-xs font-bold uppercase text-[var(--muted)]">Device<select aria-label="Device" value={devicePublicId} onChange={(event) => setDevicePublicId(event.target.value)} className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm font-normal normal-case">{devices.map((option) => <option key={option.publicId} value={option.publicId}>{option.label}</option>)}</select></label></div> : null}{action === "extend_assignment" ? <label className="block text-xs font-bold uppercase text-[var(--muted)]">New Due At<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm font-normal normal-case" /></label> : null}<div aria-label="Change Preview" className="border border-[var(--yellow)] bg-[var(--yellow)]/20 p-4 text-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">提交前确认 · {preview.subject}</p><p className="mt-2 break-all"><span className="font-bold">Before</span> {preview.before}</p><p className="mt-1 break-all"><span className="font-bold">After</span> {preview.after}</p></div><label className="block text-xs font-bold uppercase text-[var(--muted)]">Reason<textarea aria-label="Reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="说明判断证据与修改原因（10～500 字符）" className="mt-2 min-h-28 w-full border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm font-normal normal-case" /></label><div className="flex flex-wrap gap-3"><button disabled={Boolean(busy)} onClick={() => void decide()} className="bg-[var(--signal)] px-5 py-3 font-bold text-white">提交不可变决策</button>{uploadPublicId ? <button disabled={Boolean(busy)} onClick={() => void retryMetadata()} className="border border-[var(--teal)] px-5 py-3 font-bold text-[var(--teal)]">Retry Metadata</button> : null}</div>{error ? <p role="alert" className="text-sm text-[var(--signal-dark)]">{error}</p> : null}</div>}</section>;
}
