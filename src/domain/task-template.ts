import type { TaskInstructions } from "@/src/domain/task-instructions";

export const defaultTaskInstructions: TaskInstructions = {
  schemaVersion: "ego-task/1",
  title: "Demo Only：上传 5～20 秒测试视频",
  description: "录制一段不含个人信息的短视频，用于验证采集与上传流程。",
  estimatedDurationSec: 20,
  environmentSetup: ["选择光线充足且不包含个人信息的环境"],
  requiredObjects: [{ code: "safe-scene", label: "无敏感信息的普通物品", mustBeVisible: true }],
  recordingGuide: {
    steps: [
      {
        order: 1,
        instruction: "先展示 Session Marker，再连续录制普通物品 5～20 秒",
        expectedVisualEvidence: ["Session Marker", "普通物品"],
      },
    ],
    mustShow: ["稳定的普通场景"],
    mustAvoid: ["人脸", "证件", "住址", "屏幕通知"],
    targetResolution: "1080p",
    targetFps: 30,
    sessionMarker: {
      required: true,
      holdSeconds: 3,
      instruction: "在录制开头稳定展示二维码至少 3 秒；本 MVP 不从视频中自动识别。",
    },
  },
  uploadGuide: {
    allowedSources: ["camera", "ssd", "mobile", "desktop"],
    instructions: ["选择原始 MP4、MOV 或 INSV 文件", "为每个文件手工选择 Recording Session"],
    recoveryInstructions: ["网络中断后重新选择同一文件并点击继续上传"],
  },
  completionCriteria: [
    { code: "metadata-readable", description: "文件容器 metadata 可读取", validator: "metadata" },
    { code: "privacy-review", description: "人工确认不包含个人信息", validator: "manual" },
    { code: "future-content-check", description: "未来自动检查画面内容", validator: "future_cv" },
  ],
  privacyChecklist: ["确认没有人脸或证件", "确认没有住址、定位或通知信息"],
};
