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
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { FieldError, TagSelectField, TextListField } from "@/app/(console)/tasks/task-form-fields";

const resolutionPresets = ["360p", "1080p", "2K", "4K"];
const fpsPresets = [24, 25, 30, 60];
const mustShowPresets = ["参与者双手", "完整操作过程", "使用中的工具", "任务开始前的环境", "任务完成后的结果"];
const mustAvoidPresets = ["人脸", "镜子", "证件", "住址", "屏幕通知", "私人照片", "定位信息"];
const evidencePresets = ["参与者双手", "操作对象", "使用中的工具", "任务开始状态", "任务完成结果"];

const moduleDefinitions = [
  { id: "environment", label: "环境与活动范围" },
  { id: "steps", label: "具体执行步骤" },
  { id: "objects", label: "必需物品" },
  { id: "mustShow", label: "必须展示" },
  { id: "mustAvoid", label: "必须避开" },
  { id: "constraints", label: "其他录制约束" },
  { id: "completion", label: "完成判定标准" },
  { id: "upload", label: "上传说明" },
  { id: "privacy", label: "隐私检查清单" },
] as const;

type ModuleId = (typeof moduleDefinitions)[number]["id"];

const sourceOptions: Array<{ value: TaskInstructions["uploadGuide"]["allowedSources"][number]; label: string }> = [
  { value: "camera", label: "摄像机内部存储" },
  { value: "ssd", label: "SSD" },
  { value: "mobile", label: "手机" },
  { value: "desktop", label: "电脑" },
  { value: "other", label: "其他外部存储" },
];

function errorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("message" in error)) return undefined;
  return typeof error.message === "string" ? error.message : undefined;
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
  return (
    <fieldset className="rounded-xl border bg-card/70 p-5 shadow-xs sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={`移除${title}模块`}>
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
  const availableModules = useMemo(
    () => moduleDefinitions.filter((definition) => !enabledModules.has(definition.id)),
    [enabledModules],
  );
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
        error?: { message?: string };
      };
      if (!response.ok || !payload.data) {
        setError("root.server", { type: "server", message: payload.error?.message || "无法保存任务草稿，请检查内容后重试。" });
        return;
      }
      if (mode === "create" && payload.data.taskPublicId) {
        router.push(`/tasks/${payload.data.taskPublicId}`);
        return;
      }
      if (payload.data.updatedAt) setUpdatedAt(payload.data.updatedAt);
      reset(instructions);
      setStatus("任务草稿已保存。");
      router.refresh();
    } catch {
      setError("root.server", { type: "server", message: "无法连接服务器。请检查网络后重试。" });
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
        error?: { message?: string };
      };
      if (!response.ok || !payload.data) {
        setError("root.server", { type: "server", message: payload.error?.message || "无法发布任务版本，请稍后重试。" });
      } else {
        setUpdatedAt(payload.data.updatedAt);
        setStatus(`已发布 Version ${payload.data.version}。`);
        router.refresh();
      }
    } catch {
      setError("root.server", { type: "server", message: "无法连接服务器。请检查网络后重试。" });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(save)} className="mt-8 space-y-8" noValidate>
      <section aria-labelledby="task-basic-heading" className="rounded-xl border bg-card/70 p-5 shadow-xs sm:p-7">
        <h2 id="task-basic-heading" className="text-2xl font-semibold">基础信息</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">参与者会先看到标题、描述和目标录制规格。标有 * 的字段为必填。</p>
        <div className="mt-6 space-y-5">
          <div>
            <Label htmlFor="task-title">任务标题 *</Label>
            <Input id="task-title" className="mt-2" placeholder="例如：制作一杯咖啡" maxLength={120} required aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "task-title-error" : undefined} {...register("title")} />
            <FieldError id="task-title-error" message={errors.title?.message} />
          </div>
          <div>
            <Label htmlFor="task-description">任务描述 *</Label>
            <Textarea id="task-description" className="mt-2 min-h-32" placeholder="说明参与者需要完成什么，以及任务完成后的预期结果。" maxLength={2_000} required aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "task-description-error" : undefined} {...register("description")} />
            <FieldError id="task-description-error" message={errors.description?.message} />
          </div>
        </div>
      </section>

      <section aria-labelledby="recording-spec-heading" className="rounded-xl border bg-card/70 p-5 shadow-xs sm:p-7">
        <h2 id="recording-spec-heading" className="text-2xl font-semibold">录制规格</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">这些值用于参与者说明，并作为上传后 Metadata 校验的目标。</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Controller control={control} name="recordingSpec.targetDurationSec" render={({ field, fieldState }) => (
            <div>
              <Label htmlFor="target-duration">目标录制时长（分钟）*</Label>
              <Input id="target-duration" className="mt-2" type="number" min={1} max={480} step={0.5} required value={field.value / 60} onChange={(event) => field.onChange(Math.round(Number(event.target.value) * 60))} onBlur={field.onBlur} name={field.name} ref={field.ref} aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "target-duration-error" : undefined} />
              <FieldError id="target-duration-error" message={fieldState.error?.message} />
            </div>
          )} />
          <Controller control={control} name="recordingSpec.durationToleranceSec" render={({ field, fieldState }) => (
            <div>
              <Label htmlFor="duration-tolerance">允许时长误差（± 分钟）*</Label>
              <Input id="duration-tolerance" className="mt-2" type="number" min={0} max={240} step={0.5} required value={field.value / 60} onChange={(event) => field.onChange(Math.round(Number(event.target.value) * 60))} onBlur={field.onBlur} name={field.name} ref={field.ref} aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "duration-tolerance-error" : undefined} />
              <FieldError id="duration-tolerance-error" message={fieldState.error?.message} />
            </div>
          )} />
          <Controller control={control} name="recordingSpec.targetResolution" render={({ field, fieldState }) => {
            const custom = !resolutionPresets.includes(field.value);
            return (
              <div>
                <Label htmlFor="target-resolution">目标分辨率 *</Label>
                <NativeSelect id="target-resolution" className="mt-2 w-full" value={custom ? "__custom" : field.value} onChange={(event) => field.onChange(event.target.value === "__custom" ? "" : event.target.value)} onBlur={field.onBlur} name={field.name} ref={field.ref} aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "target-resolution-error" : undefined}>
                  {resolutionPresets.map((resolution) => <NativeSelectOption key={resolution} value={resolution}>{resolution}</NativeSelectOption>)}
                  <NativeSelectOption value="__custom">自定义分辨率…</NativeSelectOption>
                </NativeSelect>
                {custom ? <><Label htmlFor="custom-resolution" className="mt-3">自定义分辨率</Label><Input id="custom-resolution" className="mt-2" value={field.value} onChange={field.onChange} placeholder="例如：1440p" maxLength={40} required aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "target-resolution-error" : undefined} /></> : null}
                <FieldError id="target-resolution-error" message={fieldState.error?.message} />
              </div>
            );
          }} />
          <Controller control={control} name="recordingSpec.targetFps" render={({ field, fieldState }) => {
            const custom = !fpsPresets.includes(field.value);
            return (
              <div>
                <Label htmlFor="target-fps">目标帧率（FPS）*</Label>
                <NativeSelect id="target-fps" className="mt-2 w-full" value={custom ? "__custom" : String(field.value)} onChange={(event) => field.onChange(event.target.value === "__custom" ? 0 : Number(event.target.value))} onBlur={field.onBlur} name={field.name} ref={field.ref} aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "target-fps-error" : undefined}>
                  {fpsPresets.map((fps) => <NativeSelectOption key={fps} value={fps}>{fps} FPS</NativeSelectOption>)}
                  <NativeSelectOption value="__custom">自定义帧率…</NativeSelectOption>
                </NativeSelect>
                {custom ? <><Label htmlFor="custom-fps" className="mt-3">自定义帧率</Label><Input id="custom-fps" className="mt-2" type="number" min={1} max={240} value={field.value || ""} onChange={(event) => field.onChange(Number(event.target.value))} required aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "target-fps-error" : undefined} /></> : null}
                <FieldError id="target-fps-error" message={fieldState.error?.message} />
              </div>
            );
          }} />
        </div>
      </section>

      <section aria-labelledby="task-modules-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="task-modules-heading" className="text-2xl font-semibold">任务说明</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">按需添加说明模块；参与者端会按固定顺序展示非空模块。</p>
          </div>
          {availableModules.length > 0 ? (
            <div>
              <Label htmlFor="add-task-module" className="sr-only">添加说明模块</Label>
              <NativeSelect id="add-task-module" value="" onChange={(event) => { if (event.target.value) enableModule(event.target.value as ModuleId); }} className="w-full min-w-56 font-semibold sm:w-auto">
                <NativeSelectOption value="">＋ 添加说明模块</NativeSelectOption>
                {availableModules.map((definition) => <NativeSelectOption key={definition.id} value={definition.id}>{definition.label}</NativeSelectOption>)}
              </NativeSelect>
            </div>
          ) : null}
        </div>

        <div className="mt-6 space-y-5">
          {enabledModules.has("environment") ? (
            <ModuleFrame title="环境与活动范围" description="说明录制前的环境准备，以及活动可以发生的范围。" onRemove={() => removeModule("environment")}>
              <div className="grid gap-6 lg:grid-cols-2">
                <Controller control={control} name="environmentSetup" render={({ field, fieldState }) => <TextListField id="environment-setup" label="环境准备" items={field.value} onChange={field.onChange} placeholder="例如：保持厨房台面光线充足" addLabel="添加环境准备" error={fieldState.error?.message} />} />
                <Controller control={control} name="areaConstraints" render={({ field, fieldState }) => <TextListField id="area-constraints" label="活动范围限制" items={field.value} onChange={field.onChange} placeholder="例如：活动范围限制在厨房内" addLabel="添加范围限制" error={fieldState.error?.message} />} />
              </div>
            </ModuleFrame>
          ) : null}

          {enabledModules.has("steps") ? (
            <ModuleFrame title="具体执行步骤" description="步骤顺序会直接展示给参与者；预期画面用于说明每一步应留下什么视觉证据。" onRemove={() => removeModule("steps")}>
              <div className="space-y-4">
                {stepArray.fields.map((step, index) => (
                  <div key={step.id} className="rounded-lg border bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">步骤 {index + 1}</p>
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => { const next = structuredClone(getValues("recordingGuide.steps")); [next[index - 1], next[index]] = [next[index], next[index - 1]]; replaceSteps(next); }} aria-label={`上移步骤 ${index + 1}`}><ArrowUpIcon aria-hidden="true" /></Button>
                        <Button type="button" variant="ghost" size="icon" disabled={index === stepArray.fields.length - 1} onClick={() => { const next = structuredClone(getValues("recordingGuide.steps")); [next[index], next[index + 1]] = [next[index + 1], next[index]]; replaceSteps(next); }} aria-label={`下移步骤 ${index + 1}`}><ArrowDownIcon aria-hidden="true" /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => replaceSteps(getValues("recordingGuide.steps").filter((_, stepIndex) => stepIndex !== index))} aria-label={`删除步骤 ${index + 1}`}><TrashIcon aria-hidden="true" /></Button>
                      </div>
                    </div>
                    <input type="hidden" {...register(`recordingGuide.steps.${index}.order`, { valueAsNumber: true })} />
                    <div className="mt-4">
                      <Label htmlFor={`step-${index}-instruction`}>操作说明 *</Label>
                      <Textarea id={`step-${index}-instruction`} className="mt-2 min-h-24" placeholder="描述参与者在这一步需要完成的操作" maxLength={500} required aria-invalid={Boolean(errors.recordingGuide?.steps?.[index]?.instruction)} aria-describedby={errors.recordingGuide?.steps?.[index]?.instruction ? `step-${index}-instruction-error` : undefined} {...register(`recordingGuide.steps.${index}.instruction`)} />
                      <FieldError id={`step-${index}-instruction-error`} message={errors.recordingGuide?.steps?.[index]?.instruction?.message} />
                    </div>
                    <div className="mt-5">
                      <Controller control={control} name={`recordingGuide.steps.${index}.expectedVisualEvidence`} render={({ field, fieldState }) => <TagSelectField id={`step-${index}-evidence`} label="预期画面证据" values={field.value} presets={evidencePresets} onChange={field.onChange} customPlaceholder="例如：咖啡杯" error={fieldState.error?.message} maxItems={20} />} />
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" className="mt-4" onClick={() => stepArray.append({ order: stepArray.fields.length + 1, instruction: "", expectedVisualEvidence: [] })} disabled={stepArray.fields.length >= 50}><PlusIcon aria-hidden="true" />添加步骤</Button>
              <FieldError id="steps-error" message={errorMessage(errors.recordingGuide?.steps)} />
            </ModuleFrame>
          ) : null}

          {enabledModules.has("objects") ? (
            <ModuleFrame title="必需物品" description="列出完成任务需要的物品，并标明物品是否必须出现在摄像机画面中。" onRemove={() => removeModule("objects")}>
              <div className="space-y-3">
                {objectArray.fields.map((object, index) => (
                  <div key={object.id} className="grid gap-3 rounded-lg border bg-background/70 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <input type="hidden" {...register(`requiredObjects.${index}.code`)} />
                    <div>
                      <Label htmlFor={`required-object-${index}`}>物品名称 *</Label>
                      <Input id={`required-object-${index}`} className="mt-2" placeholder="例如：咖啡机" maxLength={120} required aria-invalid={Boolean(errors.requiredObjects?.[index]?.label)} aria-describedby={errors.requiredObjects?.[index]?.label ? `required-object-${index}-error` : undefined} {...register(`requiredObjects.${index}.label`)} />
                      <FieldError id={`required-object-${index}-error`} message={errors.requiredObjects?.[index]?.label?.message} />
                    </div>
                    <Controller control={control} name={`requiredObjects.${index}.mustBeVisible`} render={({ field }) => <Label htmlFor={`required-object-visible-${index}`} className="flex min-h-11 items-center gap-3 rounded-lg border px-3"><Checkbox id={`required-object-visible-${index}`} checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />必须入镜</Label>} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => objectArray.remove(index)} aria-label={`删除必需物品 ${index + 1}`}><TrashIcon aria-hidden="true" /></Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" className="mt-4" onClick={() => objectArray.append({ code: createCode("object"), label: "", mustBeVisible: true })} disabled={objectArray.fields.length >= 30}><PlusIcon aria-hidden="true" />添加物品</Button>
              <FieldError id="objects-error" message={errorMessage(errors.requiredObjects)} />
            </ModuleFrame>
          ) : null}

          {enabledModules.has("mustShow") ? <ModuleFrame title="必须展示" description="选择画面中必须持续或明确出现的内容。" onRemove={() => removeModule("mustShow")}><Controller control={control} name="recordingGuide.mustShow" render={({ field, fieldState }) => <TagSelectField id="must-show" label="必须展示" values={field.value} presets={mustShowPresets} onChange={field.onChange} customPlaceholder="例如：咖啡制作过程" error={fieldState.error?.message} />} /></ModuleFrame> : null}

          {enabledModules.has("mustAvoid") ? <ModuleFrame title="必须避开" description="选择不能出现在画面中的隐私信息、反射或无关内容。" onRemove={() => removeModule("mustAvoid")}><Controller control={control} name="recordingGuide.mustAvoid" render={({ field, fieldState }) => <TagSelectField id="must-avoid" label="必须避开" values={field.value} presets={mustAvoidPresets} onChange={field.onChange} customPlaceholder="例如：家庭账单" error={fieldState.error?.message} />} /></ModuleFrame> : null}

          {enabledModules.has("constraints") ? <ModuleFrame title="其他录制约束" description="补充无法简单归类为必须展示或必须避开的执行限制。" onRemove={() => removeModule("constraints")}><Controller control={control} name="recordingGuide.otherConstraints" render={({ field, fieldState }) => <TextListField id="other-constraints" label="录制约束" items={field.value} onChange={field.onChange} placeholder="例如：全程保持头部朝向操作区域" addLabel="添加录制约束" error={fieldState.error?.message} />} /></ModuleFrame> : null}

          {enabledModules.has("completion") ? (
            <ModuleFrame title="完成判定标准" description="Metadata 用于文件与技术规格检查；内容是否完成仍由研究人员人工审核。" onRemove={() => removeModule("completion")}>
              <div className="space-y-3">
                {criterionArray.fields.map((criterion, index) => (
                  <div key={criterion.id} className="grid gap-3 rounded-lg border bg-background/70 p-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
                    <input type="hidden" {...register(`completionCriteria.${index}.code`)} />
                    <div>
                      <Label htmlFor={`criterion-${index}`}>判定说明 *</Label>
                      <Input id={`criterion-${index}`} className="mt-2" placeholder="例如：咖啡已经完成冲泡" maxLength={500} required aria-invalid={Boolean(errors.completionCriteria?.[index]?.description)} aria-describedby={errors.completionCriteria?.[index]?.description ? `criterion-${index}-error` : undefined} {...register(`completionCriteria.${index}.description`)} />
                      <FieldError id={`criterion-${index}-error`} message={errors.completionCriteria?.[index]?.description?.message} />
                    </div>
                    <div>
                      <Label htmlFor={`criterion-validator-${index}`}>检查方式</Label>
                      <NativeSelect id={`criterion-validator-${index}`} className="mt-2 w-full" {...register(`completionCriteria.${index}.validator`)}><NativeSelectOption value="manual">人工审核</NativeSelectOption><NativeSelectOption value="metadata">Metadata 检查</NativeSelectOption></NativeSelect>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => criterionArray.remove(index)} aria-label={`删除完成判定标准 ${index + 1}`}><TrashIcon aria-hidden="true" /></Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" className="mt-4" onClick={() => criterionArray.append({ code: createCode("criterion"), description: "", validator: "manual" })} disabled={criterionArray.fields.length >= 40}><PlusIcon aria-hidden="true" />添加判定标准</Button>
              <FieldError id="completion-error" message={errorMessage(errors.completionCriteria)} />
            </ModuleFrame>
          ) : null}

          {enabledModules.has("upload") ? (
            <ModuleFrame title="上传说明" description="说明视频可能存放在哪里、如何上传，以及网络中断后如何恢复。" onRemove={() => removeModule("upload")}>
              <Controller control={control} name="uploadGuide.allowedSources" render={({ field, fieldState }) => (
                <div>
                  <p className="text-sm font-semibold">允许的文件来源 *</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sourceOptions.map((source) => <Label key={source.value} htmlFor={`source-${source.value}`} className="flex min-h-11 items-center gap-3 rounded-lg border px-3"><Checkbox id={`source-${source.value}`} checked={field.value.includes(source.value)} onCheckedChange={(checked) => field.onChange(checked === true ? [...field.value, source.value] : field.value.filter((value) => value !== source.value))} />{source.label}</Label>)}
                  </div>
                  <FieldError id="allowed-sources-error" message={fieldState.error?.message} />
                </div>
              )} />
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Controller control={control} name="uploadGuide.instructions" render={({ field, fieldState }) => <TextListField id="upload-instructions" label="上传操作说明" items={field.value} onChange={field.onChange} placeholder="例如：选择摄像机生成的原始文件" addLabel="添加上传说明" error={fieldState.error?.message} />} />
                <Controller control={control} name="uploadGuide.recoveryInstructions" render={({ field, fieldState }) => <TextListField id="recovery-instructions" label="中断恢复说明" items={field.value} onChange={field.onChange} placeholder="例如：重新选择同一文件并继续上传" addLabel="添加恢复说明" error={fieldState.error?.message} />} />
              </div>
            </ModuleFrame>
          ) : null}

          {enabledModules.has("privacy") ? <ModuleFrame title="隐私检查清单" description="参与者在上传前需要逐项确认的隐私要求。" onRemove={() => removeModule("privacy")}><Controller control={control} name="privacyChecklist" render={({ field, fieldState }) => <TextListField id="privacy-checklist" label="检查项" items={field.value} onChange={field.onChange} placeholder="例如：画面中没有私人照片" addLabel="添加隐私检查项" error={fieldState.error?.message} />} /></ModuleFrame> : null}

          {enabledModules.size === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><p className="font-semibold">尚未添加任务说明模块</p><p className="mt-2 text-sm text-muted-foreground">使用“添加说明模块”补充环境、步骤、画面要求和上传说明。</p></div> : null}
        </div>
      </section>

      <section aria-labelledby="system-rules-heading" className="rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
        <div className="flex gap-3">
          <InfoIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 id="system-rules-heading" className="font-semibold">系统录制与匹配规则</h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-6 text-muted-foreground">
              <li>使用头戴式设备录制第一人称视角视频。</li>
              <li>{initialInstructions.recordingGuide.sessionMarker.instruction}</li>
              <li>{initialInstructions.uploadGuide.matchingInstructions[0]}</li>
              <li>参与者、TaskVersion 与设备从 Assignment 和 Recording Session 推导，不由文件名决定。</li>
            </ul>
          </div>
        </div>
      </section>

      {errors.root?.server ? <Alert role="alert" className="border-l-4 border-destructive px-4 py-3 text-sm"><AlertDescription>{errors.root.server.message}</AlertDescription></Alert> : null}
      <p role="status" aria-live="polite" className="min-h-6 text-sm font-medium text-primary">{status}</p>
      <div className="flex flex-wrap gap-3 border-t pt-6">
        <Button type="submit" disabled={busy} size="lg">{isSubmitting ? (mode === "create" ? "创建草稿中…" : "保存草稿中…") : mode === "create" ? "创建草稿" : "保存草稿"}</Button>
        {mode === "edit" ? <Button type="button" onClick={publish} disabled={busy || isDirty} variant="secondary" size="lg">{publishing ? "发布版本中…" : isDirty ? "先保存草稿" : "发布新版本"}</Button> : null}
      </div>
    </form>
  );
}
