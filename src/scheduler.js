// scheduler.js
// Owns everything time-based that isn't a single entity's concern:
//
//   1. Scatter/chase cycle  — global mode affecting all alive ghosts
//   2. Frightened countdown — started by pellet, ends with un-frighten
//   3. Ghost house exits    — staggered release of Pinky, Inky, Clyde
//   4. Eaten-ghost returns  — moves eyes back to spawn, revives on arrival

import { FRIGHT_FRAMES } from './constants.js';

const SCATTER_FRAMES = 300; // ~5 s at 60 fps
const CHASE_FRAMES   = 600; // ~10 s at 60 fps

const HOUSE_EXIT_FRAMES = {
  blinky: 0,
  pinky:  120,
  inky:   240,
  clyde:  360,
};

const EATEN_RETURN_SPEED = 0.25;
const GHOST_SPAWN  = { x: 13, y: 14 };
const ARRIVAL_DIST = 0.2;

export class Scheduler {
  constructor(ghosts) {
    this.#ghosts = ghosts;
    this.#mode = 'scatter';
    this.#modeTimer = 0;
    this.#frightTimer = 0;
    this.#houseTimers = { ...HOUSE_EXIT_FRAMES };
  }

  #ghosts;
  #mode;
  #modeTimer;
  #frightTimer;
  #houseTimers;

  get mode()        { return this.#mode; }
  get frightTimer() { return this.#frightTimer; }
  get isFrightened(){ return this.#frightTimer > 0; }

  /** Called when the player eats a power pellet.
   *  @param frightFrames — override duration from character stats
   */
  onPelletEaten(frightFrames = FRIGHT_FRAMES) {
    this.#frightTimer = frightFrames;
    for (const g of this.#ghosts) {
      if (g.lifeState === 'alive') {
        g.frighten();
        g.dir = [-g.dir[0], -g.dir[1]]; // immediately reverse
      }
    }
  }

  /** Called when the player dies — resets frightened and house timers. */
  onPlayerDeath() {
    this.#frightTimer = 0;
    for (const g of this.#ghosts) g.unfrighten();
    this.#houseTimers = { ...HOUSE_EXIT_FRAMES };
  }

  /** Main per-frame tick. Call only when state is 'playing'. */
  tick() {
    this.#advanceScatterChase();
    this.#advanceFrightened();
    this.#advanceHouseExits();
    this.#advanceEatenReturns();
  }

  /** True when the given ghost is allowed to move. */
  canGhostMove(ghost) {
    const t = this.#houseTimers[ghost.name];
    return t === undefined || t <= 0;
  }

  // ---- Private ----------------------------------------------------------

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
    for (const g of this.#ghosts) {
      if (g.lifeState === 'alive' && !g.frightened) {
        g.dir = [-g.dir[0], -g.dir[1]];
      }
    }
  }

  #advanceFrightened() {
    if (this.#frightTimer <= 0) return;
    this.#frightTimer--;
    if (this.#frightTimer === 0) {
      for (const g of this.#ghosts) g.unfrighten();
    }
  }

  #advanceHouseExits() {
    for (const g of this.#ghosts) {
      const t = this.#houseTimers[g.name];
      if (t === undefined || t <= 0) continue;
      this.#houseTimers[g.name]--;

      if (this.#houseTimers[g.name] === 0) {
        g.x = GHOST_SPAWN.x;
        g.y = GHOST_SPAWN.y;
        g.dir = [-1, 0];
        g.lastDecisionTile = null;
      }
    }
  }

  #advanceEatenReturns() {
    for (const g of this.#ghosts) {
      if (g.lifeState !== 'eaten') continue;

      const dx = GHOST_SPAWN.x - g.x;
      const dy = GHOST_SPAWN.y - g.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ARRIVAL_DIST) {
        g.x = GHOST_SPAWN.x;
        g.y = GHOST_SPAWN.y;
        g.dir = [-1, 0];
        g.lastDecisionTile = null;
        g.revive();
      } else {
        g.x += (dx / dist) * EATEN_RETURN_SPEED;
        g.y += (dy / dist) * EATEN_RETURN_SPEED;
      }
    }
  }
}
