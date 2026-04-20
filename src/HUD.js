// HUD.js
// DOM-based score/lives/message display. Event-driven — game.js calls
// setters only when values change, avoiding 60Hz DOM writes.
//
// All DOM targets are passed in at construction — HUD never queries the
// document itself, keeping it decoupled from page markup.

const ICON_SIZE = 18; // life icon canvas dimensions in px

export class HUD {
  /**
   * @param scoreEl      — <span> for current score
   * @param highEl       — <span> for high score
   * @param messageEl    — <div> for status messages
   * @param lifeCanvases — array of <canvas> nodes, one per life slot
   */
  constructor({ scoreEl, highEl, messageEl, lifeCanvases }) {
    this.#scoreEl   = scoreEl;
    this.#highEl    = highEl;
    this.#messageEl = messageEl;
    this.#lifeCtxs  = lifeCanvases.map(c => c.getContext('2d'));
  }

  #scoreEl; #highEl; #messageEl; #lifeCtxs;

  setScore(n)     { this.#scoreEl.textContent = n; }
  setHighScore(n) { this.#highEl.textContent = n; }
  setMessage(s)   { this.#messageEl.textContent = s; }

  /** Redraw life icons. Shows up to 10 icons, then falls back to a number. */
  setLives(lives) {
    const slots = this.#lifeCtxs.length; // up to 10
    const count = Math.max(0, lives);

    for (let i = 0; i < slots; i++) {
      const ctx = this.#lifeCtxs[i];
      ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

      if (count > slots) {
        // Too many for icons — first slot shows "x{n}", rest blank
        if (i === 0) this.#drawNumber(ctx, `x${count}`);
      } else {
        if (i < count) this.#drawIcon(ctx);
      }
    }
  }

  #drawIcon(ctx) {
    ctx.fillStyle   = '#FFD700';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(ICON_SIZE / 2, ICON_SIZE / 2);
    ctx.arc(ICON_SIZE / 2, ICON_SIZE / 2, 7, 0.3, Math.PI * 2 - 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  #drawNumber(ctx, text) {
    ctx.fillStyle    = '#FFD700';
    ctx.font         = `bold 8px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, ICON_SIZE / 2, ICON_SIZE / 2);
  }
}
