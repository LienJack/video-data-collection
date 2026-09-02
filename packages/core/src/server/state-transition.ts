import "server-only";

import { DomainError } from "@egocapture/core/domain/errors";
import {
  InvalidStateTransitionError,
  transitionLifecycle,
  type LifecycleMachine,
} from "@egocapture/core/domain/state-machine";

export function resolveServiceTransition<TState extends string, TEvent extends string>(
  machine: LifecycleMachine<TState, TEvent>,
  from: TState,
  event: TEvent,
  errorCode: string,
): TState {
  try {
    return transitionLifecycle(machine, from, event);
  } catch (error) {
    if (error instanceof InvalidStateTransitionError) {
      throw new DomainError(errorCode, "当前状态不允许该操作", 409);
    }
    throw error;
  }
}

export function assertServiceTransitionSet<TState extends string, TEvent extends string>(
  machine: LifecycleMachine<TState, TEvent>,
  fromStates: readonly TState[],
  event: TEvent,
  errorCode: string,
) {
  for (const from of fromStates) resolveServiceTransition(machine, from, event, errorCode);
}
