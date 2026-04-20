// maze.js
// Owns the mutable grid. Receives a level template at construction,
// deep-copies it so the template stays pristine across resets.
//
// Public API:
//   canMove(x, y)            — float-space collision, used by entities
//   wrapX(x)                 — tunnel wrap on the X axis
//   isPassableTile(col, row) — integer-tile wall test, used by ghost AI
//   eatDotAt(col, row)       — returns 'dot' | 'pellet' | null, mutates grid
//   tileAt(col, row)         — raw read for the renderer
//   dotsRemaining            — for win detection
//   cols, rows               — grid dimensions
//   loadTemplate(template)   — swap to a new level
//   reset()                  — restore current template (new round)

import { TILE } from './constants.js';

const COLLISION_MARGIN = 0.45;

export class Maze {
  constructor(template, exitPos = null) {
    this.#template = template;
    this.rows      = template.length;
    this.cols      = template[0].length;
    this.exitPos   = exitPos;   // { x, y } tile of the exit, or null
    this.exitOpen  = false;     // true once all dots are eaten
    this.reset();
  }

  #template;
  #grid;
  #dotsRemaining;

  get dotsRemaining() { return this.#dotsRemaining; }

  reset() {
    this.#grid = this.#template.map(row => [...row]);
    this.#dotsRemaining = 0;
    this.exitOpen = false;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.#grid[r][c];
        if (t === TILE.DOT || t === TILE.PELLET) this.#dotsRemaining++;
      }
    }
  }

  loadTemplate(template, exitPos = null) {
    this.#template = template;
    this.rows      = template.length;
    this.cols      = template[0].length;
    this.exitPos   = exitPos;
    this.reset();
  }

  canMove(x, y) {
    const corners = [
      [x - COLLISION_MARGIN, y - COLLISION_MARGIN],
      [x + COLLISION_MARGIN, y - COLLISION_MARGIN],
      [x - COLLISION_MARGIN, y + COLLISION_MARGIN],
      [x + COLLISION_MARGIN, y + COLLISION_MARGIN],
    ];
    for (const [cx, cy] of corners) {
      const col = Math.round(cx);
      const row = Math.round(cy);
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) continue;
      const t = this.#grid[row][col];
      // WALL blocks everyone. HOUSE blocks only players (ghosts pass freely).
      if (t === TILE.WALL) return false;
    }
    return true;
  }

  /** Ghost-specific passability — ghosts can enter HOUSE tiles. */
  canGhostMove(x, y) {
    const corners = [
      [x - COLLISION_MARGIN, y - COLLISION_MARGIN],
      [x + COLLISION_MARGIN, y - COLLISION_MARGIN],
      [x - COLLISION_MARGIN, y + COLLISION_MARGIN],
      [x + COLLISION_MARGIN, y + COLLISION_MARGIN],
    ];
    for (const [cx, cy] of corners) {
      const col = Math.round(cx);
      const row = Math.round(cy);
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) continue;
      if (this.#grid[row][col] === TILE.WALL) return false;
    }
    return true;
  }

  isPassableTile(col, row) {
    const c = Math.round(col);
    const r = Math.round(row);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    const t = this.#grid[r][c];
    return t !== TILE.WALL && t !== TILE.HOUSE;
  }

  isGhostPassableTile(col, row) {
    const c = Math.round(col);
    const r = Math.round(row);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    return this.#grid[r][c] !== TILE.WALL;
  }

  wrapX(x) {
    if (x < -0.5) return this.cols - 0.5;
    if (x > this.cols - 0.5) return 0.5;
    return x;
  }

  eatDotAt(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    const t = this.#grid[row][col];
    if (t === TILE.DOT) {
      this.#grid[row][col] = TILE.EMPTY;
      this.#dotsRemaining--;
      if (this.#dotsRemaining === 0) this.exitOpen = true;
      return 'dot';
    }
    if (t === TILE.PELLET) {
      this.#grid[row][col] = TILE.EMPTY;
      this.#dotsRemaining--;
      if (this.#dotsRemaining === 0) this.exitOpen = true;
      return 'pellet';
    }
    return null;
  }

  /** Check if player is standing on the open exit. */
  isOnExit(col, row) {
    if (!this.exitOpen || !this.exitPos) return false;
    return Math.round(col) === this.exitPos.x && Math.round(row) === this.exitPos.y;
  }

  tileAt(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return TILE.WALL;
    return this.#grid[row][col];
  }
}
