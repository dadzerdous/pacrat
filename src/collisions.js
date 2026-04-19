// collisions.js
// Resolves interactions between the player and the rest of the world each frame.
//
//   - Player vs. dots/pellets: reads player tile, asks maze to eat
//   - Player vs. ghosts: circle-distance check, decides outcome
//
// Owns the ghost-eat combo counter (200 → 400 → 800 → 1600).
// Uses callbacks so it stays decoupled from StateMachine, scheduler, and HUD.

import { POINTS } from './constants.js';

const COLLISION_RADIUS_SQ = 0.8 * 0.8;

export class Collisions {
  constructor({ onScore, onPelletEaten, onPlayerCaught, onGhostEaten }) {
    this.#onScore        = onScore;        // (points) => void
    this.#onPelletEaten  = onPelletEaten;  // () => void — triggers frighten
    this.#onPlayerCaught = onPlayerCaught; // () => void — life lost
    this.#onGhostEaten   = onGhostEaten;   // (ghost, points) => void
  }

  #onScore;
  #onPelletEaten;
  #onPlayerCaught;
  #onGhostEaten;
  #eatCombo = 0;

  /** Reset combo — call when a new pellet window starts. */
  resetCombo() { this.#eatCombo = 0; }

  /** Player vs. dots/pellets. Runs even while the player is dying. */
  resolveDots(player, maze) {
    if (player.dead) return;
    const [col, row] = player.tile();
    const eaten = maze.eatDotAt(col, row);
    if (eaten === 'dot') {
      this.#onScore(POINTS.DOT);
    } else if (eaten === 'pellet') {
      this.#onScore(POINTS.PELLET);
      this.resetCombo();
      this.#onPelletEaten();
    }
  }

  /** Player vs. ghosts. Three outcomes per ghost per frame:
   *   1. Too far — nothing
   *   2. Ghost frightened and alive — player eats ghost, score rises
   *   3. Ghost alive and not frightened — player dies (once per frame) */
  resolveGhosts(player, ghosts) {
    if (player.dead) return;

    for (const ghost of ghosts) {
      if (ghost.lifeState === 'eaten') continue; // just eyes, ignore

      const dx = ghost.x - player.x;
      const dy = ghost.y - player.y;
      if (dx * dx + dy * dy >= COLLISION_RADIUS_SQ) continue;

      if (ghost.frightened) {
        const pts = POINTS.GHOST[Math.min(this.#eatCombo, POINTS.GHOST.length - 1)];
        this.#eatCombo++;
        ghost.eat();
        this.#onScore(pts);
        this.#onGhostEaten(ghost, pts);
      } else {
        this.#onPlayerCaught();
        return; // only one death per frame
      }
    }
  }
}
