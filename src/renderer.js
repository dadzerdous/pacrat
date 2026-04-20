// renderer.js
// Canvas rendering. One public method (draw) receives a scene snapshot
// and paints the frame. No state is advanced here — #frame is just a
// clock for visual effects (pulse, blink cadence).

import { TILE, FRIGHT_WARN_FRAMES } from './constants.js';

const CELL         = 20;
const WALL_COLOR   = '#1a1aff';
const WALL_GLOW    = '#2233ff';
const DOT_COLOR    = '#FFD4A0';

export class Renderer {
  /** @param canvas — the <canvas> element; Renderer is the sole owner. */
  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx    = canvas.getContext('2d');
  }

  #canvas; #ctx;
  #frame = 0;

  /**
   * Paint one frame.
   * @param scene — { maze, player, ghosts, scheduler, stateName }
   */
  draw(scene) {
    this.#frame++;

    // Resize canvas to fit current maze dimensions
    const targetW = scene.maze.cols * CELL;
    const targetH = scene.maze.rows * CELL;
    if (this.#canvas.width !== targetW)  this.#canvas.width  = targetW;
    if (this.#canvas.height !== targetH) this.#canvas.height = targetH;

    this.#clear();
    this.#drawMaze(scene.maze);
    this.#drawPlayer(scene.player);
    for (const g of scene.ghosts) {
      this.#drawGhost(g, scene.scheduler, scene.player);
    }
  }

  // ---- Maze -------------------------------------------------------------

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
          const pulse = 5 + Math.sin(this.#frame * 0.2) * 1;
          ctx.fillStyle   = DOT_COLOR;
          ctx.shadowColor = DOT_COLOR;
          ctx.shadowBlur  = 10;
          ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (t === TILE.EXIT) {
          // Draw exit — glows green when open, dim when locked
          const open   = maze.exitOpen;
          const pulse  = open ? 4 + Math.sin(this.#frame * 0.15) * 2 : 3;
          const color  = open ? '#00ff88' : '#1a5c3a';
          const glow   = open ? '#00ff88' : 'transparent';
          ctx.fillStyle   = color;
          ctx.shadowColor = glow;
          ctx.shadowBlur  = open ? 16 : 0;
          ctx.beginPath();
          // Star-ish shape using two overlapping rects rotated
          ctx.save();
          ctx.translate(x + CELL / 2, y + CELL / 2);
          ctx.rotate(this.#frame * (open ? 0.03 : 0));
          ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-pulse * 0.7, -pulse * 0.7, pulse * 1.4, pulse * 1.4);
          ctx.restore();
          ctx.shadowBlur = 0;
        } else if (t === TILE.HOUSE) {
          // Ghost house interior — subtle dark tint
          ctx.fillStyle = '#110022';
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
    }
  }

  // ---- Player -----------------------------------------------------------

  #drawPlayer(player) {
    const ctx = this.#ctx;
    const px  = player.x * CELL + CELL / 2;
    const py  = player.y * CELL + CELL / 2;
    const r   = CELL / 2 - 1;
    const fontSize = CELL - 2;

    if (player.dead) {
      // Shrink the emoji as the death timer advances
      const pct  = Math.min(player.deathTimer / 60, 1);
      const size = Math.round(fontSize * (1 - pct));
      if (size <= 0) return;
      ctx.save();
      ctx.font         = `${size}px serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha  = 1 - pct;
      ctx.translate(px, py);
      // Spin while dying
      ctx.rotate(pct * Math.PI * 2);
      ctx.fillText(player.emoji, 0, 0);
      ctx.restore();
      return;
    }

    // Rotate emoji to face movement direction
    let angle = 0;
    const [dx, dy] = player.dir;
    if      (dx ===  1) angle = 0;
    else if (dx === -1) angle = Math.PI;
    else if (dy === -1) angle = -Math.PI / 2;
    else if (dy ===  1) angle = Math.PI / 2;

    // Subtle bob when moving
    const bob = player.waiting ? 0 : Math.sin(this.#frame * 0.25) * 1.5;

    ctx.save();
    ctx.font         = `${fontSize}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(px, py + bob);
    ctx.rotate(angle);
    ctx.fillText(player.emoji, 0, 0);
    ctx.restore();
  }

  // ---- Ghosts -----------------------------------------------------------

  #drawGhost(ghost, scheduler, player) {
    const ctx = this.#ctx;
    const gx  = ghost.x * CELL + CELL / 2;
    const gy  = ghost.y * CELL + CELL / 2;
    const r   = CELL / 2 - 1;

    const vs = this.#ghostVisualState(ghost, scheduler);

    if (vs === 'eaten') {
      this.#drawEyesOnly(gx, gy, player, ghost);
      return;
    }

    const bodyColor = this.#ghostBodyColor(ghost, vs);
    ctx.fillStyle   = bodyColor;
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur  = vs === 'normal' ? 12 : 5;
    this.#drawGhostBody(gx, gy, r);
    ctx.shadowBlur = 0;

    if (vs === 'normal') {
      this.#drawGhostEyes(gx, gy, player, ghost);
    } else {
      this.#drawFrightenedFace(gx, gy);
    }
  }

  #ghostVisualState(ghost, scheduler) {
    if (ghost.lifeState === 'eaten') return 'eaten';
    if (!ghost.frightened)           return 'normal';
    if (scheduler.frightTimer < FRIGHT_WARN_FRAMES) return 'frightened-ending';
    return 'frightened';
  }

  #ghostBodyColor(ghost, vs) {
    if (vs === 'frightened') return '#0000CC';
    if (vs === 'frightened-ending') {
      return Math.floor(this.#frame / 12) % 2 === 0 ? '#fff' : '#0000CC';
    }
    return ghost.color;
  }

  #drawGhostBody(gx, gy, r) {
    const ctx    = this.#ctx;
    const bottom = gy - 2 + r;
    const waves  = 3;
    ctx.beginPath();
    ctx.arc(gx, gy - 2, r, Math.PI, 0);
    for (let i = 0; i <= waves; i++) {
      const wx = (gx - r) + (i * (r * 2 / waves));
      const wy = i % 2 === 0 ? bottom : bottom - 5;
      ctx.lineTo(wx, wy);
    }
    ctx.lineTo(gx - r, gy - 2);
    ctx.closePath();
    ctx.fill();
  }

  #drawGhostEyes(gx, gy, player, ghost) {
    const ctx = this.#ctx;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(gx - 4, gy - 4, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(gx + 4, gy - 4, 3, 4, 0, 0, Math.PI * 2); ctx.fill();

    const dx  = player.x - ghost.x;
    const dy  = player.y - ghost.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ex  = dx / len, ey = dy / len;
    ctx.fillStyle = '#00f';
    ctx.beginPath(); ctx.arc(gx - 4 + ex * 1.5, gy - 4 + ey * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(gx + 4 + ex * 1.5, gy - 4 + ey * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  #drawFrightenedFace(gx, gy) {
    const ctx = this.#ctx;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(gx - 3, gy - 3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(gx + 3, gy - 3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const mx = (gx - 5) + (i * 2.5);
      const my = i % 2 === 0 ? gy + 1 : gy + 3;
      i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
    }
    ctx.stroke();
  }

  #drawEyesOnly(gx, gy, player, ghost) {
    const ctx = this.#ctx;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(gx - 4, gy - 2, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(gx + 4, gy - 2, 3, 4, 0, 0, Math.PI * 2); ctx.fill();

    const dx  = player.x - ghost.x;
    const dy  = player.y - ghost.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ex  = dx / len, ey = dy / len;
    ctx.fillStyle = '#00f';
    ctx.beginPath(); ctx.arc(gx - 4 + ex * 1.5, gy - 2 + ey * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(gx + 4 + ex * 1.5, gy - 2 + ey * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
  }
}
