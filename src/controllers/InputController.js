// InputController.js
// The Controller in MVC. Owns every input source (keyboard, mobile D-pad,
// whatever comes next) and translates raw events into two high-level intents:
//
//   onDirection(dir) — player wants to move/turn
//   onStart()        — player pressed the start/restart key
//
// Game assigns these callbacks after construction. InputController doesn't
// hold a reference to Game, Pacman, or anything downstream — it just fires
// events. This is what lets us swap input sources (add gamepad support,
// disable keyboard for a demo mode) without touching model code.

import { DIR } from '../const/direction.js';

// Keys that map to directions. Arrow keys and WASD both supported — WASD
// because left-hand-only is comfortable for long sessions, arrows because
// that's what people reach for first.
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

export class InputController {
  /**
   * @param buttons — map of direction → DOM element for the mobile D-pad.
   *                  Shape: { up, down, left, right }. Pass null to skip
   *                  mobile bindings (e.g. in a headless test).
   */
  constructor({ buttons = null } = {}) {
    // Callbacks are public fields — Game overwrites them after construction.
    // Default to no-ops so InputController is safe to use before wiring.
    this.onDirection = () => {};
    this.onStart = () => {};

    this.#bindKeyboard();
    if (buttons) this.#bindButtons(buttons);
  }

  #bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Space is the universal start/restart key. Checking both code and key
      // because some browsers/layouts report one but not the other.
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();   // stop the page from scrolling on space
        this.onStart();
        return;
      }

      const dir = KEY_TO_DIR[e.key];
      if (dir) {
        e.preventDefault();   // arrow keys also scroll the page by default
        this.onDirection(dir);
      }
    });
  }

  #bindButtons({ up, down, left, right }) {
    // Mobile D-pad. Each button fires a direction intent. We also treat a
    // button press as "start" when the game is waiting — Game decides which
    // based on current state. Doing it here would mean InputController needs
    // to know the state, which breaks the separation.
    //
    // Using 'click' not 'touchstart': click works for both mouse and touch,
    // and the 300ms tap delay that used to plague touch UIs is gone on
    // modern browsers with a proper viewport meta tag.
    const bind = (el, dir) => {
      if (!el) return;
      el.addEventListener('click', () => {
        this.onStart();       // harmless if state isn't 'ready'/'over'/'win'
        this.onDirection(dir);
      });
    };
    bind(up,    DIR.UP);
    bind(down,  DIR.DOWN);
    bind(left,  DIR.LEFT);
    bind(right, DIR.RIGHT);
  }
}
