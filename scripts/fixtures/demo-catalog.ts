import { createHash } from "node:crypto";
import { lifecycleStateMetadata } from "@egocapture/core/domain/lifecycle-machines";
import {
  canonicalLocale,
  isSupportedCountryCode,
  isSupportedTimezone,
  timezonesForCountry,
} from "@egocapture/core/domain/regional-preferences";
import { defaultTaskInstructions } from "@egocapture/core/domain/task-template";
import {
  taskInstructionsSchema,
  type TaskInstructions,
} from "@egocapture/core/domain/task-instructions";

export const DEMO_SEED_ANCHOR = "2026-09-01T00:00:00.000Z";

const PUBLIC_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const DEMO_NAMESPACE = "egocapture/demo-catalog/v1";

export type DemoRegionKey = "cn" | "us" | "jp";

export type DemoRegion = {
  key: DemoRegionKey;
  countryCode: "CN" | "US" | "JP";
  locale: "zh-CN" | "en-US" | "ja-JP";
  timezone: "Asia/Shanghai" | "America/Los_Angeles" | "Asia/Tokyo";
};

export const DEMO_REGIONS: readonly DemoRegion[] = [
  { key: "cn", countryCode: "CN", locale: "zh-CN", timezone: "Asia/Shanghai" },
  { key: "us", countryCode: "US", locale: "en-US", timezone: "America/Los_Angeles" },
  { key: "jp", countryCode: "JP", locale: "ja-JP", timezone: "Asia/Tokyo" },
] as const;

export function stableDemoUuid(kind: string, key: string): string {
  const bytes = createHash("sha256").update(`${DEMO_NAMESPACE}/${kind}/${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function stableDemoPublicId(prefix: "PT" | "DEV" | "TSK" | "AS" | "RS" | "UB" | "UP" | "UA" | "VA" | "RV", key: string): string {
  const digest = createHash("sha256").update(`${DEMO_NAMESPACE}/${prefix}/${key}`).digest();
  const suffix = [...digest.subarray(0, 10)]
    .map((byte) => PUBLIC_ID_ALPHABET[byte % PUBLIC_ID_ALPHABET.length])
    .join("");
  return `${prefix}-${suffix}`;
}

export function demoTime(anchor: string, offsetDays: number, offsetHours = 0): string {
  const instant = new Date(anchor);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== anchor) {
    throw new Error(`Invalid DEMO_SEED_ANCHOR: ${anchor}`);
  }
  instant.setUTCDate(instant.getUTCDate() + offsetDays);
  instant.setUTCHours(instant.getUTCHours() + offsetHours);
  return instant.toISOString();
}

type ParticipantStatus = "draft" | "invited" | "active" | "suspended" | "withdrawn";
type ConsentStatus = "pending" | "valid" | "expired" | "withdrawn";

type PersonDefinition = {
  key: string;
  regionKey: DemoRegionKey;
  displayAlias: string;
  status: ParticipantStatus;
  consentStatus: ConsentStatus;
  login: boolean;
};

const PERSON_DEFINITIONS: readonly PersonDefinition[] = [
  { key: "cn-lin-xiaoyu", regionKey: "cn", displayAlias: "林晓雨", status: "active", consentStatus: "valid", login: true },
  { key: "cn-chen-siyuan", regionKey: "cn", displayAlias: "陈思远", status: "draft", consentStatus: "pending", login: false },
  { key: "cn-zhou-zihan", regionKey: "cn", displayAlias: "周子涵", status: "invited", consentStatus: "pending", login: false },
  { key: "cn-wang-jingyi", regionKey: "cn", displayAlias: "王静怡", status: "suspended", consentStatus: "valid", login: false },
  { key: "cn-liu-chen", regionKey: "cn", displayAlias: "刘晨", status: "withdrawn", consentStatus: "withdrawn", login: false },
  { key: "cn-zhao-jianing", regionKey: "cn", displayAlias: "赵嘉宁", status: "active", consentStatus: "valid", login: false },
  { key: "us-emily-carter", regionKey: "us", displayAlias: "Emily Carter", status: "active", consentStatus: "valid", login: true },
  { key: "us-michael-johnson", regionKey: "us", displayAlias: "Michael Johnson", status: "invited", consentStatus: "expired", login: false },
  { key: "us-olivia-martinez", regionKey: "us", displayAlias: "Olivia Martinez", status: "active", consentStatus: "valid", login: false },
  { key: "us-daniel-wilson", regionKey: "us", displayAlias: "Daniel Wilson", status: "suspended", consentStatus: "valid", login: false },
  { key: "us-sophia-brown", regionKey: "us", displayAlias: "Sophia Brown", status: "draft", consentStatus: "pending", login: false },
  { key: "us-ethan-davis", regionKey: "us", displayAlias: "Ethan Davis", status: "withdrawn", consentStatus: "withdrawn", login: false },
  { key: "jp-sato-misaki", regionKey: "jp", displayAlias: "佐藤 美咲", status: "active", consentStatus: "valid", login: true },
  { key: "jp-suzuki-kenta", regionKey: "jp", displayAlias: "鈴木 健太", status: "invited", consentStatus: "pending", login: false },
  { key: "jp-takahashi-aoi", regionKey: "jp", displayAlias: "高橋 葵", status: "active", consentStatus: "valid", login: false },
  { key: "jp-tanaka-yuto", regionKey: "jp", displayAlias: "田中 悠斗", status: "draft", consentStatus: "pending", login: false },
  { key: "jp-ito-yui", regionKey: "jp", displayAlias: "伊藤 結衣", status: "withdrawn", consentStatus: "withdrawn", login: false },
  { key: "jp-watanabe-shota", regionKey: "jp", displayAlias: "渡辺 翔太", status: "active", consentStatus: "valid", login: false },
] as const;

type DeviceDefinition = {
  key: string;
  participantKey: string;
  manufacturer: string;
  model: string;
  deviceType: "phone" | "action_camera" | "camera";
  status: "active" | "lost" | "retired" | "shared";
  firmwareVersion: string;
  isDefault?: boolean;
};

const DEVICE_DEFINITIONS: readonly DeviceDefinition[] = [
  { key: "cn-xiaomi-14", participantKey: "cn-lin-xiaoyu", manufacturer: "Xiaomi", model: "14", deviceType: "phone", status: "active", firmwareVersion: "HyperOS 1.0", isDefault: true },
  { key: "cn-huawei-pura70", participantKey: "cn-wang-jingyi", manufacturer: "Huawei", model: "Pura 70", deviceType: "phone", status: "lost", firmwareVersion: "HarmonyOS 4.2" },
  { key: "cn-dji-action4", participantKey: "cn-zhao-jianing", manufacturer: "DJI", model: "Osmo Action 4", deviceType: "action_camera", status: "shared", firmwareVersion: "01.04.05.10", isDefault: true },
  { key: "cn-insta360-x4", participantKey: "cn-liu-chen", manufacturer: "Insta360", model: "X4", deviceType: "action_camera", status: "retired", firmwareVersion: "1.2.31" },
  { key: "us-iphone15pro", participantKey: "us-emily-carter", manufacturer: "Apple", model: "iPhone 15 Pro", deviceType: "phone", status: "active", firmwareVersion: "iOS 18.6", isDefault: true },
  { key: "us-gopro12", participantKey: "us-olivia-martinez", manufacturer: "GoPro", model: "HERO12 Black", deviceType: "action_camera", status: "shared", firmwareVersion: "v2.40", isDefault: true },
  { key: "us-pixel8pro", participantKey: "us-daniel-wilson", manufacturer: "Google", model: "Pixel 8 Pro", deviceType: "phone", status: "lost", firmwareVersion: "Android 16" },
  { key: "us-insta360-acepro", participantKey: "us-ethan-davis", manufacturer: "Insta360", model: "Ace Pro", deviceType: "action_camera", status: "retired", firmwareVersion: "1.0.62" },
  { key: "jp-xperia1vi", participantKey: "jp-sato-misaki", manufacturer: "Sony", model: "Xperia 1 VI", deviceType: "phone", status: "active", firmwareVersion: "Android 15", isDefault: true },
  { key: "jp-lumix-gh6", participantKey: "jp-takahashi-aoi", manufacturer: "Panasonic", model: "LUMIX GH6", deviceType: "camera", status: "shared", firmwareVersion: "3.0", isDefault: true },
  { key: "jp-iphone15", participantKey: "jp-watanabe-shota", manufacturer: "Apple", model: "iPhone 15", deviceType: "phone", status: "lost", firmwareVersion: "iOS 18.6" },
  { key: "jp-dji-action4", participantKey: "jp-ito-yui", manufacturer: "DJI", model: "Osmo Action 4", deviceType: "action_camera", status: "retired", firmwareVersion: "01.04.05.10" },
] as const;

type TaskCopy = {
  title: string;
  description: string;
  setup: string;
  area: string;
  objectCode: string;
  objectLabel: string;
  steps: readonly [string, string, string];
  mustShow: readonly string[];
  mustAvoid: readonly string[];
  marker: string;
  upload: string;
  recovery: string;
  matching: string;
  completion: string;
  privacy: readonly [string, string];
};

function taskInstructions(copy: TaskCopy): TaskInstructions {
  const value = structuredClone(defaultTaskInstructions);
  value.title = copy.title;
  value.description = copy.description;
  value.environmentSetup = [copy.setup];
  value.areaConstraints = [copy.area];
  value.requiredObjects = [{ code: copy.objectCode, label: copy.objectLabel, mustBeVisible: true }];
  value.recordingGuide.steps = copy.steps.map((instruction, index) => ({
    order: index + 1,
    instruction,
    expectedVisualEvidence: [copy.mustShow[index % copy.mustShow.length]!],
  }));
  value.recordingGuide.mustShow = [...copy.mustShow];
  value.recordingGuide.mustAvoid = [...copy.mustAvoid];
  value.recordingGuide.sessionMarker.instruction = copy.marker;
  value.uploadGuide.instructions = [copy.upload];
  value.uploadGuide.recoveryInstructions = [copy.recovery];
  value.uploadGuide.matchingInstructions = [copy.matching];
  value.completionCriteria = [
    { code: "metadata-readable", description: copy.completion, validator: "metadata" },
    { code: "task-complete", description: copy.steps[2], validator: "manual" },
  ];
  value.privacyChecklist = [...copy.privacy];
  return taskInstructionsSchema.parse(value);
}

type TaskDefinition = {
  key: string;
  region: DemoRegionKey;
  lifecycle: "draft" | "active" | "archived";
  copy: TaskCopy;
};

const TASK_DEFINITIONS: readonly TaskDefinition[] = [
  {
    key: "cn-clean-counter", region: "cn", lifecycle: "active",
    copy: { title: "清洁厨房台面", description: "以第一人称视角清理并擦拭一小块厨房台面。", setup: "保持光线充足，并将无关私人物品移出画面。", area: "活动范围仅限指定厨房台面。", objectCode: "cleaning-cloth", objectLabel: "清洁布", steps: ["展示清洁前的台面。", "清理杂物并擦拭台面。", "展示完成后的干净台面。"], mustShow: ["参与者双手", "清洁工具", "完成结果"], mustAvoid: ["人脸", "住址", "屏幕通知"], marker: "录制开始时稳定展示会话二维码至少 3 秒。", upload: "上传摄像设备生成的原始文件。", recovery: "中断后重新选择同一文件继续上传。", matching: "手动选择本次录制会话。", completion: "文件完整且元数据可读取。", privacy: ["确认画面中没有人脸或证件。", "确认画面中没有住址或屏幕通知。"] },
  },
  {
    key: "cn-water-plants", region: "cn", lifecycle: "archived",
    copy: { title: "给室内植物浇水", description: "展示为两盆室内植物浇水并收好工具的过程。", setup: "移走带姓名的标签和私人照片。", area: "仅在指定植物附近活动。", objectCode: "watering-can", objectLabel: "浇水壶", steps: ["展示植物和浇水壶。", "依次为植物适量浇水。", "收好浇水壶并展示结果。"], mustShow: ["植物", "浇水过程", "完成结果"], mustAvoid: ["人脸", "姓名标签", "私人照片"], marker: "开头展示会话二维码至少 3 秒。", upload: "上传原始 MP4 或 MOV 文件。", recovery: "中断后选择同一文件恢复上传。", matching: "将文件关联到正确的录制会话。", completion: "文件元数据可读取且画面连续。", privacy: ["确认没有可识别姓名。", "确认没有私人照片。"] },
  },
  {
    key: "us-brew-coffee", region: "us", lifecycle: "active",
    copy: { title: "Brew a cup of coffee", description: "Record preparing a cup and brewing coffee from a first-person view.", setup: "Clear private items from the counter and use even lighting.", area: "Stay within the designated drink-preparation area.", objectCode: "coffee-mug", objectLabel: "Coffee mug", steps: ["Show the clean setup and ingredients.", "Brew the coffee while keeping both hands visible.", "Place the finished cup on the counter and show the result."], mustShow: ["Both hands", "Brewing tools", "Finished drink"], mustAvoid: ["Faces", "Mailing labels", "Screen notifications"], marker: "Hold the session QR code steady for at least 3 seconds at the start.", upload: "Upload the original camera file.", recovery: "Select the same file to resume an interrupted upload.", matching: "Choose the matching recording session manually.", completion: "The file is complete and its metadata is readable.", privacy: ["Confirm that no faces or identity documents are visible.", "Confirm that no addresses or notifications are visible."] },
  },
  {
    key: "us-organize-desk", region: "us", lifecycle: "archived",
    copy: { title: "Organize a small desk", description: "Sort common desk items without recording personal documents or screens.", setup: "Lock all screens and remove personal documents.", area: "Work only at the designated desk.", objectCode: "storage-tray", objectLabel: "Storage tray", steps: ["Show the desk before organizing.", "Sort the items into the storage tray.", "Show the organized desk."], mustShow: ["Both hands", "Desk items", "Finished desk"], mustAvoid: ["Faces", "Personal documents", "Unlocked screens"], marker: "Show the session QR code steadily for at least 3 seconds.", upload: "Upload the unedited source file.", recovery: "Resume by selecting the exact same local file.", matching: "Select the session instead of relying on the filename.", completion: "The source file and metadata are readable.", privacy: ["Confirm no personal papers are visible.", "Confirm every screen is locked or outside the frame."] },
  },
  {
    key: "us-sort-books-draft", region: "us", lifecycle: "draft",
    copy: { title: "Sort books on a shelf", description: "Draft instructions for grouping a small set of books by size.", setup: "Remove handwritten notes and personal photographs.", area: "Use only one shelf.", objectCode: "books", objectLabel: "Books", steps: ["Show the starting shelf.", "Group the books by size.", "Show the completed shelf."], mustShow: ["Books", "Both hands", "Finished shelf"], mustAvoid: ["Faces", "Handwritten notes", "Personal photographs"], marker: "Show the session QR code for 3 seconds.", upload: "Upload the original file.", recovery: "Select the same file to resume.", matching: "Select the corresponding session.", completion: "Metadata is readable.", privacy: ["Remove personal notes.", "Remove personal photographs."] },
  },
  {
    key: "jp-fold-laundry", region: "jp", lifecycle: "active",
    copy: { title: "洗濯物をたたむ", description: "一人称視点で無地のタオルと衣類をたたむ作業を記録します。", setup: "名前入りの衣類や私物を画面から外してください。", area: "指定したテーブルの周辺だけで作業してください。", objectCode: "laundry-basket", objectLabel: "洗濯かご", steps: ["作業前の洗濯物を映します。", "タオルと衣類を順番にたたみます。", "たたみ終えた状態を映します。"], mustShow: ["両手", "洗濯物", "完了した状態"], mustAvoid: ["顔", "名札", "画面通知"], marker: "録画の冒頭でセッション QR コードを 3 秒以上安定して映してください。", upload: "カメラが生成した元のファイルをアップロードしてください。", recovery: "中断時は同じファイルを再選択して再開してください。", matching: "対応する録画セッションを手動で選択してください。", completion: "ファイルが完全でメタデータを読み取れます。", privacy: ["顔や名札が映っていないことを確認してください。", "住所や通知が映っていないことを確認してください。"] },
  },
  {
    key: "jp-pack-day-bag", region: "jp", lifecycle: "archived",
    copy: { title: "外出用バッグを準備する", description: "一般的な持ち物を小さなバッグに入れる手順を記録します。", setup: "身分証、鍵の番号、住所が分かる物を除いてください。", area: "指定したテーブル上だけで作業してください。", objectCode: "day-bag", objectLabel: "小型バッグ", steps: ["空のバッグと持ち物を映します。", "持ち物を順番にバッグへ入れます。", "準備できたバッグを映します。"], mustShow: ["両手", "一般的な持ち物", "準備完了したバッグ"], mustAvoid: ["顔", "身分証", "住所"], marker: "最初にセッション QR コードを 3 秒以上映してください。", upload: "編集していない元ファイルをアップロードしてください。", recovery: "同じファイルを選んでアップロードを再開してください。", matching: "ファイル名ではなく録画セッションを選択してください。", completion: "元ファイルとメタデータを確認できます。", privacy: ["身分証が含まれていないことを確認してください。", "住所が映っていないことを確認してください。"] },
  },
] as const;

type ScenarioDefinition = {
  key: string;
  kind: "healthy" | "pending_review" | "missing_upload" | "device_mismatch" | "failed_retry" | "coverage";
  participantKey: string;
  taskKey: string;
  assignmentStatus: string;
  sessionStatus?: string;
  uploadBatchStatus?: string;
  transferStatus?: string;
  metadataStatus?: string;
  uploadAttemptStatuses?: readonly string[];
  videoAssetStatus?: string;
  metadataAttemptStatus?: string;
  reviewStatus?: string;
};

const SCENARIO_DEFINITIONS: readonly ScenarioDefinition[] = [
  { key: "healthy-cn", kind: "healthy", participantKey: "cn-lin-xiaoyu", taskKey: "cn-clean-counter", assignmentStatus: "accepted", sessionStatus: "closed", uploadBatchStatus: "completed", transferStatus: "verified", metadataStatus: "extracted", uploadAttemptStatuses: ["completed"], videoAssetStatus: "active", metadataAttemptStatus: "extracted", reviewStatus: "resolved" },
  { key: "pending-review-us", kind: "pending_review", participantKey: "us-emily-carter", taskKey: "us-brew-coffee", assignmentStatus: "needs_review", sessionStatus: "closed", uploadBatchStatus: "completed", transferStatus: "verified", metadataStatus: "partial", uploadAttemptStatuses: ["completed"], videoAssetStatus: "active", metadataAttemptStatus: "partial", reviewStatus: "open" },
  { key: "missing-upload-jp", kind: "missing_upload", participantKey: "jp-sato-misaki", taskKey: "jp-fold-laundry", assignmentStatus: "missing_upload", reviewStatus: "open" },
  { key: "device-mismatch-jp", kind: "device_mismatch", participantKey: "jp-takahashi-aoi", taskKey: "jp-pack-day-bag", assignmentStatus: "rework_required", sessionStatus: "closed", uploadBatchStatus: "completed", transferStatus: "verified", metadataStatus: "extracted", uploadAttemptStatuses: ["completed"], videoAssetStatus: "active", metadataAttemptStatus: "extracted", reviewStatus: "open" },
  { key: "failed-retry-us", kind: "failed_retry", participantKey: "us-daniel-wilson", taskKey: "us-brew-coffee", assignmentStatus: "uploading", sessionStatus: "open", uploadBatchStatus: "open", transferStatus: "uploading", metadataStatus: "pending", uploadAttemptStatuses: ["failed", "paused"], reviewStatus: "open" },
  { key: "metadata-failed-us", kind: "coverage", participantKey: "us-olivia-martinez", taskKey: "us-organize-desk", assignmentStatus: "submitted", sessionStatus: "closed", uploadBatchStatus: "completed", transferStatus: "verified", metadataStatus: "failed", uploadAttemptStatuses: ["completed"], videoAssetStatus: "active", metadataAttemptStatus: "failed", reviewStatus: "in_review" },
  { key: "acknowledged-cn", kind: "coverage", participantKey: "cn-zhao-jianing", taskKey: "cn-water-plants", assignmentStatus: "acknowledged" },
  { key: "session-created-cn", kind: "coverage", participantKey: "cn-wang-jingyi", taskKey: "cn-clean-counter", assignmentStatus: "session_created", sessionStatus: "open" },
  { key: "assigned-us", kind: "coverage", participantKey: "us-michael-johnson", taskKey: "us-organize-desk", assignmentStatus: "assigned" },
  { key: "expired-jp", kind: "coverage", participantKey: "jp-watanabe-shota", taskKey: "jp-fold-laundry", assignmentStatus: "expired", uploadBatchStatus: "expired", transferStatus: "expired", metadataStatus: "pending", uploadAttemptStatuses: ["expired"] },
  { key: "canceled-us", kind: "coverage", participantKey: "us-ethan-davis", taskKey: "us-brew-coffee", assignmentStatus: "canceled" },
  { key: "assigned-jp", kind: "coverage", participantKey: "jp-suzuki-kenta", taskKey: "jp-pack-day-bag", assignmentStatus: "assigned", uploadBatchStatus: "completed", transferStatus: "failed", metadataStatus: "pending", uploadAttemptStatuses: ["failed"], reviewStatus: "dismissed" },
] as const;

function state(machine: keyof typeof lifecycleStateMetadata, value: string): string {
  if (!(lifecycleStateMetadata[machine].states as readonly string[]).includes(value)) {
    throw new Error(`Unknown ${machine} state in demo catalog: ${value}`);
  }
  return value;
}

export function buildDemoCatalog(anchor = DEMO_SEED_ANCHOR) {
  const regions = Object.fromEntries(DEMO_REGIONS.map((region) => [region.key, region])) as Record<DemoRegionKey, DemoRegion>;
  const admin = {
    key: "demo-admin",
    profileId: stableDemoUuid("profile", "demo-admin"),
    displayName: "EgoCapture Demo Admin",
    usernameEnv: "DEMO_ADMIN_USERNAME",
    emailEnv: "DEMO_ADMIN_EMAIL",
    passwordEnv: "DEMO_ADMIN_PASSWORD",
  } as const;
  const people = PERSON_DEFINITIONS.map((person, index) => ({
    ...person,
    id: stableDemoUuid("participant", person.key),
    publicId: stableDemoPublicId("PT", person.key),
    profileId: person.login ? stableDemoUuid("profile", person.key) : null,
    region: regions[person.regionKey],
    createdAt: demoTime(anchor, -90 + index),
    withdrawnAt: person.status === "withdrawn" ? demoTime(anchor, -10 + (index % 3)) : null,
  }));
  const devices = DEVICE_DEFINITIONS.map((device, index) => ({
    ...device,
    id: stableDemoUuid("device", device.key),
    publicId: stableDemoPublicId("DEV", device.key),
    assignmentId: stableDemoUuid("device-assignment", device.key),
    assignedAt: demoTime(anchor, -75 + index),
    endedAt: device.status === "retired" ? demoTime(anchor, -20 + index) : null,
  }));
  const tasks = TASK_DEFINITIONS.map((task, index) => ({
    ...task,
    id: stableDemoUuid("task", task.key),
    publicId: stableDemoPublicId("TSK", task.key),
    versionId: task.lifecycle === "draft" ? null : stableDemoUuid("task-version", task.key),
    instructions: taskInstructions(task.copy),
    createdAt: demoTime(anchor, -70 + index),
    publishedAt: task.lifecycle === "draft" ? null : demoTime(anchor, -60 + index),
  }));
  const scenarios = SCENARIO_DEFINITIONS.map((scenario, index) => ({
    ...scenario,
    assignmentId: stableDemoUuid("assignment", scenario.key),
    assignmentPublicId: stableDemoPublicId("AS", scenario.key),
    sessionId: scenario.sessionStatus ? stableDemoUuid("recording-session", scenario.key) : null,
    sessionPublicId: scenario.sessionStatus ? stableDemoPublicId("RS", scenario.key) : null,
    uploadBatchId: scenario.uploadBatchStatus ? stableDemoUuid("upload-batch", scenario.key) : null,
    uploadBatchPublicId: scenario.uploadBatchStatus ? stableDemoPublicId("UB", scenario.key) : null,
    uploadIntentId: scenario.transferStatus ? stableDemoUuid("upload-intent", scenario.key) : null,
    uploadPublicId: scenario.transferStatus ? stableDemoPublicId("UP", scenario.key) : null,
    uploadAttemptIds: (scenario.uploadAttemptStatuses ?? []).map((_, attemptIndex) => stableDemoUuid("upload-attempt", `${scenario.key}/${attemptIndex + 1}`)),
    uploadAttemptPublicIds: (scenario.uploadAttemptStatuses ?? []).map((_, attemptIndex) => stableDemoPublicId("UA", `${scenario.key}/${attemptIndex + 1}`)),
    videoAssetId: scenario.videoAssetStatus ? stableDemoUuid("video-asset", scenario.key) : null,
    videoAssetPublicId: scenario.videoAssetStatus ? stableDemoPublicId("VA", scenario.key) : null,
    storedObjectId: scenario.videoAssetStatus ? stableDemoUuid("stored-object", scenario.key) : null,
    assetFileId: scenario.videoAssetStatus ? stableDemoUuid("asset-file", scenario.key) : null,
    fileMetadataId: scenario.metadataAttemptStatus && scenario.metadataAttemptStatus !== "failed" ? stableDemoUuid("file-metadata", scenario.key) : null,
    metadataAttemptId: scenario.metadataAttemptStatus ? stableDemoUuid("metadata-attempt", scenario.key) : null,
    metadataEvidenceId: scenario.metadataAttemptStatus && scenario.metadataAttemptStatus !== "failed" ? stableDemoUuid("metadata-evidence", scenario.key) : null,
    matchDecisionId: scenario.videoAssetStatus ? stableDemoUuid("match-decision", scenario.key) : null,
    reviewId: scenario.reviewStatus ? stableDemoUuid("review", scenario.key) : null,
    reviewPublicId: scenario.reviewStatus ? stableDemoPublicId("RV", scenario.key) : null,
    auditEventId: stableDemoUuid("audit-event", scenario.key),
    auditRequestId: stableDemoUuid("audit-request", scenario.key),
    createdAt: demoTime(anchor, -45 + index),
    dueAt: demoTime(anchor, scenario.assignmentStatus === "expired" || scenario.assignmentStatus === "missing_upload" ? -2 : 30 + index),
  }));
  const catalog = { anchor, admin, regions: DEMO_REGIONS, people, devices, tasks, scenarios } as const;
  validateDemoCatalog(catalog);
  return catalog;
}

export type DemoCatalog = ReturnType<typeof buildDemoCatalog>;

export function validateDemoCatalog(catalog: {
  anchor: string;
  admin: { profileId: string };
  regions: readonly DemoRegion[];
  people: readonly (PersonDefinition & { id: string; publicId: string; profileId: string | null; region: DemoRegion })[];
  devices: readonly (DeviceDefinition & { id: string; publicId: string; assignmentId: string })[];
  tasks: readonly (TaskDefinition & { id: string; publicId: string; versionId: string | null; instructions: TaskInstructions })[];
  scenarios: readonly (ScenarioDefinition & {
    assignmentId: string;
    assignmentPublicId: string;
    sessionId: string | null;
    sessionPublicId: string | null;
    uploadBatchId: string | null;
    uploadBatchPublicId: string | null;
    uploadIntentId: string | null;
    uploadPublicId: string | null;
    uploadAttemptIds: readonly string[];
    uploadAttemptPublicIds: readonly string[];
    videoAssetId: string | null;
    videoAssetPublicId: string | null;
    storedObjectId: string | null;
    assetFileId: string | null;
    fileMetadataId: string | null;
    metadataAttemptId: string | null;
    metadataEvidenceId: string | null;
    matchDecisionId: string | null;
    reviewId: string | null;
    reviewPublicId: string | null;
    auditEventId: string;
    auditRequestId: string;
  })[];
}) {
  demoTime(catalog.anchor, 0);
  for (const region of catalog.regions) {
    if (!isSupportedCountryCode(region.countryCode)) throw new Error(`Unknown ISO country: ${region.countryCode}`);
    if (canonicalLocale(region.locale) !== region.locale) throw new Error(`Non-canonical locale: ${region.locale}`);
    if (!isSupportedTimezone(region.timezone) || !timezonesForCountry(region.countryCode).includes(region.timezone)) {
      throw new Error(`Timezone ${region.timezone} does not belong to ${region.countryCode}`);
    }
  }
  if (catalog.people.length !== 18) throw new Error("Demo catalog must contain exactly 18 participants");
  for (const region of catalog.regions) {
    if (catalog.people.filter((person) => person.region.key === region.key).length !== 6) {
      throw new Error(`Demo catalog must contain exactly 6 ${region.key.toUpperCase()} participants`);
    }
  }
  if (catalog.people.filter((person) => person.login).length !== 3) {
    throw new Error("Demo catalog must contain exactly 3 participant logins");
  }
  const uniqueKeys = (kind: string, values: readonly string[]) => {
    if (new Set(values).size !== values.length) throw new Error(`Demo catalog ${kind} must be unique`);
  };
  uniqueKeys("region keys", catalog.regions.map((region) => region.key));
  uniqueKeys("participant keys", catalog.people.map((person) => person.key));
  uniqueKeys("participant aliases", catalog.people.map((person) => person.displayAlias));
  uniqueKeys("device keys", catalog.devices.map((device) => device.key));
  uniqueKeys("task keys", catalog.tasks.map((task) => task.key));
  uniqueKeys("scenario keys", catalog.scenarios.map((scenario) => scenario.key));
  for (const person of catalog.people) {
    state("participant.status", person.status);
    state("participant.consent_status", person.consentStatus);
  }
  for (const device of catalog.devices) state("device.status", device.status);
  for (const task of catalog.tasks) {
    state("task.lifecycle", task.lifecycle);
    taskInstructionsSchema.parse(task.instructions);
  }
  for (const scenario of catalog.scenarios) {
    const person = catalog.people.find((candidate) => candidate.key === scenario.participantKey);
    const task = catalog.tasks.find((candidate) => candidate.key === scenario.taskKey);
    if (!person || !task || !task.versionId) {
      throw new Error(`Demo scenario authority is incomplete: ${scenario.key}`);
    }
    if (scenario.sessionId && !catalog.devices.some((device) => device.participantKey === person.key)) {
      throw new Error(`Demo session has no participant device: ${scenario.key}`);
    }
    if (scenario.uploadAttemptIds.length !== (scenario.uploadAttemptStatuses?.length ?? 0)
      || scenario.uploadAttemptPublicIds.length !== scenario.uploadAttemptIds.length) {
      throw new Error(`Demo upload attempt identities are incomplete: ${scenario.key}`);
    }
    if ((scenario.uploadBatchId === null) !== (scenario.uploadBatchStatus === undefined)
      || (scenario.uploadIntentId === null) !== (scenario.transferStatus === undefined)
      || (scenario.videoAssetId === null) !== (scenario.videoAssetStatus === undefined)
      || (scenario.metadataAttemptId === null) !== (scenario.metadataAttemptStatus === undefined)
      || (scenario.reviewId === null) !== (scenario.reviewStatus === undefined)) {
      throw new Error(`Demo scenario child identity does not match its state: ${scenario.key}`);
    }
    if ((scenario.transferStatus && !scenario.uploadBatchId)
      || (scenario.uploadAttemptIds.length > 0 && !scenario.uploadIntentId)
      || (scenario.videoAssetId && !scenario.uploadIntentId)
      || (scenario.metadataAttemptId && !scenario.videoAssetId)) {
      throw new Error(`Demo scenario dependency chain is incomplete: ${scenario.key}`);
    }
    state("assignment.status", scenario.assignmentStatus);
    if (scenario.sessionStatus) state("recording_session.status", scenario.sessionStatus);
    if (scenario.uploadBatchStatus) state("upload_batch.status", scenario.uploadBatchStatus);
    if (scenario.transferStatus) state("upload_intent.transfer_status", scenario.transferStatus);
    if (scenario.metadataStatus) state("upload_intent.metadata_status", scenario.metadataStatus);
    for (const status of scenario.uploadAttemptStatuses ?? []) state("upload_attempt.status", status);
    if (scenario.videoAssetStatus) state("video_asset.status", scenario.videoAssetStatus);
    if (scenario.metadataAttemptStatus) state("metadata_attempt.status", scenario.metadataAttemptStatus);
    if (scenario.reviewStatus) state("review_case.status", scenario.reviewStatus);
  }
  const identifiers = [
    catalog.admin.profileId,
    ...catalog.people.flatMap((person) => [
      person.id,
      person.publicId,
      person.profileId,
      stableDemoUuid("consent-record", person.key),
      person.status === "invited" ? stableDemoUuid("participant-invitation", person.key) : null,
    ]),
    ...catalog.devices.flatMap((device) => [device.id, device.publicId, device.assignmentId]),
    ...catalog.tasks.flatMap((task) => [task.id, task.publicId, task.versionId]),
    stableDemoUuid("task-participant-plan", "draft-us-books"),
    ...catalog.scenarios.flatMap((scenario) => [
      scenario.assignmentId,
      scenario.assignmentPublicId,
      stableDemoUuid("task-participant-plan", scenario.key),
      scenario.sessionId,
      scenario.sessionPublicId,
      scenario.uploadBatchId,
      scenario.uploadBatchPublicId,
      scenario.uploadIntentId,
      scenario.uploadPublicId,
      ...scenario.uploadAttemptIds,
      ...scenario.uploadAttemptPublicIds,
      scenario.videoAssetId,
      scenario.videoAssetPublicId,
      scenario.storedObjectId,
      scenario.assetFileId,
      scenario.fileMetadataId,
      scenario.metadataAttemptId,
      scenario.metadataEvidenceId,
      scenario.matchDecisionId,
      scenario.reviewId,
      scenario.reviewPublicId,
      scenario.auditEventId,
      scenario.auditRequestId,
    ]),
  ].filter((identifier): identifier is string => identifier !== null);
  if (new Set(identifiers).size !== identifiers.length) throw new Error("Demo catalog identifiers must be unique");
}

export const DEMO_CATALOG = buildDemoCatalog();
