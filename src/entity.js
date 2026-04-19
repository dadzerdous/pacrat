// entity.js
// Base class for anything that moves on the grid.
// player.js and ghost.js both extend this.

import { DIR } from './constants.js';

export class Entity {
  constructor({ x, y, speed, dir = DIR.LEFT }) {
    this.x = x;         // tile-space float — sub-tile precision matters
    this.y = y;         // for smooth movement and spawn offsets (e.g. 13.5)
    this.dir = dir;     // current committed direction vector
    this.speed = speed; // tiles per frame
  }

  /**
   * Attempt to move in the given direction by this.speed.
   * Returns true if the move succeeded, false if blocked by a wall.
   * Applies tunnel wrap on the X axis via maze.wrapX().
   */
  tryMove(dir, maze) {
    const nx = maze.wrapX(this.x + dir[0] * this.speed);
    const ny = this.y + dir[1] * this.speed;
    if (maze.canMove(nx, ny)) {
      this.x = nx;
      this.y = ny;
      return true;
    }
    return false;
  }

  /**
   * True when the entity is close enough to a tile centre to make a
   * decision (turn, pick a new direction). Ghosts use this to gate AI
   * decisions; without it they'd re-decide every frame mid-corridor.
   * Tolerance must be at least `speed` or fast entities skip the centre.
   */
  atTileCenter() {
    const tol = this.speed + 0.05;
    return Math.abs(this.x - Math.round(this.x)) < tol
        && Math.abs(this.y - Math.round(this.y)) < tol;
  }

  /** Snap to the nearest integer tile. Called after atTileCenter() so
   *  subsequent movement starts from a clean grid position. */
  snapToTile() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
  }

  /** Current tile as [col, row]. */
  tile() {
    return [Math.round(this.x), Math.round(this.y)];
  }
}
