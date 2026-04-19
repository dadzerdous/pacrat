// constants.js
// Shared constants used across multiple modules.
// Centralising here avoids duplicate magic numbers and keeps imports clean.

// --- Direction vectors -------------------------------------------------
// Y decreases upward on canvas, hence UP is [0, -1].
export const DIR = {
  LEFT:  [-1,  0],
  RIGHT: [ 1,  0],
  UP:    [ 0, -1],
  DOWN:  [ 0,  1],
  NONE:  [ 0,  0],
};

// --- Tile codes --------------------------------------------------------
// Used by maze.js (grid values) and renderer.js (drawing switch).
export const TILE = {
  WALL:   1,
  DOT:    2,
  PELLET: 3,
  EMPTY:  4,
};

// --- Frightened timing -------------------------------------------------
// Exported here so scheduler.js and renderer.js share the same threshold
// without either importing from the other.
export const FRIGHT_FRAMES      = 400;  // total frightened duration (frames)
export const FRIGHT_WARN_FRAMES = 100;  // last N frames: ghosts flash as warning

// --- Scoring -----------------------------------------------------------
export const POINTS = {
  DOT:    10,
  PELLET: 50,
  GHOST:  [200, 400, 800, 1600], // index = combo count (capped at 3)
};
