// ghostAI.js
// Pure functions. No state, no instances.
//
// Two responsibilities, cleanly separated:
//   - ghostTargets: each ghost's personality — what tile to aim for
//   - chooseNextDirection: the universal algorithm — given a target, pick a direction
//
// Adding a new ghost = add one entry to ghostTargets. Nothing else changes.

import { DIR } from './direction.js';

/**
 * Target-selection strategies. Each function returns [col, row] — the tile
 * the ghost is currently aiming for. The target doesn't need to be reachable
 * or even inside the maze; it just has to be a coordinate to score neighbors against.
 */
export const ghostTargets = {
  // Blinky: the shadow. Directly targets Pacman's current tile.
  blinky: (pacman) => [Math.round(pacman.x), Math.round(pacman.y)],

  // Pinky: the ambusher. Targets 4 tiles ahead of Pacman's facing direction.
  pinky: (pacman) => [
    Math.round(pacman.x) + pacman.dir[0] * 4,
    Math.round(pacman.y) + pacman.dir[1] * 4,
  ],

  // Inky: the flanker. Take the tile 2 ahead of Pacman, then reflect it
  // through Blinky's position — that reflected point is Inky's target.
  // This is what makes Inky feel unpredictable: his aim depends on Blinky.
  inky: (pacman, blinky) => {
    const ax = Math.round(pacman.x) + pacman.dir[0] * 2;
    const ay = Math.round(pacman.y) + pacman.dir[1] * 2;
    return [ax + (ax - blinky.x), ay + (ay - blinky.y)];
  },

  // Clyde: the coward. Chases like Blinky when far away, retreats to his
  // corner when within 8 tiles. The abrupt switch is intentional in the
  // original design — it's why Clyde seems to "lose interest" up close.
  clyde: (pacman, _blinky, ghost) => {
    const dx = pacman.x - ghost.x, dy = pacman.y - ghost.y;
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      return [Math.round(pacman.x), Math.round(pacman.y)];
    }
    return [2, 29];  // bottom-left corner
  },
};

/**
 * The universal direction-picking algorithm. Shared by all ghosts —
 * personality lives in the target, not here.
 *
 * Rules (faithful to the arcade original):
 *   1. Can't reverse direction (prevents jitter; forces commitment)
 *   2. Can't walk into walls
 *   3. Of the remaining options, pick the one whose resulting tile is
 *      closest to the target by straight-line distance (squared — sqrt is
 *      monotonic so we skip it)
 *   4. Ties broken by direction priority: UP, LEFT, DOWN, RIGHT
 *      (this is the classic arcade tiebreak and produces the canonical
 *      ghost behavior players remember)
 */
export function chooseNextDirection(ghost, target, maze) {
  // Priority order matters for tie-breaking — first match wins a tie.
  const candidates = [DIR.UP, DIR.LEFT, DIR.DOWN, DIR.RIGHT];
  const reverse = [-ghost.dir[0], -ghost.dir[1]];

  let best = null;
  let bestDist = Infinity;

  for (const d of candidates) {
    // Rule 1: no reversing
    if (d[0] === reverse[0] && d[1] === reverse[1]) continue;

    const nx = ghost.x + d[0];
    const ny = ghost.y + d[1];

    // Rule 2: no walls. Delegate to maze — we don't know the grid format here.
    if (!maze.isPassableTile(nx, ny)) continue;

    // Rule 3: squared distance to target
    const dx = nx - target[0];
    const dy = ny - target[1];
    const dist = dx * dx + dy * dy;

    // Strict less-than preserves the UP/LEFT/DOWN/RIGHT tiebreak ordering —
    // the first candidate at a given distance wins.
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }

  return best;  // null if boxed in (shouldn't happen in a valid maze)
}
