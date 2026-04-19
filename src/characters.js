// characters.js
// Character roster. Each entry defines the emoji shown in-game and on the
// select screen, plus stat modifiers relative to the defaults.
//
// To add a new character: add an entry here. Nothing else needs to change.
//
// Stats:
//   speed         — tiles per frame (default 0.12)
//   lives         — starting lives (default 3)
//   frightFrames  — how long ghosts stay frightened after a pellet (default 400)

export const CHARACTERS = [
  {
    id:           'rat',
    emoji:        '🐀',
    name:         'RAT',
    tagline:      'THE ORIGINAL',
    speed:        0.12,
    lives:        3,
    frightFrames: 400,
  },
  {
    id:           'ghost',
    emoji:        '👻',
    name:         'GHOST',
    tagline:      'FAST & FEARLESS',
    speed:        0.16,
    lives:        2,
    frightFrames: 250,
  },
  {
    id:           'wizard',
    emoji:        '🧙',
    name:         'WIZARD',
    tagline:      'PELLET MASTER',
    speed:        0.10,
    lives:        3,
    frightFrames: 700,
  },
  {
    id:           'robot',
    emoji:        '🤖',
    name:         'ROBOT',
    tagline:      'BUILT TOUGH',
    speed:        0.11,
    lives:        5,
    frightFrames: 300,
  },
];
