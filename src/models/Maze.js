// Maze.js
// Owns the mutable grid. Receives a template at construction (data, not
// behavior) and deep-copies it so the template stays pristine across resets.
//
// Public API (what other classes rely on — keep stable):
//   canMove(x, y)            — float-space collision, used by entities
//   wrapX(x)                 — tunnel wrap on the X axis
//   isPassableTile(col, row) — integer-tile wall test, used by ghost AI
//   eatDotAt(col, row)       — returns 'dot' | 'pellet' | null, mutates grid
//   tileAt(col, row)         — raw read, used by renderer
//   dotsRemaining            — for win detection
//   cols, rows               — grid dimensions
//   reset()                  — restore the template (new game / new level)

const WALL = 1;
const DOT = 2;
const PELLET = 3;
const EMPTY = 4;

// Half-width of the entity collision box. Slightly under half a tile so
// corners don't clip through walls but tight corridor turns still work.
// Match this to the value the original code used — changing it alters
// movement feel in ways that are hard to eyeball.
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

  /** Deep-copy the template into the working grid and recount dots.
   *  Called at construction and whenever we start a new level. */
  reset() {
    this.#grid = this.#template.map(row => [...row]);
    this.#dotsRemaining = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.#grid[r][c];
        if (t === DOT || t === PELLET) this.#dotsRemaining++;
      }
    }
  }

  /** Load a new level template and reset the grid to it.
   *  Called by Game when advancing to the next level. */
  loadTemplate(template) {
    this.#template = template;
    this.rows = template.length;
    this.cols = template[0].length;
    this.reset();
  }

  /**
   * Float-space collision test. Used by Entity.tryMove().
   * Tests all four corners of a COLLISION_MARGIN-sized box around (x, y).
   * Corners that fall outside the grid are skipped — this is what lets
   * entities partly exit the screen during a tunnel wrap.
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
      if (this.#grid[row][col] === WALL) return false;
    }
    return true;
  }

  /** Integer-tile wall test. Used by ghost AI for neighbor scoring —
   *  it asks "could I step into this specific tile" not "am I clipping." */
  isPassableTile(col, row) {
    const c = Math.round(col);
    const r = Math.round(row);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    return this.#grid[r][c] !== WALL;
  }

  /** Tunnel wrap. The tunnel row (14 in the default template) has EMPTY
   *  tiles at its far edges; wrapping only makes sense on X. */
  wrapX(x) {
    if (x < -0.5) return this.cols - 0.5;
    if (x > this.cols - 0.5) return 0.5;
    return x;
  }

  /**
   * Attempt to eat whatever is at (col, row). Returns 'dot' or 'pellet'
   * if something was eaten (so CollisionSystem knows whether to frighten
   * ghosts), or null if the tile held nothing edible.
   *
   * Pacman.update() doesn't call this directly — CollisionSystem does,
   * after reading Pacman's current tile. Keeps mutation out of the player.
   */
  eatDotAt(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    const t = this.#grid[row][col];
    if (t === DOT) {
      this.#grid[row][col] = EMPTY;
      this.#dotsRemaining--;
      return 'dot';
    }
    if (t === PELLET) {
      this.#grid[row][col] = EMPTY;
      this.#dotsRemaining--;
      return 'pellet';
    }
    return null;
  }

  /** Raw tile read for the renderer. Returns the numeric tile code so
   *  the renderer can switch on it — we deliberately don't wrap this in
   *  a richer object since the renderer runs every frame. */
  tileAt(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return WALL;
    return this.#grid[row][col];
  }
}

// Exported tile constants so the renderer can import them by name instead
// of hardcoding magic numbers. Kept as a named export alongside the class.
export const TILE = { WALL, DOT, PELLET, EMPTY };
