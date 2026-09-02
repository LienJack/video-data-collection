export const participantStatuses = [
  "draft",
  "invited",
  "expired",
  "active",
  "suspended",
  "withdrawn",
] as const;

export type ParticipantStatus = (typeof participantStatuses)[number];
import { participantMachine } from "./lifecycle-machines";
import { canTransitionLifecycle, transitionLifecycle } from "./state-machine";

const eventForTarget = {
  invited: "invite",
  active: null,
  expired: "expireInvitation",
  suspended: "suspend",
  withdrawn: "withdraw",
  draft: null,
} as const;

export function canTransitionParticipant(from: ParticipantStatus, to: ParticipantStatus) {
  const event = to === "active"
    ? (from === "invited" ? "acceptInvitation" : from === "suspended" ? "resume" : null)
    : eventForTarget[to];
  return event ? canTransitionLifecycle(participantMachine, from, event) : false;
}

export function assertParticipantTransition(from: ParticipantStatus, to: ParticipantStatus) {
  if (!canTransitionParticipant(from, to)) {
    throw new Error(`INVALID_PARTICIPANT_TRANSITION:${from}->${to}`);
  }
}

export function transitionParticipant(
  from: ParticipantStatus,
  event: "invite" | "expireInvitation" | "acceptInvitation" | "suspend" | "resume" | "withdraw",
) {
  return transitionLifecycle(participantMachine, from, event);
}

export function canStartParticipantActivity(status: ParticipantStatus, consentStatus: string) {
  return status === "active" && consentStatus === "valid";
}
