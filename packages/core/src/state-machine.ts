/** Map of state -> event -> next state. Events not listed for a state are rejected. */
export type Transitions<S extends string, E extends string> = Record<S, Partial<Record<E, S>>>;

type Listener<S extends string, E extends string> = (to: S, from: S, event: E) => void;

export class StateMachine<S extends string, E extends string> {
  private current: S;
  private listeners = new Set<Listener<S, E>>();

  constructor(
    initial: S,
    private readonly transitions: Transitions<S, E>,
  ) {
    this.current = initial;
  }

  get state(): S {
    return this.current;
  }

  can(event: E): boolean {
    return this.transitions[this.current][event] !== undefined;
  }

  /** Applies the event. Returns false (and stays put) if it isn't valid in the current state. */
  send(event: E): boolean {
    const next = this.transitions[this.current][event];
    if (next === undefined) return false;
    const from = this.current;
    this.current = next;
    for (const listener of this.listeners) listener(next, from, event);
    return true;
  }

  onChange(listener: Listener<S, E>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
