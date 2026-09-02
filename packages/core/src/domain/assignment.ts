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
import { assignmentMachine } from "./lifecycle-machines";
import { canTransitionLifecycle, transitionLifecycle } from "./state-machine";

export function canAcknowledgeAssignment(status: AssignmentStatus) {
  return canTransitionLifecycle(assignmentMachine, status, "acknowledge");
}

export function canCancelAssignment(status: AssignmentStatus) {
  return canTransitionLifecycle(assignmentMachine, status, "cancel");
}

export function statusAfterExtension(
  status: AssignmentStatus,
  acknowledgedAt: Date | null,
): AssignmentStatus {
  if (!["expired", "missing_upload"].includes(status)) return status;
  return transitionLifecycle(
    assignmentMachine,
    status,
    acknowledgedAt ? "extendAcknowledged" : "extendUnacknowledged",
  );
}
