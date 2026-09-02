"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button } from "@egocapture/ui/components/button";
import { Checkbox } from "@egocapture/ui/components/checkbox";
import { Input } from "@egocapture/ui/components/input";
import { Label } from "@egocapture/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { Textarea } from "@egocapture/ui/components/textarea";
import { defaultTaskInstructions } from "@egocapture/core/domain/task-template";
import { taskInstructionsSchema, type TaskInstructions } from "@egocapture/core/domain/task-instructions";
import { ArrowDownIcon, ArrowUpIcon, InfoIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { FieldError, TagSelectField, TextListField } from "@/app/(console)/tasks/task-form-fields";
import { useI18n } from "@egocapture/ui/lib/i18n";
import type { Translator } from "@egocapture/core/i18n";

const resolutionPresets = ["360p", "1080p", "2K", "4K"];
const fpsPresets = [24, 25, 30, 60];
type ModuleId = "environment" | "steps" | "objects" | "mustShow" | "mustAvoid" | "constraints" | "completion" | "upload" | "privacy";

function errorMessage(error: unknown, i18n: Translator, key: "adminUi.validationInvalid" | "adminUi.validationTolerance" | "adminUi.validationStepOrder" | "adminUi.validationCodeUnique" | "adminUi.validationOverlap" = "adminUi.validationInvalid"): string | undefined {
  if (!error) return undefined;
  return i18n.t(key);
}

function initialModules(instructions: TaskInstructions): Set<ModuleId> {
  const modules = new Set<ModuleId>();
  if (instructions.environmentSetup.length || instructions.areaConstraints.length) modules.add("environment");
  if (instructions.recordingGuide.steps.length) modules.add("steps");
  if (instructions.requiredObjects.length) modules.add("objects");
  if (instructions.recordingGuide.mustShow.length) modules.add("mustShow");
  if (instructions.recordingGuide.mustAvoid.length) modules.add("mustAvoid");
  if (instructions.recordingGuide.otherConstraints.length) modules.add("constraints");
  if (instructions.completionCriteria.length) modules.add("completion");
  if (instructions.uploadGuide.instructions.length || instructions.uploadGuide.recoveryInstructions.length) modules.add("upload");
  if (instructions.privacyChecklist.length) modules.add("privacy");
  return modules;
}

function createCode(prefix: "object" | "criterion") {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function ModuleFrame({ title, description, onRemove, children }: {
  title: string;
  description: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const i18n = useI18n();
  return (
    <fieldset className="rounded-xl border bg-card/70 p-5 shadow-xs sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={i18n.t("adminUi.removeModule", { title })}>
          <TrashIcon aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-5">{children}</div>
    </fieldset>
  );
}

export function TaskEditor({ mode, taskPublicId, initialInstructions, initialUpdatedAt }: {
  mode: "create" | "edit";
  taskPublicId?: string;
  initialInstructions: TaskInstructions;
  initialUpdatedAt?: string;
}) {
  const router = useRouter();
  const i18n = useI18n();
  const mustShowPresets = [i18n.t("adminUi.presetHands"), i18n.t("adminUi.presetProcess"), i18n.t("adminUi.presetTools"), i18n.t("adminUi.presetInitialEnvironment"), i18n.t("adminUi.presetResult")];
  const mustAvoidPresets = [i18n.t("adminUi.presetFace"), i18n.t("adminUi.presetMirror"), i18n.t("adminUi.presetId"), i18n.t("adminUi.presetAddress"), i18n.t("adminUi.presetNotifications"), i18n.t("adminUi.presetPhotos"), i18n.t("adminUi.presetLocation")];
  const evidencePresets = [i18n.t("adminUi.presetHands"), i18n.t("adminUi.presetObject"), i18n.t("adminUi.presetTools"), i18n.t("adminUi.presetInitialState"), i18n.t("adminUi.presetResult")];
  const moduleDefinitions: Array<{ id: ModuleId; label: string }> = [
    { id: "environment", label: i18n.t("adminUi.moduleEnvironment") }, { id: "steps", label: i18n.t("adminUi.moduleSteps") }, { id: "objects", label: i18n.t("adminUi.moduleObjects") }, { id: "mustShow", label: i18n.t("adminUi.moduleMustShow") }, { id: "mustAvoid", label: i18n.t("adminUi.moduleMustAvoid") }, { id: "constraints", label: i18n.t("adminUi.moduleConstraints") }, { id: "completion", label: i18n.t("adminUi.moduleCompletion") }, { id: "upload", label: i18n.t("adminUi.moduleUpload") }, { id: "privacy", label: i18n.t("adminUi.modulePrivacy") },
  ];
  const sourceOptions: Array<{ value: TaskInstructions["uploadGuide"]["allowedSources"][number]; label: string }> = [
    { value: "camera", label: i18n.t("adminUi.cameraStorage") }, { value: "ssd", label: "SSD" }, { value: "mobile", label: i18n.t("adminUi.deviceTypePhone") }, { value: "desktop", label: i18n.t("participantUi.sourceDesktop") }, { value: "other", label: i18n.t("participantUi.sourceOther") },
  ];
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt || "");
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState("");
  const [enabledModules, setEnabledModules] = useState(() => initialModules(initialInstructions));
  const {
    control, register, handleSubmit, getValues, setValue, setError, clearErrors, reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TaskInstructions>({
    resolver: zodResolver(taskInstructionsSchema),
    defaultValues: structuredClone(initialInstructions),
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });

  const stepArray = useFieldArray({ control, name: "recordingGuide.steps" });
  const objectArray = useFieldArray({ control, name: "requiredObjects" });
  const criterionArray = useFieldArray({ control, name: "completionCriteria" });
  const availableModules = moduleDefinitions.filter((definition) => !enabledModules.has(definition.id));
  const busy = isSubmitting || publishing;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  function enableModule(moduleId: ModuleId) {
    setEnabledModules((current) => new Set(current).add(moduleId));
  }

  function removeModule(moduleId: ModuleId) {
    if (moduleId === "environment") {
      setValue("environmentSetup", [], { shouldDirty: true });
      setValue("areaConstraints", [], { shouldDirty: true });
    } else if (moduleId === "steps") stepArray.replace([]);
    else if (moduleId === "objects") objectArray.replace([]);
    else if (moduleId === "mustShow") setValue("recordingGuide.mustShow", [], { shouldDirty: true });
    else if (moduleId === "mustAvoid") setValue("recordingGuide.mustAvoid", [], { shouldDirty: true });
    else if (moduleId === "constraints") setValue("recordingGuide.otherConstraints", [], { shouldDirty: true });
    else if (moduleId === "completion") criterionArray.replace([]);
    else if (moduleId === "upload") {
      setValue("uploadGuide.allowedSources", structuredClone(defaultTaskInstructions.uploadGuide.allowedSources), { shouldDirty: true });
      setValue("uploadGuide.instructions", [], { shouldDirty: true });
      setValue("uploadGuide.recoveryInstructions", [], { shouldDirty: true });
    } else if (moduleId === "privacy") setValue("privacyChecklist", [], { shouldDirty: true });
    setEnabledModules((current) => {
      const next = new Set(current);
      next.delete(moduleId);
      return next;
    });
  }

  function replaceSteps(next: TaskInstructions["recordingGuide"]["steps"]) {
    stepArray.replace(next.map((step, index) => ({ ...step, order: index + 1 })));
  }

  async function save(instructions: TaskInstructions) {
    clearErrors("root.server");
    setStatus("");
    try {
      const response = await fetch(mode === "create" ? "/api/admin/tasks" : `/api/admin/tasks/${taskPublicId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "content-type": "application/json",
          ...(mode === "create" ? { "idempotency-key": crypto.randomUUID() } : {}),
        },
        body: JSON.stringify(mode === "create" ? { instructions } : { instructions, expectedUpdatedAt: updatedAt }),
      });
      const payload = await response.json() as {
        data?: { taskPublicId?: string; updatedAt?: string };
        error?: { code?: string };
      };
      if (!response.ok || !payload.data) {
        setError("root.server", { type: "server", message: payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.taskDraftSaveFailed") });
        return;
      }
      if (mode === "create" && payload.data.taskPublicId) {
        router.push(`/tasks/${payload.data.taskPublicId}`);
        return;
      }
      if (payload.data.updatedAt) setUpdatedAt(payload.data.updatedAt);
      reset(instructions);
      setStatus(i18n.t("adminUi.taskDraftSaved"));
      router.refresh();
    } catch {
      setError("root.server", { type: "server", message: i18n.t("adminUi.serverConnectionFailed") });
    }
  }

  async function publish() {
    if (!taskPublicId || isDirty) return;
    setPublishing(true);
    clearErrors("root.server");
    setStatus("");
    try {
      const response = await fetch(`/api/admin/tasks/${taskPublicId}/publish`, {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
      });
      const payload = await response.json() as {
        data?: { version: number; contentHash: string; updatedAt: string };
        error?: { code?: string };
      };
      if (!response.ok || !payload.data) {
        setError("root.server", { type: "server", message: payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.taskPublishFailed") });
      } else {
        setUpdatedAt(payload.data.updatedAt);
        setStatus(i18n.t("adminUi.versionPublished", { version: payload.data.version }));
        router.refresh();
      }
    } catch {
      setError("root.server", { type: "server", message: i18n.t("adminUi.serverConnectionFailed") });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(save)} className="mt-8 space-y-8" noValidate>
      <section aria-labelledby="task-basic-heading" className="rounded-xl border bg-card/70 p-5 shadow-xs sm:p-7">
        <h2 id="task-basic-heading" className="text-2xl font-semibold">{i18n.t("adminUi.basicInformation")}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{i18n.t("adminUi.basicInformationHelp")}</p>
        <div className="mt-6 space-y-5">
          <div>
            <Label htmlFor="task-title">{i18n.t("adminUi.taskTitle")}</Label>
            <Input id="task-title" className="mt-2" placeholder={i18n.t("adminUi.taskTitleExample")} maxLength={120} required aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "task-title-error" : undefined} {...register("title")} />
            <FieldError id="task-title-error" message={errorMessage(errors.title, i18n)} />
          </div>
          <div>
            <Label htmlFor="task-description">{i18n.t("adminUi.taskDescription")}</Label>
            <Textarea id="task-description" className="mt-2 min-h-32" placeholder={i18n.t("adminUi.taskDescriptionHelp")} maxLength={2_000} required aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "task-description-error" : undefined} {...register("description")} />
            <FieldError id="task-description-error" message={errorMessage(errors.description, i18n)} />
          </div>
        </div>
      </section>

      <section aria-labelledby="recording-spec-heading" className="rounded-xl border bg-card/70 p-5 shadow-xs sm:p-7">
        <h2 id="recording-spec-heading" className="text-2xl font-semibold">{i18n.t("adminUi.recordingSpec")}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{i18n.t("adminUi.recordingSpecHelp")}</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Controller control={control} name="recordingSpec.targetDurationSec" render={({ field, fieldState }) => (
            <div>
              <Label htmlFor="target-duration">{i18n.t("adminUi.targetDurationMinutes")}</Label>
              <Input id="target-duration" className="mt-2" type="number" min={1} max={480} step={0.5} required value={field.value / 60} onChange={(event) => field.onChange(Math.round(Number(event.target.value) * 60))} onBlur={field.onBlur} name={field.name} ref={field.ref} aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "target-duration-error" : undefined} />
              <FieldError id="target-duration-error" message={errorMessage(fieldState.error, i18n)} />
            </div>
          )} />
          <Controller control={control} name="recordingSpec.durationToleranceSec" render={({ field, fieldState }) => (
            <div>
              <Label htmlFor="duration-tolerance">{i18n.t("adminUi.durationToleranceMinutes")}</Label>
              <Input id="duration-tolerance" className="mt-2" type="number" min={0} max={240} step={0.5} required value={field.value / 60} onChange={(event) => field.onChange(Math.round(Number(event.target.value) * 60))} onBlur={field.onBlur} name={field.name} ref={field.ref} aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "duration-tolerance-error" : undefined} />
              <FieldError id="duration-tolerance-error" message={errorMessage(fieldState.error, i18n, "adminUi.validationTolerance")} />
            </div>
          )} />
          <Controller control={control} name="recordingSpec.targetResolution" render={({ field, fieldState }) => {
            const custom = !resolutionPresets.includes(field.value);
            return (
              <div>
                <Label htmlFor="target-resolution">{i18n.t("adminUi.targetResolution")}</Label>
                <NativeSelect id="target-resolution" className="mt-2 w-full" value={custom ? "__custom" : field.value} onChange={(event) => field.onChange(event.target.value === "__custom" ? "" : event.target.value)} onBlur={field.onBlur} name={field.name} ref={field.ref} aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "target-resolution-error" : undefined}>
                  {resolutionPresets.map((resolution) => <NativeSelectOption key={resolution} value={resolution}>{resolution}</NativeSelectOption>)}
                  <NativeSelectOption value="__custom">{i18n.t("adminUi.customResolution")}</NativeSelectOption>
                </NativeSelect>
                {custom ? <><Label htmlFor="custom-resolution" className="mt-3">{i18n.t("adminUi.customResolutionLabel")}</Label><Input id="custom-resolution" className="mt-2" value={field.value} onChange={field.onChange} placeholder={i18n.t("adminUi.resolutionExample")} maxLength={40} required aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "target-resolution-error" : undefined} /></> : null}
                <FieldError id="target-resolution-error" message={errorMessage(fieldState.error, i18n)} />
              </div>
            );
          }} />
          <Controller control={control} name="recordingSpec.targetFps" render={({ field, fieldState }) => {
            const custom = !fpsPresets.includes(field.value);
            return (
              <div>
                <Label htmlFor="target-fps">{i18n.t("adminUi.targetFps")}</Label>
                <NativeSelect id="target-fps" className="mt-2 w-full" value={custom ? "__custom" : String(field.value)} onChange={(event) => field.onChange(event.target.value === "__custom" ? 0 : Number(event.target.value))} onBlur={field.onBlur} name={field.name} ref={field.ref} aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "target-fps-error" : undefined}>
                  {fpsPresets.map((fps) => <NativeSelectOption key={fps} value={fps}>{fps} FPS</NativeSelectOption>)}
                  <NativeSelectOption value="__custom">{i18n.t("adminUi.customFps")}</NativeSelectOption>
                </NativeSelect>
                {custom ? <><Label htmlFor="custom-fps" className="mt-3">{i18n.t("adminUi.customFpsLabel")}</Label><Input id="custom-fps" className="mt-2" type="number" min={1} max={240} value={field.value || ""} onChange={(event) => field.onChange(Number(event.target.value))} required aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "target-fps-error" : undefined} /></> : null}
                <FieldError id="target-fps-error" message={errorMessage(fieldState.error, i18n)} />
              </div>
            );
          }} />
        </div>
      </section>

      <section aria-labelledby="task-modules-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="task-modules-heading" className="text-2xl font-semibold">{i18n.t("adminUi.instructions")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{i18n.t("adminUi.taskModulesHelp")}</p>
          </div>
          {availableModules.length > 0 ? (
            <div>
              <Label htmlFor="add-task-module" className="sr-only">{i18n.t("adminUi.addInstructionModule")}</Label>
              <NativeSelect id="add-task-module" value="" onChange={(event) => { if (event.target.value) enableModule(event.target.value as ModuleId); }} className="w-full min-w-56 font-semibold sm:w-auto">
                <NativeSelectOption value="">＋ {i18n.t("adminUi.addInstructionModule")}</NativeSelectOption>
                {availableModules.map((definition) => <NativeSelectOption key={definition.id} value={definition.id}>{definition.label}</NativeSelectOption>)}
              </NativeSelect>
            </div>
          ) : null}
        </div>

        <div className="mt-6 space-y-5">
          {enabledModules.has("environment") ? (
            <ModuleFrame title={i18n.t("adminUi.moduleEnvironment")} description={i18n.t("adminUi.environmentModuleHelp")} onRemove={() => removeModule("environment")}>
              <div className="grid gap-6 lg:grid-cols-2">
                <Controller control={control} name="environmentSetup" render={({ field, fieldState }) => <TextListField id="environment-setup" label={i18n.t("participantUi.environmentSetup")} items={field.value} onChange={field.onChange} placeholder={i18n.t("adminUi.environmentExample")} addLabel={i18n.t("adminUi.addEnvironment")} error={errorMessage(fieldState.error, i18n)} />} />
                <Controller control={control} name="areaConstraints" render={({ field, fieldState }) => <TextListField id="area-constraints" label={i18n.t("adminUi.areaLimit")} items={field.value} onChange={field.onChange} placeholder={i18n.t("adminUi.areaExample")} addLabel={i18n.t("adminUi.addAreaLimit")} error={errorMessage(fieldState.error, i18n)} />} />
              </div>
            </ModuleFrame>
          ) : null}

          {enabledModules.has("steps") ? (
            <ModuleFrame title={i18n.t("adminUi.moduleSteps")} description={i18n.t("adminUi.stepsHelp")} onRemove={() => removeModule("steps")}>
              <div className="space-y-4">
                {stepArray.fields.map((step, index) => (
                  <div key={step.id} className="rounded-lg border bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{i18n.t("adminUi.stepNumber", { number: index + 1 })}</p>
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => { const next = structuredClone(getValues("recordingGuide.steps")); [next[index - 1], next[index]] = [next[index], next[index - 1]]; replaceSteps(next); }} aria-label={i18n.t("adminUi.moveStepUp", { number: index + 1 })}><ArrowUpIcon aria-hidden="true" /></Button>
                        <Button type="button" variant="ghost" size="icon" disabled={index === stepArray.fields.length - 1} onClick={() => { const next = structuredClone(getValues("recordingGuide.steps")); [next[index], next[index + 1]] = [next[index + 1], next[index]]; replaceSteps(next); }} aria-label={i18n.t("adminUi.moveStepDown", { number: index + 1 })}><ArrowDownIcon aria-hidden="true" /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => replaceSteps(getValues("recordingGuide.steps").filter((_, stepIndex) => stepIndex !== index))} aria-label={i18n.t("adminUi.deleteStep", { number: index + 1 })}><TrashIcon aria-hidden="true" /></Button>
                      </div>
                    </div>
                    <input type="hidden" {...register(`recordingGuide.steps.${index}.order`, { valueAsNumber: true })} />
                    <div className="mt-4">
                      <Label htmlFor={`step-${index}-instruction`}>{i18n.t("adminUi.operationInstruction")}</Label>
                      <Textarea id={`step-${index}-instruction`} className="mt-2 min-h-24" placeholder={i18n.t("adminUi.operationInstructionHelp")} maxLength={500} required aria-invalid={Boolean(errors.recordingGuide?.steps?.[index]?.instruction)} aria-describedby={errors.recordingGuide?.steps?.[index]?.instruction ? `step-${index}-instruction-error` : undefined} {...register(`recordingGuide.steps.${index}.instruction`)} />
                      <FieldError id={`step-${index}-instruction-error`} message={errorMessage(errors.recordingGuide?.steps?.[index]?.instruction, i18n)} />
                    </div>
                    <div className="mt-5">
                      <Controller control={control} name={`recordingGuide.steps.${index}.expectedVisualEvidence`} render={({ field, fieldState }) => <TagSelectField id={`step-${index}-evidence`} label={i18n.t("adminUi.expectedVisualEvidence")} values={field.value} presets={evidencePresets} onChange={field.onChange} customPlaceholder={i18n.t("adminUi.cupExample")} error={errorMessage(fieldState.error, i18n)} maxItems={20} />} />
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" className="mt-4" onClick={() => stepArray.append({ order: stepArray.fields.length + 1, instruction: "", expectedVisualEvidence: [] })} disabled={stepArray.fields.length >= 50}><PlusIcon aria-hidden="true" />{i18n.t("adminUi.addStep")}</Button>
              <FieldError id="steps-error" message={errorMessage(errors.recordingGuide?.steps, i18n, "adminUi.validationStepOrder")} />
            </ModuleFrame>
          ) : null}

          {enabledModules.has("objects") ? (
            <ModuleFrame title={i18n.t("adminUi.moduleObjects")} description={i18n.t("adminUi.objectsHelp")} onRemove={() => removeModule("objects")}>
              <div className="space-y-3">
                {objectArray.fields.map((object, index) => (
                  <div key={object.id} className="grid gap-3 rounded-lg border bg-background/70 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <input type="hidden" {...register(`requiredObjects.${index}.code`)} />
                    <div>
                      <Label htmlFor={`required-object-${index}`}>{i18n.t("adminUi.objectName")}</Label>
                      <Input id={`required-object-${index}`} className="mt-2" placeholder={i18n.t("adminUi.coffeeMakerExample")} maxLength={120} required aria-invalid={Boolean(errors.requiredObjects?.[index]?.label)} aria-describedby={errors.requiredObjects?.[index]?.label ? `required-object-${index}-error` : undefined} {...register(`requiredObjects.${index}.label`)} />
                      <FieldError id={`required-object-${index}-error`} message={errorMessage(errors.requiredObjects?.[index]?.label, i18n)} />
                    </div>
                    <Controller control={control} name={`requiredObjects.${index}.mustBeVisible`} render={({ field }) => <Label htmlFor={`required-object-visible-${index}`} className="flex min-h-11 items-center gap-3 rounded-lg border px-3"><Checkbox id={`required-object-visible-${index}`} checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />{i18n.t("adminUi.mustBeVisible")}</Label>} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => objectArray.remove(index)} aria-label={i18n.t("adminUi.deleteObject", { number: index + 1 })}><TrashIcon aria-hidden="true" /></Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" className="mt-4" onClick={() => objectArray.append({ code: createCode("object"), label: "", mustBeVisible: true })} disabled={objectArray.fields.length >= 30}><PlusIcon aria-hidden="true" />{i18n.t("adminUi.addObject")}</Button>
              <FieldError id="objects-error" message={errorMessage(errors.requiredObjects, i18n, "adminUi.validationCodeUnique")} />
            </ModuleFrame>
          ) : null}

          {enabledModules.has("mustShow") ? <ModuleFrame title={i18n.t("adminUi.moduleMustShow")} description={i18n.t("adminUi.mustShowHelp")} onRemove={() => removeModule("mustShow")}><Controller control={control} name="recordingGuide.mustShow" render={({ field, fieldState }) => <TagSelectField id="must-show" label={i18n.t("adminUi.moduleMustShow")} values={field.value} presets={mustShowPresets} onChange={field.onChange} customPlaceholder={i18n.t("adminUi.processExample")} error={errorMessage(fieldState.error, i18n)} />} /></ModuleFrame> : null}

          {enabledModules.has("mustAvoid") ? <ModuleFrame title={i18n.t("adminUi.moduleMustAvoid")} description={i18n.t("adminUi.mustAvoidHelp")} onRemove={() => removeModule("mustAvoid")}><Controller control={control} name="recordingGuide.mustAvoid" render={({ field, fieldState }) => <TagSelectField id="must-avoid" label={i18n.t("adminUi.moduleMustAvoid")} values={field.value} presets={mustAvoidPresets} onChange={field.onChange} customPlaceholder={i18n.t("adminUi.billExample")} error={errorMessage(fieldState.error, i18n, "adminUi.validationOverlap")} />} /></ModuleFrame> : null}

          {enabledModules.has("constraints") ? <ModuleFrame title={i18n.t("adminUi.moduleConstraints")} description={i18n.t("adminUi.constraintsHelp")} onRemove={() => removeModule("constraints")}><Controller control={control} name="recordingGuide.otherConstraints" render={({ field, fieldState }) => <TextListField id="other-constraints" label={i18n.t("adminUi.recordingConstraint")} items={field.value} onChange={field.onChange} placeholder={i18n.t("adminUi.constraintExample")} addLabel={i18n.t("adminUi.addConstraint")} error={errorMessage(fieldState.error, i18n)} />} /></ModuleFrame> : null}

          {enabledModules.has("completion") ? (
            <ModuleFrame title={i18n.t("adminUi.moduleCompletion")} description={i18n.t("adminUi.completionHelp")} onRemove={() => removeModule("completion")}>
              <div className="space-y-3">
                {criterionArray.fields.map((criterion, index) => (
                  <div key={criterion.id} className="grid gap-3 rounded-lg border bg-background/70 p-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
                    <input type="hidden" {...register(`completionCriteria.${index}.code`)} />
                    <div>
                      <Label htmlFor={`criterion-${index}`}>{i18n.t("adminUi.criterionDescription")}</Label>
                      <Input id={`criterion-${index}`} className="mt-2" placeholder={i18n.t("adminUi.criterionExample")} maxLength={500} required aria-invalid={Boolean(errors.completionCriteria?.[index]?.description)} aria-describedby={errors.completionCriteria?.[index]?.description ? `criterion-${index}-error` : undefined} {...register(`completionCriteria.${index}.description`)} />
                      <FieldError id={`criterion-${index}-error`} message={errorMessage(errors.completionCriteria?.[index]?.description, i18n)} />
                    </div>
                    <div>
                      <Label htmlFor={`criterion-validator-${index}`}>{i18n.t("adminUi.validationMethod")}</Label>
                      <NativeSelect id={`criterion-validator-${index}`} className="mt-2 w-full" {...register(`completionCriteria.${index}.validator`)}><NativeSelectOption value="manual">{i18n.t("adminUi.manualReviewLabel")}</NativeSelectOption><NativeSelectOption value="metadata">{i18n.t("adminUi.metadataCheckLabel")}</NativeSelectOption></NativeSelect>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => criterionArray.remove(index)} aria-label={i18n.t("adminUi.deleteCriterion", { number: index + 1 })}><TrashIcon aria-hidden="true" /></Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" className="mt-4" onClick={() => criterionArray.append({ code: createCode("criterion"), description: "", validator: "manual" })} disabled={criterionArray.fields.length >= 40}><PlusIcon aria-hidden="true" />{i18n.t("adminUi.addCriterion")}</Button>
              <FieldError id="completion-error" message={errorMessage(errors.completionCriteria, i18n, "adminUi.validationCodeUnique")} />
            </ModuleFrame>
          ) : null}

          {enabledModules.has("upload") ? (
            <ModuleFrame title={i18n.t("adminUi.moduleUpload")} description={i18n.t("adminUi.uploadModuleHelp")} onRemove={() => removeModule("upload")}>
              <Controller control={control} name="uploadGuide.allowedSources" render={({ field, fieldState }) => (
                <div>
                  <p className="text-sm font-semibold">{i18n.t("adminUi.allowedFileSources")}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sourceOptions.map((source) => <Label key={source.value} htmlFor={`source-${source.value}`} className="flex min-h-11 items-center gap-3 rounded-lg border px-3"><Checkbox id={`source-${source.value}`} checked={field.value.includes(source.value)} onCheckedChange={(checked) => field.onChange(checked === true ? [...field.value, source.value] : field.value.filter((value) => value !== source.value))} />{source.label}</Label>)}
                  </div>
                  <FieldError id="allowed-sources-error" message={errorMessage(fieldState.error, i18n)} />
                </div>
              )} />
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Controller control={control} name="uploadGuide.instructions" render={({ field, fieldState }) => <TextListField id="upload-instructions" label={i18n.t("adminUi.uploadOperationInstructions")} items={field.value} onChange={field.onChange} placeholder={i18n.t("adminUi.uploadOriginalExample")} addLabel={i18n.t("adminUi.addUploadInstruction")} error={errorMessage(fieldState.error, i18n)} />} />
                <Controller control={control} name="uploadGuide.recoveryInstructions" render={({ field, fieldState }) => <TextListField id="recovery-instructions" label={i18n.t("adminUi.recoveryInstructions")} items={field.value} onChange={field.onChange} placeholder={i18n.t("adminUi.recoveryExample")} addLabel={i18n.t("adminUi.addRecoveryInstruction")} error={errorMessage(fieldState.error, i18n)} />} />
              </div>
            </ModuleFrame>
          ) : null}

          {enabledModules.has("privacy") ? <ModuleFrame title={i18n.t("adminUi.modulePrivacy")} description={i18n.t("adminUi.privacyHelp")} onRemove={() => removeModule("privacy")}><Controller control={control} name="privacyChecklist" render={({ field, fieldState }) => <TextListField id="privacy-checklist" label={i18n.t("adminUi.checklistItem")} items={field.value} onChange={field.onChange} placeholder={i18n.t("adminUi.privacyExample")} addLabel={i18n.t("adminUi.addPrivacyItem")} error={errorMessage(fieldState.error, i18n)} />} /></ModuleFrame> : null}

          {enabledModules.size === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><p className="font-semibold">{i18n.t("adminUi.noInstructionModules")}</p><p className="mt-2 text-sm text-muted-foreground">{i18n.t("adminUi.noInstructionModulesHelp")}</p></div> : null}
        </div>
      </section>

      <section aria-labelledby="system-rules-heading" className="rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
        <div className="flex gap-3">
          <InfoIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 id="system-rules-heading" className="font-semibold">{i18n.t("adminUi.systemRecordingRules")}</h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-6 text-muted-foreground">
              <li>{i18n.t("adminUi.firstPersonRule")}</li>
              <li>{initialInstructions.recordingGuide.sessionMarker.instruction}</li>
              <li>{initialInstructions.uploadGuide.matchingInstructions[0]}</li>
              <li>{i18n.t("adminUi.authorityRule")}</li>
            </ul>
          </div>
        </div>
      </section>

      {errors.root?.server ? <Alert role="alert" className="border-l-4 border-destructive px-4 py-3 text-sm"><AlertDescription>{errors.root.server.message}</AlertDescription></Alert> : null}
      <p role="status" aria-live="polite" className="min-h-6 text-sm font-medium text-primary">{status}</p>
      <div className="flex flex-wrap gap-3 border-t pt-6">
        <Button type="submit" disabled={busy} size="lg">{isSubmitting ? (mode === "create" ? i18n.t("adminUi.creatingDraft") : i18n.t("adminUi.savingDraft")) : mode === "create" ? i18n.t("adminUi.createDraft") : i18n.t("adminUi.saveDraft")}</Button>
        {mode === "edit" ? <Button type="button" onClick={publish} disabled={busy || isDirty} variant="secondary" size="lg">{publishing ? i18n.t("adminUi.publishingVersion") : isDirty ? i18n.t("adminUi.saveDraftFirst") : i18n.t("adminUi.publishNewVersion")}</Button> : null}
      </div>
    </form>
  );
}
