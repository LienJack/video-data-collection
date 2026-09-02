export const assignmentStatuses = [
  "assigned",
  "acknowledged",
  "session_created",
  "uploading",
  "submitted",
  "needs_review",
  "rework_required",
  "accepted",
  "expired",
  "missing_upload",
  "canceled",
] as const;

export type AssignmentStatus = (typeof assignmentStatuses)[number];

export function canAcknowledgeAssignment(status: AssignmentStatus) {
  return status === "assigned";
}

export function canCancelAssignment(status: AssignmentStatus) {
  return !["accepted", "canceled"].includes(status);
}

export function statusAfterExtension(
  status: AssignmentStatus,
  acknowledgedAt: Date | null,
): AssignmentStatus {
  if (!["expired", "missing_upload"].includes(status)) return status;
  return acknowledgedAt ? "acknowledged" : "assigned";
}
