// main.js
// Entry point. Grabs DOM elements, constructs the view/controller/model
// objects in the right order, hands them to Game, and starts the loop.
//
// This is the only place in the codebase that touches `document` directly
// (alongside InputController, which owns keyboard/touch event binding).
// Everything else receives its DOM collaborators through constructor args.

import { Game } from './src/controllers/Game.js';
import { Renderer } from './src/views/Renderer.js';
import { HUD } from './src/views/HUD.js';
import { InputController } from './src/controllers/InputController.js';

// --- DOM lookups -------------------------------------------------------
// Done once at startup. If any of these are missing we throw early with
// a clear message — silent nulls propagated into Renderer/HUD produce
// cryptic errors later.

function requireEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`main.js: missing DOM element #${id}`);
  return el;
}

const canvas = requireEl('gameCanvas');

const hud = new HUD({
  scoreEl:     requireEl('score-val'),
  highEl:      requireEl('high-val'),
  messageEl:   requireEl('message'),
  lifeCanvases: [requireEl('life1'), requireEl('life2'), requireEl('life3')],
});

const renderer = new Renderer(canvas);

const input = new InputController({
  buttons: {
    up:    document.getElementById('btn-up'),
    down:  document.getElementById('btn-down'),
    left:  document.getElementById('btn-left'),
    right: document.getElementById('btn-right'),
  },
});

// --- Wire it up and go -------------------------------------------------

const game = new Game({ renderer, inputController: input, hud });
game.start();
