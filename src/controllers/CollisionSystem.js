// CollisionSystem.js
// Resolves interactions between Pacman and the rest of the world each frame.
// Two concerns, one class:
//   - Pacman vs. dots/pellets (reads Pacman's tile, asks Maze to eat)
//   - Pacman vs. ghosts (circle-distance check, decides who dies)
//
// Owns the eat-combo counter — the multiplier that goes 200, 400, 800, 1600
// as Pacman eats successive ghosts during one frightened period. This is
// real mutable state, which is why CollisionSystem is an instance and not
// a static module.

// Points awarded for eating ghost #1, #2, #3, #4 within one pellet window.
// After the 4th, additional ghosts (shouldn't happen — only 4 exist) cap at 1600.
const GHOST_EAT_POINTS = [200, 400, 800, 1600];

// Squared distance threshold for Pacman/ghost collision. 0.8 tiles feels
// generous but matches the original — tighter values make collisions feel
// unfair because entities move in 0.12-tile steps and can skip past each other.
const COLLISION_RADIUS_SQ = 0.8 * 0.8;

// Score values kept here (not in Maze) because they're game-rule data,
// not maze data. If a future level changes scoring, this is where it lives.
const DOT_POINTS = 10;
const PELLET_POINTS = 50;

export class CollisionSystem {
  constructor({ onScore, onPelletEaten, onPacmanCaught, onGhostEaten }) {
    // Event callbacks — CollisionSystem doesn't know about StateMachine,
    // ModeScheduler, or the HUD. It reports what happened; Game wires the
    // callbacks to the right recipients. This is the main thing keeping
    // this class decoupled from everything downstream.
    this.#onScore         = onScore;          // (points) => void
    this.#onPelletEaten   = onPelletEaten;    // () => void — triggers frighten
    this.#onPacmanCaught  = onPacmanCaught;   // () => void — life lost
    this.#onGhostEaten    = onGhostEaten;     // (ghost, points) => void
  }

  #onScore;
  #onPelletEaten;
  #onPacmanCaught;
  #onGhostEaten;
  #eatCombo = 0;  // how many ghosts eaten during current frightened window

  /** Called by ModeScheduler (or Game) when a new pellet is eaten, so the
   *  next ghost eaten starts fresh at 200 points instead of continuing the
   *  multiplier from a previous pellet. */
  resetCombo() {
    this.#eatCombo = 0;
  }

  /** Pacman vs. dots/pellets. Read Pacman's current tile, ask Maze to eat
   *  whatever's there. Split from ghost collisions because it runs even
   *  when Pacman is already dying (harmless — he just stops moving). */
  resolveDots(pacman, maze) {
    if (pacman.dead) return;
    const [col, row] = pacman.tile();
    const eaten = maze.eatDotAt(col, row);
    if (eaten === 'dot') {
      this.#onScore(DOT_POINTS);
    } else if (eaten === 'pellet') {
      this.#onScore(PELLET_POINTS);
      this.resetCombo();       // fresh window starts at 200
      this.#onPelletEaten();   // Game routes this to ghosts + ModeScheduler
    }
  }

  /** Pacman vs. ghosts. Three outcomes per ghost per frame:
   *    1. Too far apart — nothing
   *    2. Ghost is frightened and not yet eaten — Pacman eats it, score goes up
   *    3. Ghost is alive and not frightened — Pacman dies (once per frame max) */
  resolveGhosts(pacman, ghosts) {
    if (pacman.dead) return;

    for (const ghost of ghosts) {
      // Skip ghosts that are already in their eaten-returning-to-house state —
      // they're just eyes and shouldn't register either way.
      if (ghost.lifeState === 'eaten') continue;

      const dx = ghost.x - pacman.x;
      const dy = ghost.y - pacman.y;
      if (dx * dx + dy * dy >= COLLISION_RADIUS_SQ) continue;

      if (ghost.frightened) {
        // Pacman eats the ghost. Points scale with combo, capped at index 3.
        const pts = GHOST_EAT_POINTS[Math.min(this.#eatCombo, GHOST_EAT_POINTS.length - 1)];
        this.#eatCombo++;
        ghost.eat();                        // flips ghost into 'eaten' state
        this.#onScore(pts);
        this.#onGhostEaten(ghost, pts);
      } else {
        // Pacman dies. Return immediately — if two ghosts touch the same
        // frame, we still only process one death event.
        this.#onPacmanCaught();
        return;
      }
    }
  }
}
