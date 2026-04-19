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

// Half-width of the entity collision box. Slightly under 0.5 so corners
// don't clip through walls but tight corridor turns still work.
const COLLISION_MARGIN = 0.45;

export class Maze {
  constructor(template) {
    this.#template = template;
    this.rows = template.length;
    this.cols = template[0].length;
    this.reset();
  }

  #template;
  #grid;
  #dotsRemaining;

  get dotsRemaining() { return this.#dotsRemaining; }

  /** Deep-copy the template into the working grid and recount dots. */
  reset() {
    this.#grid = this.#template.map(row => [...row]);
    this.#dotsRemaining = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.#grid[r][c];
        if (t === TILE.DOT || t === TILE.PELLET) this.#dotsRemaining++;
      }
    }
  }

  /** Swap to a new level template and reset the grid. */
  loadTemplate(template) {
    this.#template = template;
    this.rows = template.length;
    this.cols = template[0].length;
    this.reset();
  }

  /**
   * Float-space collision test used by entity.tryMove().
   * Tests all four corners of a COLLISION_MARGIN box around (x, y).
   * Corners outside the grid are skipped — lets entities partly exit
   * the screen during a tunnel wrap.
   */
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
      if (this.#grid[row][col] === TILE.WALL) return false;
    }
    return true;
  }

  /** Integer-tile wall test used by ghost AI. */
  isPassableTile(col, row) {
    const c = Math.round(col);
    const r = Math.round(row);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    return this.#grid[r][c] !== TILE.WALL;
  }

  /** Tunnel wrap on X only. */
  wrapX(x) {
    if (x < -0.5) return this.cols - 0.5;
    if (x > this.cols - 0.5) return 0.5;
    return x;
  }

  /**
   * Eat whatever is at (col, row).
   * Returns 'dot', 'pellet', or null if nothing edible.
   */
  eatDotAt(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    const t = this.#grid[row][col];
    if (t === TILE.DOT) {
      this.#grid[row][col] = TILE.EMPTY;
      this.#dotsRemaining--;
      return 'dot';
    }
    if (t === TILE.PELLET) {
      this.#grid[row][col] = TILE.EMPTY;
      this.#dotsRemaining--;
      return 'pellet';
    }
    return null;
  }

  /** Raw tile read for the renderer. */
  tileAt(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return TILE.WALL;
    return this.#grid[row][col];
  }
}
