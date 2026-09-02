import { describe, expect, it } from "vitest";
import {
  allLifecycleEdges,
  assignmentMachine,
  lifecycleMachines,
  participantMachine,
} from "@egocapture/core/domain/lifecycle-machines";
import {
  InvalidStateTransitionError,
  lifecycleCapabilities,
  lifecycleEdges,
  transitionLifecycle,
  type LifecycleMachine,
} from "@egocapture/core/domain/state-machine";

describe("lifecycle state machines", () => {
  it("declares every persistent lifecycle as an XState v5 machine", () => {
    expect(Object.keys(lifecycleMachines)).toHaveLength(15);
    for (const machine of Object.values(lifecycleMachines)) {
      expect(machine.xstate.id).toBe(machine.definition.id);
      expect(machine.definition.states).toContain(machine.definition.initial);
    }
  });

  it("transitions Participant through allowed events and rejects undeclared edges", () => {
    expect(transitionLifecycle(participantMachine, "draft", "invite")).toBe("invited");
    expect(transitionLifecycle(participantMachine, "invited", "acceptInvitation")).toBe("active");
    expect(() => transitionLifecycle(participantMachine, "draft", "resume"))
      .toThrow(InvalidStateTransitionError);
    expect(lifecycleCapabilities(participantMachine, "withdrawn")).toEqual([]);
  });

  it("preserves review correction acceptance for every non-terminal Assignment state", () => {
    for (const state of assignmentMachine.definition.states) {
      if (state === "accepted" || state === "canceled") continue;
      expect(transitionLifecycle(assignmentMachine, state, "accept")).toBe("accepted");
    }
  });

  it("exports one deterministic edge manifest for database parity", () => {
    expect(lifecycleEdges(participantMachine)).toContainEqual({
      machine: "participant.status",
      event: "suspend",
      from: "active",
      to: "suspended",
    });
    expect(new Set(allLifecycleEdges.map((edge) => `${edge.machine}:${edge.from}:${edge.to}`)).size)
      .toBe(allLifecycleEdges.length);
  });

  it("makes all declared terminal states unable to transition", () => {
    for (const machine of Object.values(lifecycleMachines)) {
      for (const terminal of machine.definition.terminal) {
        expect(lifecycleCapabilities(machine, terminal)).toEqual([]);
      }
    }
  });

  it("executes every declared edge and rejects every undeclared state/event pair", () => {
    for (const machine of Object.values(lifecycleMachines)) {
      const genericMachine = machine as LifecycleMachine<string, string>;
      const events = Object.keys(genericMachine.definition.transitions);
      for (const state of genericMachine.definition.states) {
        for (const event of events) {
          const expected = genericMachine.definition.transitions[event]?.[state];
          if (expected) {
            expect(genericMachine.nextState(state, event)).toBe(expected);
          } else {
            expect(() => transitionLifecycle(genericMachine, state, event)).toThrow(InvalidStateTransitionError);
          }
        }
      }
    }
  });
});
