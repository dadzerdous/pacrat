// ghostAI.js
// Pure functions — no state, no instances.
//
// ghostTargets: each ghost's personality (what tile to aim for)
// chooseNextDir: universal pathfinding algorithm (given a target, pick a direction)
//
// Adding a new ghost = add one entry to ghostTargets. Nothing else changes.

import { DIR } from './constants.js';

/**
 * Target-selection strategies. Each returns [col, row].
 * The target doesn't need to be reachable — it just needs to be a
 * coordinate to score neighbouring tiles against.
 */
export const ghostTargets = {
  // Blinky: directly targets the player's current tile.
  blinky: (player) => [Math.round(player.x), Math.round(player.y)],

  // Pinky: targets 4 tiles ahead of the player's facing direction.
  pinky: (player) => [
    Math.round(player.x) + player.dir[0] * 4,
    Math.round(player.y) + player.dir[1] * 4,
  ],

  // Inky: takes the tile 2 ahead of the player, then reflects it through
  // Blinky's position. Feels unpredictable because his aim depends on Blinky.
  inky: (player, blinky) => {
    const ax = Math.round(player.x) + player.dir[0] * 2;
    const ay = Math.round(player.y) + player.dir[1] * 2;
    return [ax + (ax - blinky.x), ay + (ay - blinky.y)];
  },

  // Clyde: chases like Blinky when far away, retreats to his corner when
  // within 8 tiles. The abrupt switch is intentional — it's why he seems
  // to lose interest up close.
  clyde: (player, _blinky, ghost) => {
    const dx = player.x - ghost.x;
    const dy = player.y - ghost.y;
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      return [Math.round(player.x), Math.round(player.y)];
    }
    return [2, 29]; // bottom-left scatter corner
  },
};

/**
 * Universal direction-picking algorithm shared by all ghosts.
 * Personality lives in the target, not here.
 *
 * Rules:
 *   1. Can't reverse direction (prevents jitter)
 *   2. Can't walk into walls
 *   3. Pick the neighbour tile closest to the target (squared distance)
 *   4. Ties broken by priority: UP, LEFT, DOWN, RIGHT (classic arcade order)
 */
export function chooseNextDir(ghost, target, maze) {
  const candidates = [DIR.UP, DIR.LEFT, DIR.DOWN, DIR.RIGHT];
  const reverse = [-ghost.dir[0], -ghost.dir[1]];

  let best = null;
  let bestDist = Infinity;

  for (const d of candidates) {
    if (d[0] === reverse[0] && d[1] === reverse[1]) continue; // no reversing

    const nx = ghost.x + d[0];
    const ny = ghost.y + d[1];
    if (!maze.isGhostPassableTile(nx, ny)) continue; // no walls

    const dx = nx - target[0];
    const dy = ny - target[1];
    const dist = dx * dx + dy * dy;

    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }

  return best; // null only if completely boxed in (shouldn't happen)
}
