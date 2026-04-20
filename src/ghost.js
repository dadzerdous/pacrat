// ghost.js
// A ghost entity. Delegates target selection to a strategy function passed
// in at construction. Direction picking is shared via chooseNextDir().

import { Entity } from './entity.js';
import { DIR } from './constants.js';
import { chooseNextDir } from './ghostAI.js';

const FRIGHTENED_SPEED = 0.06;

export class Ghost extends Entity {
  /**
   * @param name     — identifier used by renderer and AI
   * @param targetFn — pure function (player, blinky, self) → [col, row]
   * @param spawn    — { x, y } starting position
   * @param color    — hex string, stored here so the renderer stays dumb
   * @param speed    — base tiles per frame (default 0.09)
   */
  constructor({ name, targetFn, spawn, color, speed = 0.09 }) {
    super({ x: spawn.x, y: spawn.y, speed, dir: DIR.UP });

    this.name = name;
    this.targetFn = targetFn;
    this.color = color;
    this.baseSpeed = speed;

    // Two independent state axes:
    //   lifeState  — 'alive' | 'eaten'
    //   frightened — true while a power pellet is active
    this.lifeState = 'alive';
    this.frightened = false;
    this.lastDecisionTile = null; // tile key of last AI decision
  }

  update(maze, player, blinky) {
    if (this.lifeState === 'eaten') return; // scheduler handles eye return

    this.speed = this.frightened ? FRIGHTENED_SPEED : this.baseSpeed;

    // Gate AI decisions to tile boundaries — re-deciding every frame
    // mid-corridor causes jitter and ignores the no-reverse rule.
    const tileKey = `${Math.round(this.x)},${Math.round(this.y)}`;
    if (this.atTileCenter() && tileKey !== this.lastDecisionTile) {
      this.lastDecisionTile = tileKey;
      this.snapToTile();
      const target = this.frightened
        ? this.#randomTarget(maze)
        : this.targetFn(player, blinky, this);
      const next = chooseNextDir(this, target, maze);
      if (next) this.dir = next;
    }

    this.tryMove(this.dir, maze);
  }

  /** Use ghost-passable move check so ghosts can traverse the house. */
  tryMove(dir, maze) {
    const nx = maze.wrapX(this.x + dir[0] * this.speed);
    const ny = this.y + dir[1] * this.speed;
    if (maze.canGhostMove(nx, ny)) {
      this.x = nx;
      this.y = ny;
      return true;
    }
    return false;
  }

  /** Frightened ghosts use random targets — same algorithm, noisy input. */
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
