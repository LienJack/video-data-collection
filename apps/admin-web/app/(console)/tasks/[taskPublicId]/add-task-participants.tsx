"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button } from "@egocapture/ui/components/button";
import { Checkbox } from "@egocapture/ui/components/checkbox";
import { Input } from "@egocapture/ui/components/input";
import { Label } from "@egocapture/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { CaretDown, Check, CheckCircle, MagnifyingGlass, MapPin, Plus, UserPlus, X } from "@phosphor-icons/react";
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
  currentTaskState: "planned" | "assigned" | null;
  devices: Array<{ publicId: string; label: string }>;
};

type Result = {
  created: Array<{
    participantPublicId: string;
    assignmentPublicId: string | null;
    state: "planned" | "assigned";
  }>;
  skipped: Array<{ participantPublicId: string; code: string; message: string }>;
};

type DialogStep = "participants" | "settings";

function RegionMultiSelect({
  regions,
  selectedRegions,
  onToggle,
  onClear,
}: {
  regions: string[];
  selectedRegions: string[];
  onToggle: (region: string) => void;
  onClear: () => void;
}) {
  return (
    <details className="group/region-select relative">
      <summary
        data-testid="region-filter-trigger"
        className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
        aria-label={selectedRegions.length === 0 ? "筛选地区，当前为全部地区" : `筛选地区，已选择 ${selectedRegions.length} 个地区`}
      >
        <span className="flex min-w-0 items-center gap-2 font-medium"><MapPin aria-hidden="true" className="size-4 text-[var(--signal-dark)]" />地区</span>
        <span className="ml-auto truncate text-[var(--muted)]">{selectedRegions.length === 0 ? "全部地区" : `已选 ${selectedRegions.length} 项`}</span>
        <CaretDown aria-hidden="true" className="size-4 shrink-0 text-[var(--muted)] transition-transform group-open/region-select:rotate-180" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 max-h-72 w-full min-w-56 overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-2 shadow-[0_18px_55px_rgb(15_23_42_/_16%)]">
        {regions.length > 0 ? (
          <div role="group" aria-label="地区选项" className="space-y-1">
            {regions.map((region) => {
              const checked = selectedRegions.includes(region);
              return (
                <button
                  key={region}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => onToggle(region)}
                  className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm outline-none hover:bg-[var(--paper)] focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded border ${checked ? "border-[var(--signal)] bg-[var(--signal)] text-white" : "border-[var(--line)] bg-white"}`}>{checked ? <Check className="size-3.5" weight="bold" /> : null}</span>
                  <span className="min-w-0 flex-1 truncate">{region}</span>
                </button>
              );
            })}
          </div>
        ) : <p className="px-2.5 py-3 text-sm text-[var(--muted)]">暂无地区数据</p>}
        {selectedRegions.length > 0 ? <button type="button" onClick={onClear} className="mt-2 min-h-10 w-full rounded-lg border-t border-[var(--line)] px-2.5 pt-3 text-left text-sm font-medium text-[var(--signal-dark)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">清空地区筛选</button> : null}
      </div>
    </details>
  );
}

function initialDueAt() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function eligibility(participant: EligibleParticipant) {
  if (participant.currentTaskState === "planned") return { allowed: false, reason: "已在发布名单中" };
  if (participant.currentTaskState === "assigned" || participant.currentAssignmentPublicId) return { allowed: false, reason: "已在当前任务中" };
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
  const [step, setStep] = useState<DialogStep>("participants");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const regions = useMemo(() => Array.from(new Set(participants.flatMap((participant) => participant.countryRegion ? [participant.countryRegion] : []))).sort((left, right) => left.localeCompare(right, "zh-CN")), [participants]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return participants.filter((participant) => {
      const matchesQuery = !normalized || `${participant.displayAlias} ${participant.publicId} ${participant.countryRegion ?? ""}`.toLocaleLowerCase().includes(normalized);
      const matchesRegion = selectedRegions.length === 0 || (participant.countryRegion !== null && selectedRegions.includes(participant.countryRegion));
      return matchesQuery && matchesRegion;
    });
  }, [participants, query, selectedRegions]);
  const selectedParticipants = selected.map((publicId) => participants.find((participant) => participant.publicId === publicId)).filter((participant): participant is EligibleParticipant => Boolean(participant));

  function open() {
    setError("");
    setResult(null);
    setStep("participants");
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
    } else {
      setDevices((current) => {
        const next = { ...current };
        delete next[publicId];
        return next;
      });
    }
  }

  function toggleRegion(region: string) {
    setSelectedRegions((current) => current.includes(region) ? current.filter((item) => item !== region) : [...current, region]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== "settings") return;
    if (selected.length === 0) {
      setError("请至少选择一名参与者。");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    const response = await fetch(`/api/admin/tasks/${taskPublicId}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        taskVersion: taskVersion || undefined,
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
      setStep("participants");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <>
      <Button size="lg" onClick={open} className="shadow-[0_10px_30px_rgb(57_117_173_/_22%)]"><UserPlus className="size-5" weight="bold" />添加参与者</Button>
      <dialog ref={dialogRef} aria-labelledby="add-participants-title" onCancel={(event) => { event.preventDefault(); close(); }} className="apple-dialog h-[min(46rem,calc(100dvh-1.5rem))] w-[min(70rem,calc(100%-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-hidden p-0 text-[var(--ink)] backdrop:bg-[rgb(15_23_42_/_28%)]">
        <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
          <header className="apple-dialog-header flex items-start justify-between gap-4 px-5 py-4 sm:px-7 sm:py-5">
            <div>
              <p className="page-kicker">{taskPublicId}</p>
              <h2 id="add-participants-title" className="mt-1 text-2xl font-semibold tracking-[-0.035em]">添加参与者</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">一次选择一人或多人；每个人都会获得独立的任务记录。</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="关闭添加参与者窗口"><X className="size-5" /></Button>
          </header>

          <nav aria-label="添加参与者步骤" className="border-b border-[var(--line)] bg-white/70 px-5 py-3 sm:px-7">
            <ol className="grid grid-cols-2 gap-2">
              <li>
                <button type="button" aria-label={step === "settings" ? "选择人员，已完成" : "选择人员"} aria-current={step === "participants" ? "step" : undefined} onClick={() => setStep("participants")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${step === "participants" ? "bg-[var(--teal-soft)] text-[var(--signal-dark)]" : "text-[var(--signal-dark)] hover:bg-[var(--paper)]"}`}>
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--signal)] text-xs font-semibold text-white">{step === "settings" ? <Check className="size-3.5" weight="bold" /> : "1"}</span>
                  <span className="truncate">选择人员</span>
                </button>
              </li>
              <li>
                <button type="button" aria-current={step === "settings" ? "step" : undefined} disabled={selected.length === 0} onClick={() => setStep("settings")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45 ${step === "settings" ? "bg-[var(--teal-soft)] text-[var(--signal-dark)]" : "text-[var(--muted)] hover:bg-[var(--paper)]"}`}>
                  <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${step === "settings" ? "bg-[var(--signal)] text-white" : "bg-[var(--paper-deep)] text-[var(--muted)]"}`}>2</span>
                  <span className="truncate">设备与设置</span>
                </button>
              </li>
            </ol>
          </nav>

          <div className="min-h-0 flex-1 overflow-hidden px-5 py-5 sm:px-7">
            {step === "participants" ? (
              <section aria-labelledby="participant-picker-heading" className="flex h-full min-h-0 flex-col">
                {result ? (
                  <div role="status" className="mb-4 shrink-0 rounded-2xl bg-[var(--teal-soft)] p-4">
                    <div className="flex items-center gap-3"><CheckCircle className="size-6 text-[var(--signal-dark)]" weight="fill" /><p className="font-semibold">{versions.length === 0 ? `已加入发布名单 · ${result.created.length} 人` : `成功添加 ${result.created.length} 名参与者`}</p></div>
                    {result.skipped.length > 0 ? <div className="mt-3 space-y-2 text-sm"><p className="font-semibold">{result.skipped.length} 人未添加</p>{result.skipped.map((item) => <p key={item.participantPublicId}>{item.participantPublicId}：{item.message}</p>)}</div> : null}
                  </div>
                ) : null}
                <div className="mb-3 flex shrink-0 items-end justify-between gap-3">
                  <div><h3 id="participant-picker-heading" className="text-base font-semibold">选择人员</h3><p aria-live="polite" className="mt-1 text-xs text-[var(--muted)]">显示 {filtered.length} 人，已选择 {selected.length} 人</p></div>
                </div>
                <div className="mb-3 grid shrink-0 gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
                  <div className="relative">
                    <Label htmlFor="task-participant-search" className="sr-only">搜索参与者</Label>
                    <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
                    <Input id="task-participant-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、编号或地区" className="min-h-12 bg-white pl-10" />
                  </div>
                  <RegionMultiSelect regions={regions} selectedRegions={selectedRegions} onToggle={toggleRegion} onClear={() => setSelectedRegions([])} />
                </div>
                <div data-testid="participant-list" className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain rounded-2xl bg-[var(--paper)] p-2 pb-4">
                  {filtered.map((participant) => {
                    const state = eligibility(participant);
                    const checked = selected.includes(participant.publicId);
                    return (
                      <label data-testid="participant-option" key={participant.publicId} className={`flex min-h-16 items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-[0_1px_3px_rgb(15_23_42_/_5%)] transition-[background-color,transform] ${state.allowed ? "cursor-pointer active:scale-[0.99]" : "cursor-not-allowed opacity-55"}`}>
                        <Checkbox checked={checked} disabled={!state.allowed} onCheckedChange={(value) => toggle(participant.publicId, value === true)} aria-label={`选择 ${participant.displayAlias}`} className="size-5" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{participant.displayAlias}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{participant.publicId} · {participant.locale}{participant.countryRegion ? ` · ${participant.countryRegion}` : ""}</span></span>
                        <span className={`text-xs font-medium ${state.allowed ? "text-[var(--signal-dark)]" : "text-[var(--muted)]"}`}>{state.reason}</span>
                      </label>
                    );
                  })}
                  {filtered.length === 0 ? <p className="p-8 text-center text-sm text-[var(--muted)]">没有匹配的参与者。请修改搜索内容。</p> : null}
                </div>
              </section>
            ) : (
              <div className="h-full overflow-y-auto overscroll-contain pr-1">
                <div className="mb-5"><h3 className="text-base font-semibold">设备与设置</h3><p className="mt-1 text-xs text-[var(--muted)]">为已选择的 {selectedParticipants.length} 名参与者确认设备，并填写本次公共设置。</p></div>
                <div className="grid gap-6 lg:grid-cols-[minmax(18rem,.72fr)_minmax(0,1fr)]">
                  <section aria-labelledby="assignment-settings-heading" className="space-y-5">
                    <div><h4 id="assignment-settings-heading" className="text-sm font-semibold">公共设置</h4><p className="mt-1 text-xs text-[var(--muted)]">以下内容会应用到本次选择的所有人。</p></div>
                    {versions.length > 0 ? <Label htmlFor="task-version">任务版本<NativeSelect id="task-version" value={String(taskVersion)} onChange={(event) => setTaskVersion(Number(event.target.value))} className="mt-2 w-full bg-white">{versions.map((version) => <NativeSelectOption key={version.version} value={String(version.version)}>版本 {version.version}{version.version === latestVersion ? " · 最新" : ""}</NativeSelectOption>)}</NativeSelect></Label> : <Alert><AlertDescription>当前任务仍是草稿。参与者会先加入发布名单；首次发布时，系统会把名单绑定到冻结的版本并生成正式 Assignment。</AlertDescription></Alert>}
                    <Label htmlFor="task-due-at">截止时间<Input id="task-due-at" type="datetime-local" required value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 bg-white" /></Label>
                    <Label htmlFor="task-note">分配备注<Input id="task-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="选填，参与者可看到" className="mt-2 bg-white" /></Label>
                  </section>

                  <section aria-labelledby="participant-devices-heading">
                    <div className="mb-3"><h4 id="participant-devices-heading" className="text-sm font-semibold">每人设备</h4><p className="mt-1 text-xs text-[var(--muted)]">设备可以留空；有默认设备时已自动带入。</p></div>
                    <div data-testid="participant-device-list" className="space-y-3 pb-2">
                      {selectedParticipants.map((participant) => <Label key={participant.publicId} htmlFor={`device-${participant.publicId}`} className="block rounded-xl bg-white p-3 text-xs"><span className="flex justify-between gap-2"><span className="font-semibold">{participant.displayAlias}</span><span className="text-[var(--muted)]">{participant.locale}</span></span><NativeSelect id={`device-${participant.publicId}`} value={devices[participant.publicId] ?? ""} onChange={(event) => setDevices((current) => ({ ...current, [participant.publicId]: event.target.value }))} className="mt-2 w-full"><NativeSelectOption value="">不指定设备</NativeSelectOption>{participant.devices.map((device) => <NativeSelectOption key={device.publicId} value={device.publicId}>{device.label} · {device.publicId}{device.publicId === participant.defaultDevicePublicId ? " · 默认" : ""}</NativeSelectOption>)}</NativeSelect></Label>)}
                    </div>
                  </section>
                </div>
                {error ? <Alert role="alert" variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert> : null}
              </div>
            )}
          </div>

          <footer className="apple-dialog-footer flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-7">
            <p className="text-sm font-medium text-[var(--muted)]">已选择 <span className="tabular-nums text-[var(--ink)]">{selected.length}</span> 人</p>
            {step === "participants" ? (
              <div key="participant-actions" className="flex gap-2"><Button type="button" variant="ghost" onClick={close}>完成</Button><Button type="button" disabled={selected.length === 0} onClick={() => setStep("settings")}>下一步：设备与设置</Button></div>
            ) : (
              <div key="setting-actions" className="flex gap-2"><Button type="button" variant="ghost" onClick={() => setStep("participants")}>上一步</Button><Button type="submit" disabled={busy || selected.length === 0}>{busy ? (versions.length === 0 ? "正在加入…" : "正在分配…") : <><Plus className="size-4" weight="bold" />{versions.length === 0 ? "加入发布名单" : `分配给 ${selected.length} 人`}</>}</Button></div>
            )}
          </footer>
        </form>
      </dialog>
    </>
  );
}
