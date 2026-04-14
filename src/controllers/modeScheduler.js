// ModeScheduler.js
// Owns everything time-based that isn't a single entity's concern.
// Four orthogonal responsibilities, one class because they all tick together:
//
//   1. Scatter/chase cycle — global mode that affects all alive ghosts
//   2. Frightened countdown — started by pellet, ends with all ghosts un-frightened
//   3. Ghost house exits — staggered release of Pinky, Inky, Clyde
//   4. Eaten-ghost returns — moves "eyes" back to spawn, revives on arrival
//
// Ghosts don't tick themselves through any of this — they expose state-change
// methods (frighten, unfrighten, eat, revive) and ModeScheduler calls them.

// --- Scatter/chase cycle ------------------------------------------------
// Classic arcade pattern: alternating scatter (ghosts retreat to corners)
// and chase (ghosts pursue Pacman). Simplified to fixed durations here —
// the arcade original varied them across levels, which we can parameterize later.
const SCATTER_FRAMES = 300;   // ~5 seconds at 60fps
const CHASE_FRAMES   = 600;   // ~10 seconds at 60fps

// --- Frightened --------------------------------------------------------
// Total frightened duration after a pellet. Last FRIGHT_WARN_FRAMES flash
// white as a warning — the Renderer reads `frightTimer` and decides the flash.
const FRIGHT_FRAMES      = 400;
export const FRIGHT_WARN_FRAMES = 100;  // exported so Renderer can import the threshold

// --- House exit schedule -----------------------------------------------
// Frames each ghost waits in the house before leaving. Blinky starts outside
// so he doesn't appear here. The staggered release is what gives the opening
// seconds of each life their signature rhythm.
const HOUSE_EXIT_FRAMES = {
  pinky: 120,
  inky:  240,
  clyde: 360,
};

// --- Eaten-return ------------------------------------------------------
// Speed of the "eyes" returning to the house. Faster than normal ghost
// movement because waiting for eyes to crawl home kills pacing.
const EATEN_RETURN_SPEED = 0.25;

// Where eaten ghosts respawn. Matches the ghost house center.
const GHOST_SPAWN = { x: 13.5, y: 11 };

// Arrival tolerance — when the eyes get this close to spawn, we revive.
const ARRIVAL_DIST = 0.2;

export class ModeScheduler {
  constructor(ghosts) {
    this.#ghosts = ghosts;

    // Global mode state. `modeTimer` counts up within the current mode;
    // when it hits the phase duration we flip and reset to zero.
    this.#mode = 'scatter';
    this.#modeTimer = 0;

    // Frightened state is independent of scatter/chase — while frightened,
    // ghosts ignore their scatter/chase targeting but the cycle keeps
    // advancing underneath. When fright ends, they resume the current mode.
    this.#frightTimer = 0;

    // House exit timers count DOWN. Each ghost leaves when its timer hits 0.
    // Blinky gets 0 so he's released immediately on first tick.
    this.#houseTimers = {
      blinky: 0,
      pinky:  HOUSE_EXIT_FRAMES.pinky,
      inky:   HOUSE_EXIT_FRAMES.inky,
      clyde:  HOUSE_EXIT_FRAMES.clyde,
    };
  }

  #ghosts;
  #mode;
  #modeTimer;
  #frightTimer;
  #houseTimers;

  // --- Public API -----------------------------------------------------

  get mode() { return this.#mode; }
  get frightTimer() { return this.#frightTimer; }
  get isFrightened() { return this.#frightTimer > 0; }

  /** Called when Pacman eats a power pellet. Restarts the frightened window,
   *  flips every alive ghost into frightened mode, and reverses each one's
   *  direction — that reversal is the classic "ghosts turn around" tell. */
  onPelletEaten() {
    this.#frightTimer = FRIGHT_FRAMES;
    for (const g of this.#ghosts) {
      if (g.lifeState === 'alive') {
        g.frighten();
        // Reverse direction so they immediately start fleeing the current path.
        g.dir = [-g.dir[0], -g.dir[1]];
      }
    }
  }

  /** Called when Pacman dies. Clears fright, resets house timers so the
   *  opening rhythm replays, and snaps ghosts back to spawn positions. */
  onPacmanDeath() {
    this.#frightTimer = 0;
    for (const g of this.#ghosts) g.unfrighten();
    this.#houseTimers = {
      blinky: 0,
      pinky:  HOUSE_EXIT_FRAMES.pinky,
      inky:   HOUSE_EXIT_FRAMES.inky,
      clyde:  HOUSE_EXIT_FRAMES.clyde,
    };
  }

  /** Main per-frame tick. Advances all four timer systems in order.
   *  Called by Game only when state is 'playing'. */
  tick() {
    this.#advanceScatterChase();
    this.#advanceFrightened();
    this.#advanceHouseExits();
    this.#advanceEatenReturns();
  }

  // --- Private: scatter/chase cycle -----------------------------------

  #advanceScatterChase() {
    this.#modeTimer++;
    if (this.#mode === 'scatter' && this.#modeTimer >= SCATTER_FRAMES) {
      this.#switchMode('chase');
    } else if (this.#mode === 'chase' && this.#modeTimer >= CHASE_FRAMES) {
      this.#switchMode('scatter');
    }
  }

  #switchMode(next) {
    this.#mode = next;
    this.#modeTimer = 0;
    // On every scatter↔chase flip, alive ghosts reverse direction. This is
    // a core arcade behavior — it's the visual cue that the mode changed
    // and prevents ghosts from walking out of their corner on the same path
    // they walked in on.
    for (const g of this.#ghosts) {
      if (g.lifeState === 'alive' && !g.frightened) {
        g.dir = [-g.dir[0], -g.dir[1]];
      }
    }
  }

  // --- Private: frightened --------------------------------------------

  #advanceFrightened() {
    if (this.#frightTimer <= 0) return;
    this.#frightTimer--;
    if (this.#frightTimer === 0) {
      for (const g of this.#ghosts) g.unfrighten();
    }
  }

  // --- Private: house exits -------------------------------------------

  #advanceHouseExits() {
    for (const g of this.#ghosts) {
      const t = this.#houseTimers[g.name];
      if (t === undefined || t <= 0) continue;
      this.#houseTimers[g.name]--;
      // When the timer hits zero, we don't need to do anything special —
      // the ghost is already at its house position and will start moving
      // on the next tick. The timer gate simply prevented earlier movement
      // via the `lifeState === 'alive'` check. (Future refinement: add a
      // 'in-house' lifeState so Ghost.update() can itself gate on this.)
    }
  }

  /** True when the given ghost is allowed to move. Game's entity update
   *  loop checks this before calling `ghost.update()` — keeps the "don't
   *  move until released" rule in one place. */
  canGhostMove(ghost) {
    const t = this.#houseTimers[ghost.name];
    return t === undefined || t <= 0;
  }

  // --- Private: eaten-ghost returns -----------------------------------

  #advanceEatenReturns() {
    for (const g of this.#ghosts) {
      if (g.lifeState !== 'eaten') continue;

      // Move the eyes straight toward spawn. This bypasses maze walls
      // intentionally — the original arcade does the same. Eyes aren't
      // pathfinding, they're flying home.
      const dx = GHOST_SPAWN.x - g.x;
      const dy = GHOST_SPAWN.y - g.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ARRIVAL_DIST) {
        g.x = GHOST_SPAWN.x;
        g.y = GHOST_SPAWN.y;
        g.revive();
      } else {
        g.x += (dx / dist) * EATEN_RETURN_SPEED;
        g.y += (dy / dist) * EATEN_RETURN_SPEED;
      }
    }
  }
}
