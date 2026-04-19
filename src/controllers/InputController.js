// InputController.js
// The Controller in MVC. Owns every input source (keyboard, mouse click,
// touch swipe, mobile D-pad) and translates raw events into high-level intents:
//
//   onDirection(dir) — player wants to move/turn
//   onStart()        — player wants to start/restart
//
// Any directional input (key, swipe, d-pad) also fires onStart so the player
// never has to press Space first — just push a direction to begin.
//
// Game assigns these callbacks after construction. InputController doesn't
// hold a reference to Game or any model — it just fires events.

import { DIR } from '../const/direction.js';

const KEY_TO_DIR = {
  ArrowLeft:  DIR.LEFT,
  ArrowRight: DIR.RIGHT,
  ArrowUp:    DIR.UP,
  ArrowDown:  DIR.DOWN,
  a:          DIR.LEFT,
  d:          DIR.RIGHT,
  w:          DIR.UP,
  s:          DIR.DOWN,
};

// Minimum px distance a touch must travel to count as a swipe (not a tap).
const SWIPE_THRESHOLD = 24;

export class InputController {
  /**
   * @param buttons — { up, down, left, right } DOM elements for the D-pad.
   *                  Pass null to skip mobile button bindings.
   * @param canvas  — the game canvas, used for click-to-start and swipe detection.
   *                  Pass null to skip canvas bindings.
   */
  constructor({ buttons = null, canvas = null } = {}) {
    this.onDirection = () => {};
    this.onStart     = () => {};
    this.onGodMode   = () => {};
    this.onPause     = () => {};

    this.#bindKeyboard();
    if (buttons) this.#bindButtons(buttons);
    if (canvas)  this.#bindCanvas(canvas);
  }

  // Touch start position — stored so we can compute swipe delta on touchend.
  #touchStartX = 0;
  #touchStartY = 0;

  // ---- Keyboard -------------------------------------------------------

  #bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        this.onStart();
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        this.onGodMode();
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        this.onPause();
        return;
      }
      const dir = KEY_TO_DIR[e.key];
      if (dir) {
        e.preventDefault();
        // Direction key always also fires onStart — lets the player begin the
        // game by just pressing a movement key instead of Space first.
        this.onStart();
        this.onDirection(dir);
      }
    });
  }

  // ---- Canvas: click-to-start + swipe-to-move -------------------------

  #bindCanvas(canvas) {
    // A plain click anywhere on the canvas triggers start (e.g. clicking to
    // resume after game-over without hunting for the Space key).
    canvas.addEventListener('click', () => {
      this.onStart();
    });

    // Touch swipe: record start position on touchstart, resolve direction
    // and fire on touchend. We only care about the dominant axis (the one
    // with the larger delta) so diagonal swipes still produce clean cardinal
    // directions.
    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.#touchStartX = t.clientX;
      this.#touchStartY = t.clientY;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - this.#touchStartX;
      const dy = t.clientY - this.#touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Below threshold = tap, not swipe. Treat as a start press only.
      if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
        this.onStart();
        return;
      }

      // Dominant axis wins.
      let dir;
      if (absDx > absDy) {
        dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
      } else {
        dir = dy > 0 ? DIR.DOWN : DIR.UP;
      }

      this.onStart();
      this.onDirection(dir);
    }, { passive: true });
  }

  // ---- Mobile D-pad buttons -------------------------------------------

  #bindButtons({ up, down, left, right }) {
    const bind = (el, dir) => {
      if (!el) return;
      el.addEventListener('click', () => {
        this.onStart();
        this.onDirection(dir);
      });
    };
    bind(up,    DIR.UP);
    bind(down,  DIR.DOWN);
    bind(left,  DIR.LEFT);
    bind(right, DIR.RIGHT);
  }
}
