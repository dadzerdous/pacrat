// levelgen.js
// Procedural Pac-Man style maze generator.
// Outputs numeric tile grids matching our TILE constants.
// Uses quarter-generation + horizontal mirror for guaranteed symmetry.
//
// Tile output:
//   1 = WALL
//   2 = DOT
//   3 = PELLET
//   4 = EMPTY (corridors with no dot)
//   5 = EXIT  (waypoint — activates when all dots eaten)
//   6 = HOUSE (ghost house interior)

import { TILE } from './constants.js';

// --- Level config ------------------------------------------------------
// Size grows by 2x2 each level. Must stay odd for quarter-mirroring.
// Ghost count grows every 2 levels, capped at 4.
// Ghost speed and fright duration scale with level.

export function getLevelConfig(levelIndex) {
  const size       = 11 + levelIndex * 2;               // 11, 13, 15 ...
  const ghostCount = Math.min(2 + Math.floor(levelIndex / 2), 4);
  const ghostSpeed = 0.07 + levelIndex * 0.005;          // gets faster
  const frightFrames = Math.max(150, 400 - levelIndex * 30); // gets shorter

  // Staggered exit delays scale with maze size
  const baseDelay  = Math.floor(size * 4);
  const exitDelays = [0, baseDelay, baseDelay * 2, baseDelay * 3];

  return { size, ghostCount, ghostSpeed, frightFrames, exitDelays };
}

// --- Main entry point --------------------------------------------------

export function generateLevel(levelIndex) {
  const { size } = getLevelConfig(levelIndex);
  const w = size;
  const h = size;

  // Build quarter, mirror, place features
  const quarter = buildQuarter(Math.ceil(w / 2), Math.ceil(h / 2));
  const full    = mirrorQuarter(quarter, w, h);

  enforceOuterWalls(full);
  carveGhostHouse(full, w, h);

  const playerSpawn = placePlayerStart(full, w, h);
  const exitPos     = placeExit(full, w, h, playerSpawn);

  cleanupIsolated(full);
  ensureConnected(full);

  fillDots(full);
  placePellets(full, w, h);

  return { grid: full, playerSpawn, exitPos };
}

// --- Quarter generation -----------------------------------------------

function buildQuarter(qw, qh) {
  const q = grid(qw, qh, TILE.WALL);

  // Outer corridors along top and left edges
  for (let x = 1; x < qw - 1; x++) q[1][x] = TILE.EMPTY;
  for (let y = 1; y < qh - 1; y++) q[y][1] = TILE.EMPTY;

  // Horizontal bands — proportional spacing
  const hStep = Math.max(2, Math.floor(qh / 4));
  for (let y = hStep; y < qh - 1; y += hStep) {
    for (let x = 1; x < qw - 1; x++) {
      if (rand() < 0.8) q[y][x] = TILE.EMPTY;
    }
  }

  // Vertical bands
  const vStep = Math.max(2, Math.floor(qw / 4));
  for (let x = vStep; x < qw - 1; x += vStep) {
    for (let y = 1; y < qh - 1; y++) {
      if (rand() < 0.7) q[y][x] = TILE.EMPTY;
    }
  }

  // Random box loops for visual variety
  const loops = Math.max(2, Math.floor(qw / 3));
  for (let i = 0; i < loops; i++) {
    const sx = randInt(2, Math.max(2, qw - 4));
    const sy = randInt(2, Math.max(2, qh - 4));
    const bw = randInt(2, Math.min(3, qw - sx - 1));
    const bh = randInt(2, Math.min(3, qh - sy - 1));
    carveBox(q, sx, sy, bw, bh, qw, qh);
  }

  // Random connectors
  const punches = qw * qh / 4;
  for (let i = 0; i < punches; i++) {
    const x = randInt(1, qw - 2);
    const y = randInt(1, qh - 2);
    if (rand() < 0.4) q[y][x] = TILE.EMPTY;
  }

  return q;
}

function carveBox(q, sx, sy, bw, bh, qw, qh) {
  for (let x = sx; x <= sx + bw && x < qw - 1; x++) {
    if (sy > 0)       q[sy][x]      = TILE.EMPTY;
    if (sy + bh < qh) q[sy + bh][x] = TILE.EMPTY;
  }
  for (let y = sy; y <= sy + bh && y < qh - 1; y++) {
    if (sx > 0)       q[y][sx]      = TILE.EMPTY;
    if (sx + bw < qw) q[y][sx + bw] = TILE.EMPTY;
  }
}

// --- Mirroring --------------------------------------------------------

function mirrorQuarter(quarter, w, h) {
  const qh = quarter.length;
  const qw = quarter[0].length;
  const full = grid(w, h, TILE.WALL);

  for (let y = 0; y < qh; y++) {
    for (let x = 0; x < qw; x++) {
      const t = quarter[y][x];
      full[y][x]             = t; // top-left
      full[y][w - 1 - x]     = t; // top-right
      full[h - 1 - y][x]     = t; // bottom-left
      full[h - 1 - y][w-1-x] = t; // bottom-right
    }
  }
  return full;
}

// --- Structural passes ------------------------------------------------

function enforceOuterWalls(g) {
  const h = g.length, w = g[0].length;
  for (let x = 0; x < w; x++) { g[0][x] = TILE.WALL; g[h-1][x] = TILE.WALL; }
  for (let y = 0; y < h; y++) { g[y][0] = TILE.WALL; g[y][w-1] = TILE.WALL; }

  // Side tunnels at vertical midpoint
  const ty = Math.floor(h / 2);
  g[ty][0]   = TILE.EMPTY;
  g[ty][1]   = TILE.EMPTY;
  g[ty][w-2] = TILE.EMPTY;
  g[ty][w-1] = TILE.EMPTY;
}

function carveGhostHouse(g, w, h) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2) - 1;

  // House is always 5 wide × 3 tall, centred
  for (let y = cy; y <= cy + 2; y++) {
    for (let x = cx - 2; x <= cx + 2; x++) {
      if (!inBounds(g, x, y)) continue;
      const isBorder = y === cy || y === cy + 2 || x === cx - 2 || x === cx + 2;
      g[y][x] = isBorder ? TILE.WALL : TILE.HOUSE;
    }
  }
  // Door (top-centre opening)
  g[cy][cx] = TILE.EMPTY;

  // Clear corridor above and below the house
  for (let x = cx - 3; x <= cx + 3; x++) {
    if (inBounds(g, x, cy - 1)) g[cy - 1][x] = TILE.EMPTY;
    if (inBounds(g, x, cy + 3)) g[cy + 3][x] = TILE.EMPTY;
  }
}

function placePlayerStart(g, w, h) {
  const x = Math.floor(w / 2);
  const y = Math.floor(h / 2) + 3;

  g[y][x] = TILE.EMPTY;
  // Open immediate neighbours
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
    if (inBounds(g, x+dx, y+dy)) g[y+dy][x+dx] = TILE.EMPTY;
  });

  return { x, y };
}

function placeExit(g, w, h, playerSpawn) {
  // BFS from player spawn — place exit at the farthest reachable tile
  const walkable = t => t !== TILE.WALL;
  const visited  = new Map();
  const queue    = [{ x: playerSpawn.x, y: playerSpawn.y, dist: 0 }];
  let farthest   = playerSpawn;
  let maxDist    = 0;

  while (queue.length) {
    const { x, y, dist } = queue.shift();
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    if (!inBounds(g, x, y) || !walkable(g[y][x])) continue;
    visited.set(key, dist);

    if (dist > maxDist) { maxDist = dist; farthest = { x, y }; }

    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      queue.push({ x: x+dx, y: y+dy, dist: dist+1 });
    });
  }

  g[farthest.y][farthest.x] = TILE.EXIT;
  return farthest;
}

// --- Cleanup ----------------------------------------------------------

function cleanupIsolated(g) {
  // Remove wall tiles completely surrounded by walls (unreachable voids)
  // and open single-tile dead-end stubs
  const h = g.length, w = g[0].length;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (g[y][x] !== TILE.EMPTY) continue;
      const open = [[1,0],[-1,0],[0,1],[0,-1]]
        .filter(([dx,dy]) => g[y+dy][x+dx] !== TILE.WALL).length;
      // Dead-end with no neighbours — open a random wall
      if (open === 0) {
        const dirs = shuffle([[1,0],[-1,0],[0,1],[0,-1]]);
        for (const [dx,dy] of dirs) {
          const nx = x+dx, ny = y+dy;
          if (inBounds(g,nx,ny) && g[ny][nx] === TILE.WALL) {
            g[ny][nx] = TILE.EMPTY;
            break;
          }
        }
      }
    }
  }
}

function ensureConnected(g) {
  const walkable = new Set([TILE.EMPTY, TILE.HOUSE, TILE.EXIT]);
  const start = findFirst(g, t => walkable.has(t));
  if (!start) return;

  const visited = bfs(g, start.x, start.y, t => walkable.has(t));
  const cx = Math.floor(g[0].length / 2);
  const cy = Math.floor(g.length / 2);

  for (let y = 1; y < g.length - 1; y++) {
    for (let x = 1; x < g[0].length - 1; x++) {
      if (!walkable.has(g[y][x])) continue;
      if (visited.has(`${x},${y}`)) continue;
      // Punch a corridor toward centre
      let px = x, py = y;
      while (!visited.has(`${px},${py}`)) {
        g[py][px] = TILE.EMPTY;
        visited.add(`${px},${py}`);
        if (px < cx) px++;
        else if (px > cx) px--;
        else if (py < cy) py++;
        else py--;
      }
    }
  }
}

// --- Dots and pellets -------------------------------------------------

function fillDots(g) {
  const h = g.length, w = g[0].length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x] === TILE.EMPTY) g[y][x] = TILE.DOT;
    }
  }
}

function placePellets(g, w, h) {
  // Four corner-adjacent spots
  const spots = [
    [1, 1], [w-2, 1], [1, h-2], [w-2, h-2]
  ];
  for (const [sx, sy] of spots) {
    const found = findNearbyDot(g, sx, sy, 4);
    if (found) g[found.y][found.x] = TILE.PELLET;
  }
}

function findNearbyDot(g, sx, sy, radius) {
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = sx+dx, y = sy+dy;
        if (inBounds(g,x,y) && g[y][x] === TILE.DOT) return {x,y};
      }
    }
  }
  return null;
}

// --- Utilities --------------------------------------------------------

function grid(w, h, fill) {
  return Array.from({ length: h }, () => Array(w).fill(fill));
}

function rand()           { return Math.random(); }
function randInt(a, b)    { return Math.floor(Math.random() * (b - a + 1)) + a; }
function inBounds(g, x, y){ return y >= 0 && y < g.length && x >= 0 && x < g[0].length; }

function findFirst(g, pred) {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0].length; x++)
      if (pred(g[y][x])) return { x, y };
  return null;
}

function bfs(g, sx, sy, passable) {
  const visited = new Set();
  const queue   = [{ x: sx, y: sy }];
  while (queue.length) {
    const { x, y } = queue.shift();
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    if (!inBounds(g, x, y) || !passable(g[y][x])) continue;
    visited.add(key);
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) =>
      queue.push({ x: x+dx, y: y+dy }));
  }
  return visited;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
