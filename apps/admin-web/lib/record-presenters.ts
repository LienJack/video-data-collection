export type RecordHealthTone = "ready" | "progress" | "attention";

const transferLabels: Record<string, string> = {
  created: "等待上传",
  uploading: "上传中",
  reconciling: "正在核对",
  verified: "上传已验证",
  failed: "上传失败",
  aborted: "上传已中止",
  expired: "上传已过期",
};

const metadataLabels: Record<string, string> = {
  pending: "等待解析",
  processing: "解析中",
  extracted: "解析完成",
  partial: "部分解析",
  unsupported: "格式不支持",
  failed: "解析失败",
};

const matchLabels: Record<string, string> = {
  participant_claim: "参与者声明",
  admin_confirmed: "管理员已确认",
  admin_corrected: "管理员已纠正",
  unmatched: "尚未匹配",
  rejected: "匹配已拒绝",
};

const sessionLabels: Record<string, string> = {
  open: "未关闭",
  closed: "已关闭",
};

const actionLabels: Record<string, string> = {
  "assignment.acknowledged": "确认采集任务",
  "assignment.canceled": "取消人员分配",
  "assignment.created": "创建人员分配",
  "assignment.extended": "延长截止时间",
  "assignment.replaced": "替换参与者",
  "demo.baseline_repaired": "修复演示基线",
  "demo.retention_deleted": "清理演示留存数据",
  "device.updated": "更新采集设备",
  "metadata.extracted": "完成元数据解析",
  "metadata.extraction_failed": "元数据解析失败",
  "participant.created": "创建参与者",
  "participant.device_created": "登记参与者设备",
  "participant.invitation_accepted": "接受参与邀请",
  "participant.invitation_expired": "参与邀请过期",
  "participant.invitation_generated": "生成参与邀请",
  "participant.invitation_revoked": "撤销参与邀请",
  "participant.updated": "更新参与者",
  "participant.suspended": "暂停参与者",
  "participant.withdrawn": "参与者退出",
  "session.closed": "关闭录制会话",
  "session.created": "创建录制会话",
  "session.marker_acknowledged": "确认录制标记",
  "session.marker_regenerated": "重新生成录制标记",
  "task.created": "创建任务",
  "task.draft_updated": "更新任务草稿",
  "task.participant_planned": "加入草稿发布名单",
  "task.participant_unplanned": "移出草稿发布名单",
  "task.participants_added": "批量添加参与者",
  "task.published": "发布任务版本",
  "upload.aborted": "中止视频上传",
  "upload.expired": "视频上传过期",
  "upload.reconciliation_failed": "视频上传核对失败",
  "upload.verified": "视频上传验证完成",
  "upload_attempt.created": "创建上传尝试",
  "upload_batch.created": "创建上传批次",
  "upload_intent.created": "创建视频上传",
  "review_case.confirm_match": "确认视频匹配",
  "review_case.correct_match": "纠正视频匹配",
  "review_case.reject_upload": "拒绝视频上传",
  "review_case.request_rerecord": "要求重新录制",
  "review_case.extend_assignment": "延长采集截止时间",
  "review_case.suspend_participant": "暂停参与者",
  "review_case.resolve_case": "完成视频复核",
  "review_case.dismiss_case": "忽略复核事项",
};

const entityLabels: Record<string, string> = {
  assignment: "人员分配",
  device: "采集设备",
  metadata: "视频元数据",
  participant: "参与者",
  recording_session: "录制会话",
  review_case: "复核事项",
  task: "采集任务",
  upload_attempt: "上传尝试",
  upload_batch: "上传批次",
  upload_intent: "视频上传",
  video_asset: "视频资产",
};

const fieldLabels: Record<string, string> = {
  participantPublicId: "参与者",
  replacementParticipantPublicId: "替代参与者",
  taskPublicId: "采集任务",
  taskVersion: "任务版本",
  dueAt: "截止时间",
  status: "状态",
  preferredDevicePublicId: "首选设备",
  sessionPublicId: "录制会话",
  devicePublicId: "设备",
};

const unhealthyTransfers = new Set(["failed", "aborted", "expired"]);
const unhealthyMetadata = new Set(["partial", "unsupported", "failed"]);

export function transferStatusLabel(status: string | null | undefined) {
  return status ? transferLabels[status] ?? status : "等待上传状态";
}

export function metadataStatusLabel(status: string | null | undefined) {
  return status ? metadataLabels[status] ?? status : "等待解析状态";
}

export function matchDecisionLabel(status: string | null | undefined) {
  return status ? matchLabels[status] ?? status : "等待匹配";
}

export function sessionStatusLabel(status: string | null | undefined) {
  return status ? sessionLabels[status] ?? status : "状态待确定";
}

export function resolvedSessionForDisplay(decisionType: string | null | undefined, resolvedSessionPublicId: string | null | undefined) {
  return decisionType === "rejected" ? null : resolvedSessionPublicId ?? null;
}

export function auditActionLabel(action: string) {
  return actionLabels[action] ?? action;
}

export function auditEntityLabel(entityType: string) {
  return entityLabels[entityType] ?? entityType;
}

export function isUnhealthyTransferStatus(status: string) {
  return unhealthyTransfers.has(status);
}

export function isUnhealthyMetadataStatus(status: string) {
  return unhealthyMetadata.has(status);
}

export function recordHealth(input: {
  transferStatus: string;
  metadataStatus: string;
  decisionType?: string | null;
  reviewCount: number;
}) {
  if (isUnhealthyTransferStatus(input.transferStatus) || isUnhealthyMetadataStatus(input.metadataStatus) || input.reviewCount > 0 || input.decisionType === "unmatched" || input.decisionType === "rejected") {
    return { label: "需要处理", tone: "attention" as const };
  }
  if (input.transferStatus === "verified" && input.metadataStatus === "extracted" && input.decisionType) {
    return { label: "已就绪", tone: "ready" as const };
  }
  return { label: "处理中", tone: "progress" as const };
}

export function changedAuditFields(beforeValues: Record<string, unknown> | null, afterValues: Record<string, unknown> | null) {
  const keys = new Set([...Object.keys(beforeValues ?? {}), ...Object.keys(afterValues ?? {})]);
  return [...keys]
    .filter((key) => JSON.stringify(beforeValues?.[key]) !== JSON.stringify(afterValues?.[key]))
    .map((key) => fieldLabels[key] ?? key);
}

export function formatRecordDate(value: string | Date) {
  return new Date(value).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" });
}

export function formatRecordBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

export function formatRecordDuration(durationMs: number | null) {
  if (durationMs === null) return "时长待解析";
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
