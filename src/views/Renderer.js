// Renderer.js
// Canvas rendering. One public method (draw) that takes a snapshot of
// the model layer and paints the frame. Owns ctx, owns its own frame
// counter for time-based visuals (dot pulsing, frightened blink cadence),
// reads everything else directly off the model objects.
//
// No computation that advances state lives here. `#frame` just ticks up
// as a clock for visual effects — it's not gameplay-relevant and nothing
// outside Renderer reads it.

import { TILE } from '../models/Maze.js';
import { FRIGHT_WARN_FRAMES } from '../controllers/ModeScheduler.js';

// Rendering constants. Match the grid CELL size from the original layout.
const CELL = 20;
const WALL_COLOR  = '#1a1aff';
const WALL_GLOW   = '#2233ff';
const DOT_COLOR   = '#FFD4A0';
const PACMAN_COLOR = '#FFD700';

export class Renderer {
  /**
   * @param canvas — the <canvas> element. Renderer is the only class that
   *                 touches it; sub-draw methods use this.#ctx internally.
   */
  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
  }

  #canvas; #ctx;
  #frame = 0;  // render-clock; incremented each draw(). Not gameplay state.

  /**
   * Paint one frame. Called every tick by Game with fresh model references.
   *
   * @param scene — { maze, pacman, ghosts, modeScheduler, stateName }
   */
  draw(scene) {
    this.#frame++;
    this.#clear();
    this.#drawMaze(scene.maze);
    this.#drawPacman(scene.pacman);
    for (const g of scene.ghosts) {
      this.#drawGhost(g, scene.modeScheduler, scene.pacman);
    }
  }

  // ================================================================
  //  MAZE
  // ================================================================

  #clear() {
    this.#ctx.fillStyle = '#000';
    this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  #drawMaze(maze) {
    const ctx = this.#ctx;
    for (let r = 0; r < maze.rows; r++) {
      for (let c = 0; c < maze.cols; c++) {
        const x = c * CELL, y = r * CELL;
        const t = maze.tileAt(c, r);
        if (t === TILE.WALL) {
          // Layered fill produces the neon-border effect without needing
          // a separate stroke pass — fill a block, overlay a slightly
          // brighter inner square, then restore the outer color for depth.
          ctx.fillStyle = WALL_COLOR;
          ctx.fillRect(x, y, CELL, CELL);
          ctx.fillStyle = WALL_GLOW;
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          ctx.fillStyle = WALL_COLOR;
          ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
        } else if (t === TILE.DOT) {
          ctx.fillStyle = DOT_COLOR;
          ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (t === TILE.PELLET) {
          // Pulse radius with a sine wave driven by the render frame counter.
          // Time-based but not gameplay — pellet value is constant regardless.
          const pulse = 5 + Math.sin(this.#frame * 0.2) * 1;
          ctx.fillStyle = DOT_COLOR;
          ctx.shadowColor = DOT_COLOR;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }
  }

  // ================================================================
  //  PACMAN
  // ================================================================

  #drawPacman(pacman) {
    const ctx = this.#ctx;
    const px = pacman.x * CELL + CELL / 2;
    const py = pacman.y * CELL + CELL / 2;
    const r = CELL / 2 - 1;

    if (pacman.dead) {
      // Death spiral: mouth opens wider as deathTimer advances, until the
      // whole shape is swept away. Reading deathTimer directly because it's
      // legitimately gameplay state (StateMachine gates respawn on it).
      const pct = Math.min(pacman.deathTimer / 60, 1);
      const sweep = Math.PI * (1 + pct);
      ctx.fillStyle = PACMAN_COLOR;
      ctx.shadowColor = PACMAN_COLOR;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, r, 0, sweep);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      return;
    }

    // Facing angle derived from direction vector. If Pacman is stopped
    // (DIR.NONE or pressed against a wall with no movement), the angle
    // stays at whatever was last set, which is fine visually.
    let angle = 0;
    const [dx, dy] = pacman.dir;
    if (dx === 1)       angle = 0;
    else if (dx === -1) angle = Math.PI;
    else if (dy === -1) angle = -Math.PI / 2;
    else if (dy === 1)  angle = Math.PI / 2;

    const mouth = pacman.mouthPhase * Math.PI;
    ctx.fillStyle = PACMAN_COLOR;
    ctx.shadowColor = PACMAN_COLOR;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, r, angle + mouth, angle + Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ================================================================
  //  GHOSTS
  // ================================================================

  #drawGhost(ghost, modeScheduler, pacman) {
    const ctx = this.#ctx;
    const gx = ghost.x * CELL + CELL / 2;
    const gy = ghost.y * CELL + CELL / 2;
    const r = CELL / 2 - 1;

    // Decide visual state. Order matters — eaten wins over frightened
    // (eyes-only during return) and frightened wins over normal.
    const visualState = this.#resolveGhostVisualState(ghost, modeScheduler);

    if (visualState === 'eaten') {
      this.#drawGhostEyesOnly(gx, gy, pacman, ghost);
      return;
    }

    // Body
    const bodyColor = this.#resolveGhostBodyColor(ghost, visualState);
    ctx.fillStyle = bodyColor;
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = visualState === 'normal' ? 12 : 5;
    this.#drawGhostBody(gx, gy, r);
    ctx.shadowBlur = 0;

    // Face
    if (visualState === 'normal') {
      this.#drawGhostEyes(gx, gy, pacman, ghost);
    } else {
      this.#drawFrightenedFace(gx, gy);
    }
  }

  /** Decide which visual state to paint the ghost in.
   *  'normal' | 'frightened' | 'frightened-ending' | 'eaten'
   *  Frightened-ending is the white-flash warning during the last
   *  FRIGHT_WARN_FRAMES frames of the frightened window. */
  #resolveGhostVisualState(ghost, modeScheduler) {
    if (ghost.lifeState === 'eaten') return 'eaten';
    if (!ghost.frightened) return 'normal';
    if (modeScheduler.frightTimer < FRIGHT_WARN_FRAMES) return 'frightened-ending';
    return 'frightened';
  }

  #resolveGhostBodyColor(ghost, visualState) {
    if (visualState === 'frightened') return '#0000CC';
    if (visualState === 'frightened-ending') {
      // Alternate white/blue every ~200ms — use the render frame counter
      // so the flash cadence is independent of gameplay speed.
      return Math.floor(this.#frame / 12) % 2 === 0 ? '#fff' : '#0000CC';
    }
    return ghost.color;
  }

  #drawGhostBody(gx, gy, r) {
    const ctx = this.#ctx;
    ctx.beginPath();
    ctx.arc(gx, gy - 2, r, Math.PI, 0);          // rounded top
    const bottom = gy - 2 + r;
    const waves = 3;
    for (let i = 0; i <= waves; i++) {            // wavy bottom fringe
      const wx = (gx - r) + (i * (r * 2 / waves));
      const wy = i % 2 === 0 ? bottom : bottom - 5;
      ctx.lineTo(wx, wy);
    }
    ctx.lineTo(gx - r, gy - 2);
    ctx.closePath();
    ctx.fill();
  }

  /** Normal-mode eyes: whites plus blue pupils tracking Pacman. */
  #drawGhostEyes(gx, gy, pacman, ghost) {
    const ctx = this.#ctx;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(gx - 4, gy - 4, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(gx + 4, gy - 4, 3, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Pupils point toward Pacman — one-line cross-entity read, the kind
    // we agreed is fine in the view layer (no state, no time accumulation).
    const dx = pacman.x - ghost.x;
    const dy = pacman.y - ghost.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ex = dx / len, ey = dy / len;
    ctx.fillStyle = '#00f';
    ctx.beginPath(); ctx.arc(gx - 4 + ex * 1.5, gy - 4 + ey * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(gx + 4 + ex * 1.5, gy - 4 + ey * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  /** Frightened face: small white eyes + zigzag mouth. */
  #drawFrightenedFace(gx, gy) {
    const ctx = this.#ctx;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(gx - 3, gy - 3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(gx + 3, gy - 3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const mx = (gx - 5) + (i * 2.5);
      const my = i % 2 === 0 ? gy + 1 : gy + 3;
      i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
    }
    ctx.stroke();
  }

  /** Eaten-mode rendering: just eyes floating back to the house. */
  #drawGhostEyesOnly(gx, gy, pacman, ghost) {
    const ctx = this.#ctx;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(gx - 4, gy - 2, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(gx + 4, gy - 2, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Pupils point toward spawn-ish (or Pacman) — direction matters less
    // here since the ghost is flying in a straight line home anyway.
    const dx = pacman.x - ghost.x;
    const dy = pacman.y - ghost.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ex = dx / len, ey = dy / len;
    ctx.fillStyle = '#00f';
    ctx.beginPath(); ctx.arc(gx - 4 + ex * 1.5, gy - 2 + ey * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(gx + 4 + ex * 1.5, gy - 2 + ey * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
  }
}
