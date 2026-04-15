// Pacman.js
// The player entity. Reads a queued direction from input and commits to it
// whenever the turn is legal. Tracks mouth animation phase as pure state —
// the renderer reads it but never writes to it.

import { Entity } from './Entity.js';
import { DIR } from '../const/direction.js';

export class Pacman extends Entity {
  constructor() {
    // Spawn at (13.5, 23) — the half-tile X offset is deliberate and matches
    // the classic arcade start position between columns 13 and 14.
    super({ x: 13.5, y: 23, speed: 0.12, dir: DIR.LEFT });

    this.nextDir = DIR.LEFT;   // buffered input — applied when the turn is legal
    this.mouthPhase = 0.25;    // 0 = closed, ~0.35 = wide open
    this.mouthOpening = true;  // animation direction flag
    this.dead = false;
    this.deathTimer = 0;       // frames since death; renderer uses this for the spiral
  }

  /** Called by InputController. We only store the intent; committing to it
   *  happens in update() when we can verify the direction is passable. */
  queueDirection(dir) {
    this.nextDir = dir;
  }

  update(maze) {
    if (this.dead) {
      this.deathTimer++;
      return;
    }

    // Try the buffered direction. We can only legally turn into a new lane
    // if the tile one step away in that direction is passable AND we're
    // close enough to the perpendicular axis to snap into the new lane.
    // Float canMove with corner checks fails perpendicular turns mid-corridor
    // because the trailing corner straddles two columns/rows.
    const cx = Math.round(this.x);
    const cy = Math.round(this.y);
    const targetCol = cx + this.nextDir[0];
    const targetRow = cy + this.nextDir[1];
    if (maze.isPassableTile(targetCol, targetRow)) {
      this.dir = this.nextDir;
      // Snap the perpendicular axis so we're aligned with the new lane.
      // Turning vertically? Snap x. Turning horizontally? Snap y.
      if (this.nextDir[1] !== 0) this.x = cx;
      if (this.nextDir[0] !== 0) this.y = cy;
    }

    this.tryMove(this.dir, maze);  // silently no-ops if pressed against a wall
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
