// scheduler.js
// Owns everything time-based that isn't a single entity's concern:
//
//   1. Scatter/chase cycle  — global mode affecting all alive ghosts
//   2. Frightened countdown — started by pellet, ends with un-frighten
//   3. Ghost house exits    — staggered release of Pinky, Inky, Clyde
//   4. Eaten-ghost returns  — moves eyes back to spawn, revives on arrival

import { FRIGHT_FRAMES } from './constants.js';

const SCATTER_FRAMES = 300;
const CHASE_FRAMES   = 600;
const EATEN_RETURN_SPEED = 0.25;
const ARRIVAL_DIST = 0.2;

export class Scheduler {
  /**
   * @param ghosts     — ghost entities
   * @param spawnPoint — { x, y } ghost house centre for this level
   * @param exitDelays — array of frame delays per ghost index before leaving house
   */
  constructor(ghosts, spawnPoint, exitDelays = [0, 120, 240, 360]) {
    this.#ghosts     = ghosts;
    this.#spawn      = spawnPoint;
    this.#mode       = 'scatter';
    this.#modeTimer  = 0;
    this.#frightTimer = 0;

    // Build house timers keyed by ghost name in order
    this.#houseTimers = {};
    ghosts.forEach((g, i) => {
      this.#houseTimers[g.name] = exitDelays[i] ?? 0;
    });
  }

  #ghosts; #spawn;
  #mode; #modeTimer; #frightTimer; #houseTimers;

  get mode()         { return this.#mode; }
  get frightTimer()  { return this.#frightTimer; }
  get isFrightened() { return this.#frightTimer > 0; }

  onPelletEaten(frightFrames = FRIGHT_FRAMES) {
    this.#frightTimer = frightFrames;
    for (const g of this.#ghosts) {
      if (g.lifeState === 'alive') {
        g.frighten();
        g.dir = [-g.dir[0], -g.dir[1]];
      }
    }
  }

  onPlayerDeath() {
    this.#frightTimer = 0;
    for (const g of this.#ghosts) g.unfrighten();
    // Reset house timers
    this.#ghosts.forEach((g, i) => {
      this.#houseTimers[g.name] = 0; // re-release immediately after death
    });
  }

  tick() {
    this.#advanceScatterChase();
    this.#advanceFrightened();
    this.#advanceHouseExits();
    this.#advanceEatenReturns();
  }

  canGhostMove(ghost) {
    const t = this.#houseTimers[ghost.name];
    return t === undefined || t <= 0;
  }

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
        g.x = this.#spawn.x;
        g.y = this.#spawn.y;
        g.dir = [-1, 0];
        g.lastDecisionTile = null;
      }
    }
  }

  #advanceEatenReturns() {
    for (const g of this.#ghosts) {
      if (g.lifeState !== 'eaten') continue;
      const dx   = this.#spawn.x - g.x;
      const dy   = this.#spawn.y - g.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ARRIVAL_DIST) {
        g.x = this.#spawn.x;
        g.y = this.#spawn.y;
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
