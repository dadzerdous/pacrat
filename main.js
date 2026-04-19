// main.js
// Entry point. Grabs DOM elements, builds all objects, and starts the loop.
// This and input.js are the only files that touch the DOM directly.

import { Game }     from './src/game.js';
import { Renderer } from './src/renderer.js';
import { HUD }      from './src/HUD.js';
import { Input }    from './src/input.js';

function requireEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`main.js: missing DOM element #${id}`);
  return el;
}

const canvas = requireEl('gameCanvas');

const hud = new HUD({
  scoreEl:      requireEl('score-val'),
  highEl:       requireEl('high-val'),
  messageEl:    requireEl('message'),
  lifeCanvases: [requireEl('life1'), requireEl('life2'), requireEl('life3')],
});

const renderer = new Renderer(canvas);

const input = new Input({
  buttons: {
    up:    document.getElementById('btn-up'),
    down:  document.getElementById('btn-down'),
    left:  document.getElementById('btn-left'),
    right: document.getElementById('btn-right'),
    god:   document.getElementById('btn-god'),
    pause: document.getElementById('btn-pause'),
  },
  canvas,
});

const game = new Game({ renderer, input, hud });
game.start();
