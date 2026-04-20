// main.js
// Entry point. Grabs DOM elements, builds all objects, and starts the loop.
// Called by index.html after the character select screen resolves.
// Receives the chosen character via window.__selectedCharacter.

import { Game }       from './src/game.js';
import { Renderer }   from './src/renderer.js';
import { HUD }        from './src/HUD.js';
import { Input }      from './src/input.js';
import { CHARACTERS } from './src/characters.js';

function requireEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`main.js: missing DOM element #${id}`);
  return el;
}

const canvas = requireEl('gameCanvas');

const MAX_LIFE_ICONS = 10;
const livesContainer = requireEl('lives-icons');
const lifeCanvases = Array.from({ length: MAX_LIFE_ICONS }, (_, i) => {
  const c = document.createElement('canvas');
  c.width = 18;
  c.height = 18;
  c.className = 'life-icon';
  c.id = `life${i + 1}`;
  livesContainer.appendChild(c);
  return c;
});

const hud = new HUD({
  scoreEl:      requireEl('score-val'),
  highEl:       requireEl('high-val'),
  messageEl:    requireEl('message'),
  lifeCanvases,
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

// Character is set by the select screen before main.js loads.
// Falls back to the first character if somehow not set.
const character = window.__selectedCharacter ?? CHARACTERS[0];

const game = new Game({ renderer, input, hud, character });
game.start();
