// player.js
// The player entity. Reads a queued direction from input and commits to it
// whenever the turn is legal. Starts frozen (waiting = true) until the
// player gives their first directional input — no auto-movement.

import { Entity } from './entity.js';
import { DIR } from './constants.js';

export class Player extends Entity {
  constructor(character = { speed: 0.12, emoji: '🐀' }, spawn = null) {
    const x = spawn ? spawn.x : 5;
    const y = spawn ? spawn.y : 8;
    super({ x, y, speed: character.speed, dir: DIR.LEFT });

    this.emoji        = character.emoji;
    this.nextDir      = null;
    this.waiting      = true;
    this.mouthPhase   = 0.25;
    this.mouthOpening = true;
    this.dead         = false;
    this.deathTimer   = 0;
  }

  /** Queue a direction from input. Also un-freezes the player. */
  queueDirection(dir) {
    this.nextDir = dir;
    this.waiting = false;
  }

  update(maze) {
    if (this.dead) {
      this.deathTimer++;
      return;
    }

    // Stay frozen until the player has given at least one direction.
    if (this.waiting) {
      this.#animateMouth();
      return;
    }

    // Try to commit to the buffered direction. Legal only when the tile
    // one step away is passable (integer-tile check avoids corner clipping).
    const cx = Math.round(this.x);
    const cy = Math.round(this.y);
    const targetCol = cx + this.nextDir[0];
    const targetRow = cy + this.nextDir[1];
    if (maze.isPassableTile(targetCol, targetRow)) {
      this.dir = this.nextDir;
      // Snap the perpendicular axis to align with the new lane.
      if (this.nextDir[1] !== 0) this.x = cx;
      if (this.nextDir[0] !== 0) this.y = cy;
    }

    this.tryMove(this.dir, maze); // no-ops silently if pressed against a wall
    this.#animateMouth();
  }

  #animateMouth() {
    this.mouthPhase += 0.07 * (this.mouthOpening ? 1 : -1);
    if (this.mouthPhase > 0.35) this.mouthOpening = false;
    if (this.mouthPhase < 0.02) this.mouthOpening = true;
  }

  kill() {
    this.dead = true;
    this.deathTimer = 0;
  }
}
