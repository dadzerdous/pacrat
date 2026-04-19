// input.js
// Owns every input source and translates raw events into high-level intents:
//
//   onDirection(dir) — player wants to move/turn
//   onStart()        — player wants to start/restart
//   onGodMode()      — toggle god mode
//   onPause()        — toggle pause
//
// Any directional input also fires onStart so the player can begin the game
// by simply pressing a direction rather than hunting for Space first.
//
// Game assigns these callbacks after construction. This file never touches
// any game model — it only fires events.

import { DIR } from './constants.js';

const KEY_TO_DIR = {
  ArrowLeft:  DIR.LEFT,
  ArrowRight: DIR.RIGHT,
  ArrowUp:    DIR.UP,
  ArrowDown:  DIR.DOWN,
  a: DIR.LEFT,
  d: DIR.RIGHT,
  w: DIR.UP,
  s: DIR.DOWN,
};

const SWIPE_THRESHOLD = 24; // minimum px travel to register as a swipe

export class Input {
  /**
   * @param buttons — { up, down, left, right, god, pause } DOM elements
   * @param canvas  — game canvas (click-to-start + swipe detection)
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

  #touchStartX = 0;
  #touchStartY = 0;

  // ---- Keyboard ---------------------------------------------------------

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
        this.onStart();      // direction key also starts the game
        this.onDirection(dir);
      }
    });
  }

  // ---- Canvas: click + swipe --------------------------------------------

  #bindCanvas(canvas) {
    canvas.addEventListener('click', () => this.onStart());

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

      if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
        this.onStart(); // tap = start only
        return;
      }

      const dir = absDx > absDy
        ? (dx > 0 ? DIR.RIGHT : DIR.LEFT)
        : (dy > 0 ? DIR.DOWN  : DIR.UP);

      this.onStart();
      this.onDirection(dir);
    }, { passive: true });
  }

  // ---- D-pad buttons ----------------------------------------------------

  #bindButtons({ up, down, left, right, god, pause }) {
    const bindDir = (el, dir) => {
      if (!el) return;
      el.addEventListener('click', () => {
        this.onStart();
        this.onDirection(dir);
      });
    };
    bindDir(up,    DIR.UP);
    bindDir(down,  DIR.DOWN);
    bindDir(left,  DIR.LEFT);
    bindDir(right, DIR.RIGHT);

    if (god)   god.addEventListener('click',   () => this.onGodMode());
    if (pause) pause.addEventListener('click', () => this.onPause());
  }
}
