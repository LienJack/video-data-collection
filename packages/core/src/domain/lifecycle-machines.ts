import { defineLifecycleMachine, lifecycleEdges } from "./state-machine";

export const participantMachine = defineLifecycleMachine({
  id: "participant.status",
  initial: "draft",
  states: ["draft", "invited", "expired", "active", "suspended", "withdrawn"],
  terminal: ["withdrawn"],
  transitions: {
    invite: { draft: "invited", expired: "invited" },
    expireInvitation: { invited: "expired" },
    acceptInvitation: { invited: "active" },
    suspend: { active: "suspended" },
    resume: { suspended: "active" },
    withdraw: {
      draft: "withdrawn", invited: "withdrawn", expired: "withdrawn",
      active: "withdrawn", suspended: "withdrawn",
    },
  },
} as const);

export const consentProjectionMachine = defineLifecycleMachine({
  id: "participant.consent_status",
  initial: "pending",
  states: ["pending", "valid", "expired", "withdrawn"],
  terminal: ["withdrawn"],
  transitions: {
    accept: { pending: "valid", expired: "valid" },
    expire: { valid: "expired" },
    withdraw: { pending: "withdrawn", valid: "withdrawn", expired: "withdrawn" },
  },
} as const);

export const invitationMachine = defineLifecycleMachine({
  id: "participant_invitation.status",
  initial: "generated",
  states: ["generated", "opened", "accepted", "revoked", "expired"],
  terminal: ["accepted", "revoked", "expired"],
  transitions: {
    open: { generated: "opened" },
    accept: { generated: "accepted", opened: "accepted" },
    revoke: { generated: "revoked", opened: "revoked" },
    expire: { generated: "expired", opened: "expired" },
  },
} as const);

export const consentRecordMachine = defineLifecycleMachine({
  id: "consent_record.status",
  initial: "accepted",
  states: ["accepted", "withdrawn", "expired"],
  terminal: ["accepted", "withdrawn", "expired"],
  transitions: {},
} as const);

export const deviceMachine = defineLifecycleMachine({
  id: "device.status",
  initial: "active",
  states: ["active", "lost", "retired", "shared"],
  terminal: ["retired"],
  transitions: {
    markLost: { active: "lost", shared: "lost" },
    share: { active: "shared", lost: "shared" },
    activate: { lost: "active", shared: "active" },
    retire: { active: "retired", lost: "retired", shared: "retired" },
  },
} as const);

export const taskMachine = defineLifecycleMachine({
  id: "task.lifecycle",
  initial: "draft",
  states: ["draft", "active", "archived"],
  terminal: ["archived"],
  transitions: { publish: { draft: "active" }, archive: { draft: "archived", active: "archived" } },
} as const);

export const assignmentMachine = defineLifecycleMachine({
  id: "assignment.status",
  initial: "assigned",
  states: ["assigned", "acknowledged", "session_created", "uploading", "submitted", "needs_review", "rework_required", "accepted", "expired", "missing_upload", "canceled"],
  terminal: ["accepted", "canceled"],
  transitions: {
    acknowledge: { assigned: "acknowledged" },
    createSession: { assigned: "session_created", acknowledged: "session_created", rework_required: "session_created" },
    startUpload: { acknowledged: "uploading", session_created: "uploading", rework_required: "uploading" },
    submit: { uploading: "submitted", session_created: "submitted" },
    requireReview: { submitted: "needs_review", uploading: "needs_review" },
    requestRework: { submitted: "rework_required", needs_review: "rework_required" },
    accept: {
      assigned: "accepted", acknowledged: "accepted", session_created: "accepted", uploading: "accepted",
      submitted: "accepted", needs_review: "accepted", rework_required: "accepted",
      expired: "accepted", missing_upload: "accepted",
    },
    expire: { assigned: "expired", acknowledged: "expired", session_created: "expired", rework_required: "expired" },
    markMissing: { assigned: "missing_upload", acknowledged: "missing_upload", session_created: "missing_upload", uploading: "missing_upload" },
    extendUnacknowledged: { expired: "assigned", missing_upload: "assigned" },
    extendAcknowledged: { expired: "acknowledged", missing_upload: "acknowledged" },
    cancel: {
      assigned: "canceled", acknowledged: "canceled", session_created: "canceled", uploading: "canceled",
      submitted: "canceled", needs_review: "canceled", rework_required: "canceled", expired: "canceled", missing_upload: "canceled",
    },
  },
} as const);

export const recordingSessionMachine = defineLifecycleMachine({
  id: "recording_session.status",
  initial: "open",
  states: ["open", "closed"],
  terminal: ["closed"],
  transitions: { close: { open: "closed" } },
} as const);

export const uploadBatchMachine = defineLifecycleMachine({
  id: "upload_batch.status",
  initial: "open",
  states: ["open", "completed", "aborted", "expired"],
  terminal: ["completed", "aborted", "expired"],
  transitions: { complete: { open: "completed" }, abort: { open: "aborted" }, expire: { open: "expired" } },
} as const);

export const uploadTransferMachine = defineLifecycleMachine({
  id: "upload_intent.transfer_status",
  initial: "created",
  states: ["created", "uploading", "reconciling", "verified", "failed", "aborted", "expired"],
  terminal: ["verified", "aborted", "expired"],
  transitions: {
    start: { created: "uploading", failed: "uploading" },
    reconcile: { uploading: "reconciling" },
    verify: { reconciling: "verified" },
    fail: { created: "failed", uploading: "failed", reconciling: "failed" },
    abort: { created: "aborted", uploading: "aborted", reconciling: "aborted", failed: "aborted" },
    expire: { created: "expired", uploading: "expired", failed: "expired" },
  },
} as const);

export const uploadMetadataMachine = defineLifecycleMachine({
  id: "upload_intent.metadata_status",
  initial: "pending",
  states: ["pending", "processing", "extracted", "partial", "unsupported", "failed"],
  terminal: ["extracted", "partial", "unsupported"],
  transitions: {
    start: { pending: "processing", failed: "processing" },
    extract: { processing: "extracted" }, partial: { processing: "partial" },
    markUnsupported: { processing: "unsupported" }, fail: { processing: "failed" }, retry: { failed: "pending", processing: "pending" },
  },
} as const);

export const uploadAttemptMachine = defineLifecycleMachine({
  id: "upload_attempt.status",
  initial: "created",
  states: ["created", "uploading", "paused", "completed", "failed", "aborted", "expired"],
  terminal: ["completed", "aborted", "expired"],
  transitions: {
    start: { created: "uploading", paused: "uploading" }, pause: { uploading: "paused" },
    complete: { uploading: "completed", paused: "completed" }, fail: { created: "failed", uploading: "failed", paused: "failed" },
    abort: { created: "aborted", uploading: "aborted", paused: "aborted", failed: "aborted" },
    expire: { created: "expired", uploading: "expired", paused: "expired", failed: "expired" },
  },
} as const);

export const videoAssetMachine = defineLifecycleMachine({
  id: "video_asset.status",
  initial: "active",
  states: ["active", "rejected", "deleted"], terminal: ["deleted"],
  transitions: { reject: { active: "rejected" }, delete: { active: "deleted", rejected: "deleted" } },
} as const);

export const metadataAttemptMachine = defineLifecycleMachine({
  id: "metadata_attempt.status",
  initial: "processing",
  states: ["processing", "extracted", "partial", "unsupported", "failed"],
  terminal: ["extracted", "partial", "unsupported", "failed"],
  transitions: {
    extract: { processing: "extracted" }, partial: { processing: "partial" },
    markUnsupported: { processing: "unsupported" }, fail: { processing: "failed" },
  },
} as const);

export const reviewCaseMachine = defineLifecycleMachine({
  id: "review_case.status",
  initial: "open",
  states: ["open", "in_review", "resolved", "dismissed"], terminal: ["resolved", "dismissed"],
  transitions: {
    beginReview: { open: "in_review" },
    resolve: { open: "resolved", in_review: "resolved" },
    dismiss: { open: "dismissed", in_review: "dismissed" },
  },
} as const);

export const lifecycleMachines = {
  [participantMachine.definition.id]: participantMachine,
  [consentProjectionMachine.definition.id]: consentProjectionMachine,
  [invitationMachine.definition.id]: invitationMachine,
  [consentRecordMachine.definition.id]: consentRecordMachine,
  [deviceMachine.definition.id]: deviceMachine,
  [taskMachine.definition.id]: taskMachine,
  [assignmentMachine.definition.id]: assignmentMachine,
  [recordingSessionMachine.definition.id]: recordingSessionMachine,
  [uploadBatchMachine.definition.id]: uploadBatchMachine,
  [uploadTransferMachine.definition.id]: uploadTransferMachine,
  [uploadMetadataMachine.definition.id]: uploadMetadataMachine,
  [uploadAttemptMachine.definition.id]: uploadAttemptMachine,
  [videoAssetMachine.definition.id]: videoAssetMachine,
  [metadataAttemptMachine.definition.id]: metadataAttemptMachine,
  [reviewCaseMachine.definition.id]: reviewCaseMachine,
} as const;

export const allLifecycleEdges = Object.values(lifecycleMachines).flatMap(lifecycleEdges);

export const lifecycleStateMetadata = Object.fromEntries(
  Object.values(lifecycleMachines).map((machine) => [machine.definition.id, {
    states: machine.definition.states,
    terminal: machine.definition.terminal,
  }]),
);
