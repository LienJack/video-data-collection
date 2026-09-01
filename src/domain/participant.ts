export const participantStatuses = [
  "draft",
  "invited",
  "expired",
  "active",
  "suspended",
  "withdrawn",
] as const;

export type ParticipantStatus = (typeof participantStatuses)[number];

const transitions: Record<ParticipantStatus, readonly ParticipantStatus[]> = {
  draft: ["invited", "withdrawn"],
  invited: ["active", "expired", "withdrawn"],
  expired: ["invited", "withdrawn"],
  active: ["suspended", "withdrawn"],
  suspended: ["active", "withdrawn"],
  withdrawn: [],
};

export function canTransitionParticipant(from: ParticipantStatus, to: ParticipantStatus) {
  return transitions[from].includes(to);
}

export function assertParticipantTransition(from: ParticipantStatus, to: ParticipantStatus) {
  if (!canTransitionParticipant(from, to)) {
    throw new Error(`INVALID_PARTICIPANT_TRANSITION:${from}->${to}`);
  }
}

export function canStartParticipantActivity(status: ParticipantStatus, consentStatus: string) {
  return status === "active" && consentStatus === "valid";
}
