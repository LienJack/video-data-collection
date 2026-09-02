import { createHash } from "node:crypto";
import { z } from "zod";

const taskInstructionsBaseSchema = z.object({
  schemaVersion: z.literal("ego-task/1"),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2_000),
  estimatedDurationSec: z.number().int().positive().max(8 * 60 * 60),
  environmentSetup: z.array(z.string().min(1).max(300)).max(30),
  requiredObjects: z.array(z.object({
    code: z.string().min(1).max(40),
    label: z.string().min(1).max(120),
    mustBeVisible: z.boolean(),
  })).max(30),
  recordingGuide: z.object({
    steps: z.array(z.object({
      order: z.number().int().positive(),
      instruction: z.string().min(1).max(500),
      expectedVisualEvidence: z.array(z.string().min(1).max(300)).max(20),
    })).min(1).max(50),
    mustShow: z.array(z.string().min(1).max(300)).max(30),
    mustAvoid: z.array(z.string().min(1).max(300)).max(30),
    targetResolution: z.string().min(1).max(40),
    targetFps: z.number().int().positive().max(240),
    sessionMarker: z.object({
      required: z.boolean(),
      holdSeconds: z.number().int().min(0).max(120),
      instruction: z.string().min(1).max(500),
    }),
  }),
  uploadGuide: z.object({
    allowedSources: z.array(z.enum(["camera", "ssd", "mobile", "desktop"])).min(1),
    instructions: z.array(z.string().min(1).max(500)).max(30),
    recoveryInstructions: z.array(z.string().min(1).max(500)).max(30),
  }),
  completionCriteria: z.array(z.object({
    code: z.string().min(1).max(40),
    description: z.string().min(1).max(500),
    validator: z.enum(["metadata", "manual", "future_cv"]),
  })).max(40),
  privacyChecklist: z.array(z.string().min(1).max(500)).max(30),
});

export const taskInstructionsSchema = taskInstructionsBaseSchema.superRefine((value, context) => {
  const expectedOrders = value.recordingGuide.steps.map((_, index) => index + 1);
  const actualOrders = value.recordingGuide.steps.map((step) => step.order);
  if (actualOrders.some((order, index) => order !== expectedOrders[index])) {
    context.addIssue({
      code: "custom",
      path: ["recordingGuide", "steps"],
      message: "录制步骤必须按 1 开始连续排序",
    });
  }
  for (const [path, codes] of [
    [["requiredObjects"], value.requiredObjects.map((item) => item.code)],
    [["completionCriteria"], value.completionCriteria.map((item) => item.code)],
  ] as const) {
    if (new Set(codes).size !== codes.length) {
      context.addIssue({ code: "custom", path: [...path], message: "code 必须唯一" });
    }
  }
});

export const criterionDisplayStatusSchema = z.enum([
  "checked",
  "not_checked",
  "manual_review",
  "future_capability",
]);

export type CriterionDisplayStatus = z.infer<typeof criterionDisplayStatusSchema>;

export function criterionDisplayStatus(
  validator: TaskInstructions["completionCriteria"][number]["validator"],
): CriterionDisplayStatus {
  if (validator === "future_cv") return "future_capability";
  if (validator === "manual") return "manual_review";
  return "not_checked";
}

export type TaskInstructions = z.infer<typeof taskInstructionsSchema>;

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

export function taskContentHash(input: TaskInstructions): string {
  const validated = taskInstructionsSchema.parse(input);
  return createHash("sha256").update(JSON.stringify(stable(validated))).digest("hex");
}
