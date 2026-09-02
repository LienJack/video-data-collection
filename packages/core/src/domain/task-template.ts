import type { TaskInstructions } from "@egocapture/core/domain/task-instructions";

export const defaultTaskInstructions: TaskInstructions = {
  schemaVersion: "ego-task/2",
  title: "第一人称日常活动录制",
  description: "按照任务说明完成日常活动，并使用头戴式摄像设备录制第一人称视频。",
  recordingSpec: {
    targetDurationSec: 10 * 60,
    durationToleranceSec: 2 * 60,
    targetResolution: "4K",
    targetFps: 30,
    perspective: "egocentric",
    mountType: "head_mounted",
  },
  environmentSetup: [],
  areaConstraints: [],
  requiredObjects: [],
  recordingGuide: {
    steps: [],
    mustShow: ["参与者双手", "完整操作过程"],
    mustAvoid: ["人脸", "镜子", "证件", "住址", "屏幕通知"],
    otherConstraints: [],
    sessionMarker: {
      required: true,
      holdSeconds: 3,
      instruction: "在录制开头稳定展示本次 Recording Session 的二维码至少 3 秒。",
    },
  },
  uploadGuide: {
    allowedSources: ["camera", "ssd", "mobile", "desktop", "other"],
    instructions: ["选择摄像机生成的原始 MP4、MOV 或 INSV 文件"],
    recoveryInstructions: ["网络中断后重新选择同一文件并点击继续上传"],
    matchingInstructions: ["为每个文件手动选择对应的 Recording Session；不要依赖摄像机文件名判断归属。"],
  },
  completionCriteria: [
    { code: "metadata-readable", description: "文件完整且 Metadata 可读取", validator: "metadata" },
    { code: "recording-spec", description: "时长、分辨率与帧率符合任务规格", validator: "metadata" },
    { code: "task-complete", description: "人工确认任务步骤与画面要求已经完成", validator: "manual" },
  ],
  privacyChecklist: [
    "确认画面中没有人脸、证件或私人照片",
    "确认画面中没有住址、定位、账号或屏幕通知信息",
  ],
};
