// stateMachine.js
// Centralises game state transitions. Each state has optional onEnter/onExit
// hooks. All transitions go through transition() — no direct field writes.
//
// Timers registered via setTimer() are automatically cancelled on any
// transition out, preventing stale callbacks from firing into the wrong state.
//
// States: 'ready' | 'playing' | 'paused' | 'dying' | 'over' | 'win'

export class StateMachine {
  /**
   * @param states  — map of name → { onEnter?, onExit? }
   * @param initial — starting state; onEnter fires immediately
   */
  constructor(states, initial) {
    this.#states = states;
    this.#current = initial;
    this.#states[initial]?.onEnter?.(this);
  }

  #states;
  #current;
  #timers = new Set();

  get current() { return this.#current; }

  /** Transition to a new state. No-op if already in that state. */
  transition(next) {
    if (next === this.#current) return;
    if (!this.#states[next]) throw new Error(`StateMachine: unknown state "${next}"`);

    this.#states[this.#current]?.onExit?.(this);
    this.#clearTimers();
    this.#current = next;
    this.#states[next]?.onEnter?.(this);
  }

  /**
   * Register a state-owned timer. The callback is cancelled automatically
   * if the state changes before the delay elapses.
   */
  setTimer(callback, delayMs) {
    const stateAtSchedule = this.#current;
    const id = setTimeout(() => {
      this.#timers.delete(id);
      if (this.#current === stateAtSchedule) callback();
    }, delayMs);
    this.#timers.add(id);
    return id;
  }

  #clearTimers() {
    for (const id of this.#timers) clearTimeout(id);
    this.#timers.clear();
  }
}
