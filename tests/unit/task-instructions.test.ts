import { describe, expect, it } from "vitest";
import {
  criterionDisplayStatus,
  taskContentHash,
  taskInstructionsSchema,
  type TaskInstructions,
} from "@egocapture/core/domain/task-instructions";

const instructions: TaskInstructions = {
  schemaVersion: "ego-task/1",
  title: "整理桌面",
  description: "将桌面物品分类整理。",
  estimatedDurationSec: 300,
  environmentSetup: ["保持桌面光线充足"],
  requiredObjects: [{ code: "desk", label: "桌面", mustBeVisible: true }],
  recordingGuide: {
    steps: [{ order: 1, instruction: "从桌面全景开始", expectedVisualEvidence: ["桌面"] }],
    mustShow: ["双手"],
    mustAvoid: ["个人证件"],
    targetResolution: "1080p",
    targetFps: 30,
    sessionMarker: { required: true, holdSeconds: 3, instruction: "录制开头展示二维码" },
  },
  uploadGuide: {
    allowedSources: ["ssd", "mobile"],
    instructions: ["选择原始文件"],
    recoveryInstructions: ["刷新后选择继续"],
  },
  completionCriteria: [{ code: "duration", description: "时长可读", validator: "metadata" }],
  privacyChecklist: ["确认画面没有个人信息"],
};

describe("task instructions", () => {
  it("produces a stable content hash", () => {
    expect(taskContentHash(instructions)).toBe(taskContentHash(structuredClone(instructions)));
    expect(taskContentHash(instructions)).toHaveLength(64);
  });

  it("enforces ordered steps, unique codes and explicit future capability labels", () => {
    const invalid = structuredClone(instructions);
    invalid.recordingGuide.steps[0].order = 2;
    invalid.requiredObjects.push({ code: "desk", label: "重复桌面", mustBeVisible: false });
    expect(taskInstructionsSchema.safeParse(invalid).success).toBe(false);
    expect(criterionDisplayStatus("metadata")).toBe("not_checked");
    expect(criterionDisplayStatus("manual")).toBe("manual_review");
    expect(criterionDisplayStatus("future_cv")).toBe("future_capability");
  });
});
