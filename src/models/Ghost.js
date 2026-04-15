// Ghost.js
// A ghost entity. Delegates target selection to an AI function (strategy
// pattern — held as a field, not an inheritance axis). Direction picking
// is shared across all ghosts and lives in chooseNextDirection().

import { Entity } from './Entity.js';
import { DIR } from '../const/direction.js';
import { chooseNextDirection } from '../const/ghostAI.js';

const FRIGHTENED_SPEED = 0.06;

export class Ghost extends Entity {
  /**
   * @param name      — identifier used by renderer and debug logs
   * @param targetFn  — pure function (pacman, blinky) → [col, row] target tile
   * @param spawn     — {x, y} starting position
   * @param color     — rendering hint, stored here so the renderer stays dumb
   */
  constructor({ name, targetFn, spawn, color, speed = 0.09 }) {
    super({ x: spawn.x, y: spawn.y, speed, dir: DIR.UP });

    this.name = name;
    this.targetFn = targetFn;
    this.color = color;
    this.baseSpeed = speed;

    // Two orthogonal state axes:
    //   lifeState — where this ghost is in its life cycle (house, alive, eaten)
    //   frightened — whether a power pellet is currently active
    // Keeping them separate avoids the tangled single-enum the original had.
    this.lifeState = 'alive';     // 'alive' | 'eaten'
    this.frightened = false;
  }

  update(maze, pacman, blinky) {
    // Eaten ghosts are handled by CollisionSystem / ModeScheduler returning
    // them home. Skip AI entirely in that state — the renderer draws just eyes.
    if (this.lifeState === 'eaten') return;

    const speed = this.frightened ? FRIGHTENED_SPEED : this.baseSpeed;
    this.speed = speed;

    // AI decisions only fire at tile centers. Between centers we slide along
    // the committed direction. This is what gives ghosts their "locked-in"
    // feel — they can't revise a bad turn until the next intersection.
    if (this.atTileCenter()) {
      this.snapToTile();
      const target = this.frightened
        ? this.#randomTarget(maze)
        : this.targetFn(pacman, blinky);
      const next = chooseNextDirection(this, target, maze);
      if (next) this.dir = next;
    }

    this.tryMove(this.dir, maze);
  }

  /** Frightened mode uses random targeting. Same algorithm, noisy input —
   *  that's why frightened ghosts wander instead of fleeing directly. */
  #randomTarget(maze) {
    return [
      Math.floor(Math.random() * maze.cols),
      Math.floor(Math.random() * maze.rows),
    ];
  }

  frighten()   { if (this.lifeState === 'alive') this.frightened = true; }
  unfrighten() { this.frightened = false; }
  eat()        { this.lifeState = 'eaten'; this.frightened = false; }
  revive()     { this.lifeState = 'alive'; }
}
