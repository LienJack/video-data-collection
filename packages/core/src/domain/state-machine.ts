import { setup, transition } from "xstate";

export type LifecycleDefinition<
  TState extends string = string,
  TEvent extends string = string,
> = {
  id: string;
  initial: TState;
  states: readonly TState[];
  terminal: readonly TState[];
  transitions: Readonly<Record<TEvent, Readonly<Partial<Record<TState, TState>>>>>;
};

export type LifecycleTransition = {
  machine: string;
  event: string;
  from: string;
  to: string;
};

export class InvalidStateTransitionError extends Error {
  readonly code = "INVALID_STATE_TRANSITION";

  constructor(
    readonly machine: string,
    readonly event: string,
    readonly from: string,
  ) {
    super(`${machine}:${event}:${from}`);
    this.name = "InvalidStateTransitionError";
  }
}

export type LifecycleMachine<
  TState extends string = string,
  TEvent extends string = string,
> = {
  definition: LifecycleDefinition<TState, TEvent>;
  xstate: { readonly id: string };
  nextState(from: TState, event: TEvent): TState;
};

export function defineLifecycleMachine<
  const TState extends string,
  const TEvent extends string,
>(definition: LifecycleDefinition<TState, TEvent>): LifecycleMachine<TState, TEvent> {
  const terminal = new Set<string>(definition.terminal);
  const states = Object.fromEntries(definition.states.map((state) => {
    const on = Object.fromEntries(
      Object.entries(definition.transitions)
        .flatMap(([event, targets]) => {
          const target = (targets as Record<string, string | undefined>)[state];
          return target ? [[event, { target }]] : [];
        }),
    );
    return [state, {
      ...(terminal.has(state) ? { type: "final" as const } : {}),
      ...(Object.keys(on).length > 0 ? { on } : {}),
    }];
  }));

  const xstate = setup({
    types: {} as { events: { type: TEvent } },
  }).createMachine({
    id: definition.id,
    initial: definition.initial,
    states: states as never,
  });

  return {
    definition,
    xstate,
    nextState(from, event) {
      const snapshot = xstate.resolveState({ value: from, context: {} });
      const [next] = transition(xstate, snapshot, { type: event });
      return next.value as TState;
    },
  };
}

export function transitionLifecycle<
  TState extends string,
  TEvent extends string,
>(machine: LifecycleMachine<TState, TEvent>, from: TState, event: TEvent): TState {
  const to = machine.nextState(from, event);
  if (to === from) {
    throw new InvalidStateTransitionError(machine.definition.id, event, from);
  }
  return to;
}

export function canTransitionLifecycle<
  TState extends string,
  TEvent extends string,
>(machine: LifecycleMachine<TState, TEvent>, from: TState, event: TEvent): boolean {
  try {
    transitionLifecycle(machine, from, event);
    return true;
  } catch (error) {
    if (error instanceof InvalidStateTransitionError) return false;
    throw error;
  }
}

export function lifecycleEdges(machine: LifecycleMachine): LifecycleTransition[] {
  return Object.entries(machine.definition.transitions).flatMap(([event, targets]) =>
    Object.entries(targets).map(([from, to]) => ({
      machine: machine.definition.id,
      event,
      from,
      to: to as string,
    })),
  );
}

export function lifecycleCapabilities<
  TState extends string,
  TEvent extends string,
>(machine: LifecycleMachine<TState, TEvent>, from: TState): TEvent[] {
  return Object.keys(machine.definition.transitions)
    .filter((event) => canTransitionLifecycle(machine, from, event as TEvent)) as TEvent[];
}
