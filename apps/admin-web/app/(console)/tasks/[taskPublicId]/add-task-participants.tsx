"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button } from "@egocapture/ui/components/button";
import { Checkbox } from "@egocapture/ui/components/checkbox";
import { Input } from "@egocapture/ui/components/input";
import { useI18n } from "@egocapture/ui/lib/i18n";
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
  const i18n = useI18n();

  return (
    <details className="group/region-select relative">
      <summary
        data-testid="region-filter-trigger"
        className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
        aria-label={selectedRegions.length === 0 ? i18n.t("adminUi.regionFilterAll") : i18n.t("adminUi.regionFilterSelected", { count: selectedRegions.length })}
      >
        <span className="flex min-w-0 items-center gap-2 font-medium"><MapPin aria-hidden="true" className="size-4 text-[var(--signal-dark)]" />{i18n.t("adminUi.regionLabel")}</span>
        <span className="ml-auto truncate text-[var(--muted)]">{selectedRegions.length === 0 ? i18n.t("adminUi.allRegions") : i18n.t("adminUi.selectedCount", { count: selectedRegions.length })}</span>
        <CaretDown aria-hidden="true" className="size-4 shrink-0 text-[var(--muted)] transition-transform group-open/region-select:rotate-180" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 max-h-72 w-full min-w-56 overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-2 shadow-[0_18px_55px_rgb(15_23_42_/_16%)]">
        {regions.length > 0 ? (
          <div role="group" aria-label={i18n.t("adminUi.regionOptions")} className="space-y-1">
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
                  <span className="min-w-0 flex-1 truncate">{i18n.regionName(region)}</span>
                </button>
              );
            })}
          </div>
        ) : <p className="px-2.5 py-3 text-sm text-[var(--muted)]">{i18n.t("adminUi.noRegions")}</p>}
        {selectedRegions.length > 0 ? <button type="button" onClick={onClear} className="mt-2 min-h-10 w-full rounded-lg border-t border-[var(--line)] px-2.5 pt-3 text-left text-sm font-medium text-[var(--signal-dark)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">{i18n.t("adminUi.clearRegionFilter")}</button> : null}
      </div>
    </details>
  );
}

function initialDueAt() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
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
  const i18n = useI18n();
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

  const regions = useMemo(() => Array.from(new Set(participants.flatMap((participant) => participant.countryRegion ? [participant.countryRegion] : []))).sort((left, right) => left.localeCompare(right, i18n.locale)), [i18n.locale, participants]);
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
      setError(i18n.t("adminUi.chooseParticipantError"));
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
    const payload = await response.json() as { data?: Result; error?: { code?: string } };
    if (!response.ok || !payload.data) {
      setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.addParticipantFailed"));
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
      <Button size="lg" onClick={open} className="shadow-[0_10px_30px_rgb(57_117_173_/_22%)]"><UserPlus className="size-5" weight="bold" />{i18n.t("adminUi.addParticipants")}</Button>
      <dialog ref={dialogRef} aria-labelledby="add-participants-title" onCancel={(event) => { event.preventDefault(); close(); }} className="apple-dialog h-[min(46rem,calc(100dvh-1.5rem))] w-[min(70rem,calc(100%-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-hidden p-0 text-[var(--ink)] backdrop:bg-[rgb(15_23_42_/_28%)]">
        <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
          <header className="apple-dialog-header flex items-start justify-between gap-4 px-5 py-4 sm:px-7 sm:py-5">
            <div>
              <p className="page-kicker">{taskPublicId}</p>
              <h2 id="add-participants-title" className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{i18n.t("adminUi.addParticipants")}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{i18n.t("adminUi.addParticipantsIntro")}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={close} aria-label={i18n.t("adminUi.closeAddParticipants")}><X className="size-5" /></Button>
          </header>

          <nav aria-label={i18n.t("adminUi.addParticipantsSteps")} className="border-b border-[var(--line)] bg-white/70 px-5 py-3 sm:px-7">
            <ol className="grid grid-cols-2 gap-2">
              <li>
                <button type="button" aria-label={step === "settings" ? i18n.t("adminUi.choosePeopleComplete") : i18n.t("adminUi.choosePeople")} aria-current={step === "participants" ? "step" : undefined} onClick={() => setStep("participants")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${step === "participants" ? "bg-[var(--teal-soft)] text-[var(--signal-dark)]" : "text-[var(--signal-dark)] hover:bg-[var(--paper)]"}`}>
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--signal)] text-xs font-semibold text-white">{step === "settings" ? <Check className="size-3.5" weight="bold" /> : "1"}</span>
                  <span className="truncate">{i18n.t("adminUi.choosePeople")}</span>
                </button>
              </li>
              <li>
                <button type="button" aria-current={step === "settings" ? "step" : undefined} disabled={selected.length === 0} onClick={() => setStep("settings")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45 ${step === "settings" ? "bg-[var(--teal-soft)] text-[var(--signal-dark)]" : "text-[var(--muted)] hover:bg-[var(--paper)]"}`}>
                  <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${step === "settings" ? "bg-[var(--signal)] text-white" : "bg-[var(--paper-deep)] text-[var(--muted)]"}`}>2</span>
                  <span className="truncate">{i18n.t("adminUi.devicesAndSettings")}</span>
                </button>
              </li>
            </ol>
          </nav>

          <div className="min-h-0 flex-1 overflow-hidden px-5 py-5 sm:px-7">
            {step === "participants" ? (
              <section aria-labelledby="participant-picker-heading" className="flex h-full min-h-0 flex-col">
                {result ? (
                  <div role="status" className="mb-4 shrink-0 rounded-2xl bg-[var(--teal-soft)] p-4">
                    <div className="flex items-center gap-3"><CheckCircle className="size-6 text-[var(--signal-dark)]" weight="fill" /><p className="font-semibold">{versions.length === 0 ? i18n.t("adminUi.joinedRoster", { count: result.created.length }) : i18n.t("adminUi.participantsAdded", { count: result.created.length })}</p></div>
                    {result.skipped.length > 0 ? <div className="mt-3 space-y-2 text-sm"><p className="font-semibold">{i18n.t("adminUi.participantsSkipped", { count: result.skipped.length })}</p>{result.skipped.map((item) => <p key={item.participantPublicId}>{item.participantPublicId}: {i18n.error(item.code)}</p>)}</div> : null}
                  </div>
                ) : null}
                <div className="mb-3 flex shrink-0 items-end justify-between gap-3">
                  <div><h3 id="participant-picker-heading" className="text-base font-semibold">{i18n.t("adminUi.choosePeople")}</h3><p aria-live="polite" className="mt-1 text-xs text-[var(--muted)]">{i18n.t("adminUi.shownSelected", { shown: filtered.length, selected: selected.length })}</p></div>
                </div>
                <div className="mb-3 grid shrink-0 gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
                  <div className="relative">
                    <Label htmlFor="task-participant-search" className="sr-only">{i18n.t("adminUi.searchParticipants")}</Label>
                    <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
                    <Input id="task-participant-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={i18n.t("adminUi.participantSearchPlaceholder")} className="min-h-12 bg-white pl-10" />
                  </div>
                  <RegionMultiSelect regions={regions} selectedRegions={selectedRegions} onToggle={toggleRegion} onClear={() => setSelectedRegions([])} />
                </div>
                <div data-testid="participant-list" className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain rounded-2xl bg-[var(--paper)] p-2 pb-4">
                  {filtered.map((participant) => {
                    const state = participant.currentTaskState === "planned"
                      ? { allowed: false, reason: i18n.t("adminUi.alreadyInRoster") }
                      : participant.currentTaskState === "assigned" || participant.currentAssignmentPublicId
                        ? { allowed: false, reason: i18n.t("adminUi.alreadyInTask") }
                        : participant.status !== "active"
                          ? { allowed: false, reason: i18n.t("adminUi.participantInactive") }
                          : participant.consentStatus !== "valid"
                            ? { allowed: false, reason: i18n.t("adminUi.consentInvalid") }
                            : { allowed: true, reason: i18n.t("adminUi.eligible") };
                    const checked = selected.includes(participant.publicId);
                    return (
                      <label data-testid="participant-option" key={participant.publicId} className={`flex min-h-16 items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-[0_1px_3px_rgb(15_23_42_/_5%)] transition-[background-color,transform] ${state.allowed ? "cursor-pointer active:scale-[0.99]" : "cursor-not-allowed opacity-55"}`}>
                        <Checkbox checked={checked} disabled={!state.allowed} onCheckedChange={(value) => toggle(participant.publicId, value === true)} aria-label={i18n.t("adminUi.chooseName", { name: participant.displayAlias })} className="size-5" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{participant.displayAlias}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{participant.publicId} · {i18n.languageName(participant.locale)}{participant.countryRegion ? ` · ${i18n.regionName(participant.countryRegion)}` : ""}</span></span>
                        <span className={`text-xs font-medium ${state.allowed ? "text-[var(--signal-dark)]" : "text-[var(--muted)]"}`}>{state.reason}</span>
                      </label>
                    );
                  })}
                  {filtered.length === 0 ? <p className="p-8 text-center text-sm text-[var(--muted)]">{i18n.t("adminUi.noParticipantMatches")}</p> : null}
                </div>
              </section>
            ) : (
              <div className="h-full overflow-y-auto overscroll-contain pr-1">
                <div className="mb-5"><h3 className="text-base font-semibold">{i18n.t("adminUi.devicesAndSettings")}</h3><p className="mt-1 text-xs text-[var(--muted)]">{i18n.t("adminUi.devicesSettingsHelp", { count: selectedParticipants.length })}</p></div>
                <div className="grid gap-6 lg:grid-cols-[minmax(18rem,.72fr)_minmax(0,1fr)]">
                  <section aria-labelledby="assignment-settings-heading" className="space-y-5">
                    <div><h4 id="assignment-settings-heading" className="text-sm font-semibold">{i18n.t("adminUi.sharedSettings")}</h4><p className="mt-1 text-xs text-[var(--muted)]">{i18n.t("adminUi.sharedSettingsHelp")}</p></div>
                    {versions.length > 0 ? <Label htmlFor="task-version">{i18n.t("adminUi.taskVersion")}<NativeSelect id="task-version" value={String(taskVersion)} onChange={(event) => setTaskVersion(Number(event.target.value))} className="mt-2 w-full bg-white">{versions.map((version) => <NativeSelectOption key={version.version} value={String(version.version)}>{i18n.t("common.version", { value: version.version })}{version.version === latestVersion ? ` · ${i18n.t("adminUi.latest")}` : ""}</NativeSelectOption>)}</NativeSelect></Label> : <Alert><AlertDescription>{i18n.t("adminUi.draftRosterHelp")}</AlertDescription></Alert>}
                    <Label htmlFor="task-due-at">{i18n.t("common.dueAt")}<Input id="task-due-at" type="datetime-local" required value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 bg-white" /></Label>
                    <Label htmlFor="task-note">{i18n.t("adminUi.assignmentNotes")}<Input id="task-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder={i18n.t("adminUi.visibleOptional")} className="mt-2 bg-white" /></Label>
                  </section>

                  <section aria-labelledby="participant-devices-heading">
                    <div className="mb-3"><h4 id="participant-devices-heading" className="text-sm font-semibold">{i18n.t("adminUi.perPersonDevice")}</h4><p className="mt-1 text-xs text-[var(--muted)]">{i18n.t("adminUi.deviceOptionalHelp")}</p></div>
                    <div data-testid="participant-device-list" className="space-y-3 pb-2">
                      {selectedParticipants.map((participant) => <Label key={participant.publicId} htmlFor={`device-${participant.publicId}`} className="block rounded-xl bg-white p-3 text-xs"><span className="flex justify-between gap-2"><span className="font-semibold">{participant.displayAlias}</span><span className="text-[var(--muted)]">{i18n.languageName(participant.locale)}</span></span><NativeSelect id={`device-${participant.publicId}`} value={devices[participant.publicId] ?? ""} onChange={(event) => setDevices((current) => ({ ...current, [participant.publicId]: event.target.value }))} className="mt-2 w-full"><NativeSelectOption value="">{i18n.t("adminUi.noDeviceSpecified")}</NativeSelectOption>{participant.devices.map((device) => <NativeSelectOption key={device.publicId} value={device.publicId}>{device.label} · {device.publicId}{device.publicId === participant.defaultDevicePublicId ? ` · ${i18n.t("common.default")}` : ""}</NativeSelectOption>)}</NativeSelect></Label>)}
                    </div>
                  </section>
                </div>
                {error ? <Alert role="alert" variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert> : null}
              </div>
            )}
          </div>

          <footer className="apple-dialog-footer flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-7">
            <p className="text-sm font-medium text-[var(--muted)]">{i18n.t("adminUi.selectedPeople", { count: selected.length })}</p>
            {step === "participants" ? (
              <div key="participant-actions" className="flex gap-2"><Button type="button" variant="ghost" onClick={close}>{i18n.t("adminUi.done")}</Button><Button type="button" disabled={selected.length === 0} onClick={() => setStep("settings")}>{i18n.t("adminUi.nextSettings")}</Button></div>
            ) : (
              <div key="setting-actions" className="flex gap-2"><Button type="button" variant="ghost" onClick={() => setStep("participants")}>{i18n.t("adminUi.previousStep")}</Button><Button type="submit" disabled={busy || selected.length === 0}>{busy ? (versions.length === 0 ? i18n.t("adminUi.joining") : i18n.t("adminUi.assigning")) : <><Plus className="size-4" weight="bold" />{versions.length === 0 ? i18n.t("adminUi.joinRoster") : i18n.t("adminUi.assignCount", { count: selected.length })}</>}</Button></div>
            )}
          </footer>
        </form>
      </dialog>
    </>
  );
}
