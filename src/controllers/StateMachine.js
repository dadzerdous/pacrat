// StateMachine.js
// Centralizes game state transitions. Each state is an object with optional
// onEnter and onExit hooks. All transitions go through transition() — no
// direct field writes, no scattered `if (gameState === ...)` assignments.
//
// The original code's respawn bug (setTimeout firing after game-over and
// respawning into a dead game) is fixed structurally here: timers that
// belong to a state are registered via onEnter and cancelled in onExit,
// so they can't outlive their state.
//
// States used by Pac-Man:
//   'ready'    — before the first move; waiting for player to press space
//   'playing'  — normal gameplay; tick() advances entities
//   'dying'    — death animation running; respawn or game-over scheduled
//   'over'     — game over; waiting for space to restart
//   'win'      — all dots eaten; waiting for space to restart

export class StateMachine {
  /**
   * @param states  — map of name → { onEnter?, onExit? } (both optional)
   * @param initial — starting state name; onEnter fires immediately
   */
  constructor(states, initial) {
    this.#states = states;
    this.#current = initial;

    // Fire the initial onEnter so ready-state setup (e.g. showing the
    // "PRESS SPACE" message) happens without the caller having to remember.
    this.#states[initial]?.onEnter?.(this);
  }

  #states;
  #current;

  // Timers owned by the current state. Registered via setTimer() inside an
  // onEnter; cleared automatically on any transition out. This is the
  // mechanism that prevents stale timers from firing into the wrong state.
  #timers = new Set();

  get current() { return this.#current; }

  /**
   * Move to a new state. Fires the current state's onExit, then the new
   * state's onEnter. All registered timers are cleared between the two.
   *
   * Transitioning to the state you're already in is a no-op — prevents
   * accidental re-entry from firing onEnter twice.
   */
  transition(next) {
    if (next === this.#current) return;
    if (!this.#states[next]) {
      throw new Error(`StateMachine: unknown state "${next}"`);
    }

    this.#states[this.#current]?.onExit?.(this);
    this.#clearTimers();
    this.#current = next;
    this.#states[next]?.onEnter?.(this);
  }

  /**
   * Register a timer that belongs to the current state. The callback only
   * fires if we're still in the same state when the delay elapses — any
   * transition in between cancels it. Use this instead of raw setTimeout
   * for anything that schedules a state-sensitive action.
   *
   * Returns the underlying timer id for caller-initiated cancellation,
   * though usually you just let onExit clean it up.
   */
  setTimer(callback, delayMs) {
    const stateAtSchedule = this.#current;
    const id = setTimeout(() => {
      this.#timers.delete(id);
      // Extra guard: even if clearTimers missed it (shouldn't happen,
      // but defensive), refuse to fire if state has changed.
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
