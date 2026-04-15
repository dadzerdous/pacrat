// HUD.js
// DOM-based score/lives/message display. Event-driven — Game calls setters
// when values change, not every frame. This avoids 60Hz DOM writes for
// values that change rarely.
//
// Owns four DOM targets, all passed in at construction so HUD doesn't
// query the document itself (keeps it testable and decoupled from page markup).

const CELL = 18;  // life icon canvas is 18×18; not the grid CELL size

export class HUD {
  /**
   * @param elements — { scoreEl, highEl, messageEl, lifeCanvases }
   *                   scoreEl/highEl/messageEl are <span> or <div> nodes
   *                   lifeCanvases is an array of <canvas> nodes (one per life slot)
   */
  constructor({ scoreEl, highEl, messageEl, lifeCanvases }) {
    this.#scoreEl = scoreEl;
    this.#highEl = highEl;
    this.#messageEl = messageEl;
    this.#lifeCanvases = lifeCanvases;

    // Pre-grab 2D contexts for each life canvas so setLives doesn't re-query every call.
    this.#lifeCtxs = lifeCanvases.map(c => c.getContext('2d'));
  }

  #scoreEl; #highEl; #messageEl; #lifeCanvases; #lifeCtxs;

  setScore(n)     { this.#scoreEl.textContent = n; }
  setHighScore(n) { this.#highEl.textContent = n; }
  setMessage(s)   { this.#messageEl.textContent = s; }

  /** Redraw life icons. `lives` is the current count — we show lives+1 icons
   *  (one for the life being played, plus each in reserve), matching arcade convention. */
  setLives(lives) {
    const shown = Math.max(0, lives + 1);
    for (let i = 0; i < this.#lifeCtxs.length; i++) {
      const ctx = this.#lifeCtxs[i];
      ctx.clearRect(0, 0, CELL, CELL);
      if (i < shown) this.#drawLifeIcon(ctx);
    }
  }

  #drawLifeIcon(ctx) {
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(CELL / 2, CELL / 2);
    ctx.arc(CELL / 2, CELL / 2, 7, 0.3, Math.PI * 2 - 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
