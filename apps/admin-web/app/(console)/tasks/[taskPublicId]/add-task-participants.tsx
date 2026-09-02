"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button } from "@egocapture/ui/components/button";
import { Checkbox } from "@egocapture/ui/components/checkbox";
import { Input } from "@egocapture/ui/components/input";
import { Label } from "@egocapture/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { CheckCircle, MagnifyingGlass, Plus, UserPlus, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";

type EligibleParticipant = {
  publicId: string;
  displayAlias: string;
  status: string;
  consentStatus: string;
  locale: string;
  countryRegion: string | null;
  defaultDevicePublicId: string | null;
  currentAssignmentPublicId: string | null;
  devices: Array<{ publicId: string; label: string }>;
};

type Result = {
  created: Array<{ participantPublicId: string; assignmentPublicId: string }>;
  skipped: Array<{ participantPublicId: string; code: string; message: string }>;
};

function initialDueAt() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function eligibility(participant: EligibleParticipant) {
  if (participant.currentAssignmentPublicId) return { allowed: false, reason: "已在当前任务中" };
  if (participant.status !== "active") return { allowed: false, reason: "参与者未启用" };
  if (participant.consentStatus !== "valid") return { allowed: false, reason: "授权状态无效" };
  return { allowed: true, reason: "可以分配" };
}

export function AddTaskParticipants({
  taskPublicId,
  versions,
  participants,
}: {
  taskPublicId: string;
  versions: Array<{ version: number }>;
  participants: EligibleParticipant[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const latestVersion = versions[0]?.version ?? 0;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [devices, setDevices] = useState<Record<string, string>>({});
  const [taskVersion, setTaskVersion] = useState(latestVersion);
  const [dueAt, setDueAt] = useState(initialDueAt);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return participants;
    return participants.filter((participant) => `${participant.displayAlias} ${participant.publicId} ${participant.countryRegion ?? ""}`.toLocaleLowerCase().includes(normalized));
  }, [participants, query]);
  const selectedParticipants = selected.map((publicId) => participants.find((participant) => participant.publicId === publicId)).filter((participant): participant is EligibleParticipant => Boolean(participant));

  function open() {
    setError("");
    setResult(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function toggle(publicId: string, checked: boolean) {
    setSelected((current) => checked ? [...current, publicId] : current.filter((item) => item !== publicId));
    if (checked) {
      const participant = participants.find((item) => item.publicId === publicId);
      if (participant?.defaultDevicePublicId) setDevices((current) => ({ ...current, [publicId]: participant.defaultDevicePublicId! }));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.length === 0) {
      setError("请至少选择一名参与者。");
      return;
    }
    if (!taskVersion) {
      setError("请先发布任务版本，再添加参与者。");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    const response = await fetch(`/api/admin/tasks/${taskPublicId}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        taskVersion,
        dueAt: new Date(dueAt).toISOString(),
        note: note.trim() || null,
        participants: selected.map((participantPublicId) => ({
          participantPublicId,
          preferredDevicePublicId: devices[participantPublicId] || null,
        })),
      }),
    });
    const payload = await response.json() as { data?: Result; error?: { message?: string } };
    if (!response.ok || !payload.data) {
      setError(payload.error?.message || "无法添加参与者，请检查网络后重试。");
    } else {
      setResult(payload.data);
      setSelected(payload.data.skipped.map((item) => item.participantPublicId));
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <>
      <Button size="lg" onClick={open} disabled={versions.length === 0} className="shadow-[0_10px_30px_rgb(57_117_173_/_22%)]"><UserPlus className="size-5" weight="bold" />添加参与者</Button>
      <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); close(); }} className="apple-dialog w-[min(70rem,calc(100%-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-hidden p-0 text-[var(--ink)] backdrop:bg-[rgb(15_23_42_/_28%)]">
        <form onSubmit={submit} className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
          <header className="apple-dialog-header flex items-start justify-between gap-4 px-5 py-4 sm:px-7 sm:py-5">
            <div>
              <p className="page-kicker">{taskPublicId}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">添加参与者</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">一次选择一人或多人；每个人都会获得独立的任务记录。</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="关闭添加参与者窗口"><X className="size-5" /></Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
            {result ? (
              <section role="status" className="mb-5 rounded-2xl bg-[var(--teal-soft)] p-5">
                <div className="flex items-center gap-3"><CheckCircle className="size-6 text-[var(--signal-dark)]" weight="fill" /><p className="font-semibold">成功添加 {result.created.length} 名参与者</p></div>
                {result.skipped.length > 0 ? <div className="mt-4 space-y-2 text-sm"><p className="font-semibold">{result.skipped.length} 人未添加</p>{result.skipped.map((item) => <p key={item.participantPublicId}>{item.participantPublicId}：{item.message}</p>)}</div> : null}
              </section>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)]">
              <section aria-labelledby="participant-picker-heading">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div><h3 id="participant-picker-heading" className="text-base font-semibold">选择人员</h3><p aria-live="polite" className="mt-1 text-xs text-[var(--muted)]">显示 {filtered.length} 人，已选择 {selected.length} 人</p></div>
                </div>
                <Label htmlFor="task-participant-search" className="sr-only">搜索参与者</Label>
                <div className="relative mb-3"><MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" /><Input id="task-participant-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、编号或地区" className="min-h-12 bg-white pl-10" /></div>
                <div className="max-h-[25rem] space-y-2 overflow-y-auto rounded-2xl bg-[var(--paper)] p-2">
                  {filtered.map((participant) => {
                    const state = eligibility(participant);
                    const checked = selected.includes(participant.publicId);
                    return (
                      <label key={participant.publicId} className={`flex min-h-16 items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-[0_1px_3px_rgb(15_23_42_/_5%)] transition-[background-color,transform] ${state.allowed ? "cursor-pointer active:scale-[0.99]" : "cursor-not-allowed opacity-55"}`}>
                        <Checkbox checked={checked} disabled={!state.allowed} onCheckedChange={(value) => toggle(participant.publicId, value === true)} aria-label={`选择 ${participant.displayAlias}`} className="size-5" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{participant.displayAlias}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{participant.publicId} · {participant.locale}{participant.countryRegion ? ` · ${participant.countryRegion}` : ""}</span></span>
                        <span className={`text-xs font-medium ${state.allowed ? "text-[var(--signal-dark)]" : "text-[var(--muted)]"}`}>{state.reason}</span>
                      </label>
                    );
                  })}
                  {filtered.length === 0 ? <p className="p-8 text-center text-sm text-[var(--muted)]">没有匹配的参与者。请修改搜索内容。</p> : null}
                </div>
              </section>

              <section aria-labelledby="assignment-settings-heading" className="space-y-5">
                <div><h3 id="assignment-settings-heading" className="text-base font-semibold">分配设置</h3><p className="mt-1 text-xs text-[var(--muted)]">公共设置会应用到本次选择的所有人。</p></div>
                <Label htmlFor="task-version">任务版本<NativeSelect id="task-version" value={String(taskVersion)} onChange={(event) => setTaskVersion(Number(event.target.value))} className="mt-2 w-full bg-white">{versions.map((version) => <NativeSelectOption key={version.version} value={String(version.version)}>版本 {version.version}{version.version === latestVersion ? " · 最新" : ""}</NativeSelectOption>)}</NativeSelect></Label>
                <Label htmlFor="task-due-at">截止时间<Input id="task-due-at" type="datetime-local" required value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 bg-white" /></Label>
                <Label htmlFor="task-note">分配备注<Input id="task-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="选填，参与者可看到" className="mt-2 bg-white" /></Label>

                {selectedParticipants.length > 0 ? <div className="space-y-3"><p className="text-sm font-semibold">每人设备</p>{selectedParticipants.map((participant) => <Label key={participant.publicId} htmlFor={`device-${participant.publicId}`} className="block rounded-xl bg-white p-3 text-xs"><span className="flex justify-between gap-2"><span className="font-semibold">{participant.displayAlias}</span><span className="text-[var(--muted)]">{participant.locale}</span></span><NativeSelect id={`device-${participant.publicId}`} value={devices[participant.publicId] ?? ""} onChange={(event) => setDevices((current) => ({ ...current, [participant.publicId]: event.target.value }))} className="mt-2 w-full"><NativeSelectOption value="">不指定设备</NativeSelectOption>{participant.devices.map((device) => <NativeSelectOption key={device.publicId} value={device.publicId}>{device.label} · {device.publicId}{device.publicId === participant.defaultDevicePublicId ? " · 默认" : ""}</NativeSelectOption>)}</NativeSelect></Label>)}</div> : <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-sm leading-6 text-[var(--muted)]">选择参与者后，可在这里为每个人确认设备。设备可以留空。</div>}
              </section>
            </div>
            {error ? <Alert role="alert" variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert> : null}
          </div>

          <footer className="apple-dialog-footer flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-7">
            <p className="text-sm font-medium text-[var(--muted)]">已选择 <span className="tabular-nums text-[var(--ink)]">{selected.length}</span> 人</p>
            <div className="flex gap-2"><Button type="button" variant="ghost" onClick={close}>完成</Button><Button type="submit" disabled={busy || selected.length === 0}>{busy ? "正在分配…" : <><Plus className="size-4" weight="bold" />分配给 {selected.length} 人</>}</Button></div>
          </footer>
        </form>
      </dialog>
    </>
  );
}
