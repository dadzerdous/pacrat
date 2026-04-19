// game.js
// Top-level orchestrator. Owns every model object, wires callbacks between
// them, and runs the tick loop via requestAnimationFrame.

import { Maze }        from './maze.js';
import { Player }      from './player.js';
import { Ghost }       from './ghost.js';
import { ghostTargets } from './ghostAI.js';
import { Scheduler }   from './scheduler.js';
import { Collisions }  from './collisions.js';
import { StateMachine } from './stateMachine.js';
import { LEVELS }      from './levels.js';
import { CHARACTERS }  from './characters.js';

const DEATH_PAUSE_MS    = 1500;

const GHOST_CONFIG = [
  { name: 'blinky', color: '#FF0000', spawn: { x: 13, y: 11 }, targetFn: ghostTargets.blinky },
  { name: 'pinky',  color: '#FFB8FF', spawn: { x: 13, y: 14 }, targetFn: ghostTargets.pinky  },
  { name: 'inky',   color: '#00FFFF', spawn: { x: 12, y: 14 }, targetFn: ghostTargets.inky   },
  { name: 'clyde',  color: '#FFB852', spawn: { x: 14, y: 14 }, targetFn: ghostTargets.clyde  },
];

export class Game {
  constructor({ renderer, input, hud, character = CHARACTERS[0] }) {
    this.#renderer  = renderer;
    this.#input     = input;
    this.#hud       = hud;
    this.#character = character;

    this.#levelIndex = 0;
    this.#maze   = new Maze(LEVELS[0]);
    this.#player = new Player(this.#character);
    this.#ghosts = GHOST_CONFIG.map(cfg => new Ghost(cfg));
    this.#blinky = this.#ghosts.find(g => g.name === 'blinky');

    this.#scheduler = new Scheduler(this.#ghosts);

    this.#collisions = new Collisions({
      onScore:        (pts) => this.#addScore(pts),
      onPelletEaten:  ()    => this.#scheduler.onPelletEaten(this.#character.frightFrames),
      onPlayerCaught: ()    => this.#states.transition('dying'),
      onGhostEaten:   ()    => {},
    });

    this.#states = new StateMachine({
      ready:   { onEnter: () => this.#hud.setMessage('MOVE TO START') },
      playing: { onEnter: () => this.#hud.setMessage('') },
      paused:  { onEnter: () => this.#hud.setMessage('PAUSED') },
      dying:   { onEnter: () => this.#enterDying() },
      over:    { onEnter: () => this.#enterOver() },
      win:     { onEnter: () => this.#enterWin() },
    }, 'ready');

    // Wire input callbacks
    this.#input.onDirection = (dir) => {
      const s = this.#states.current;
      if (s === 'ready' || s === 'over' || s === 'win') this.#handleStart();
      this.#player.queueDirection(dir);
    };
    this.#input.onStart   = () => this.#handleStart();
    this.#input.onGodMode = () => this.#toggleGodMode();
    this.#input.onPause   = () => this.#handlePause();

    this.#score     = 0;
    this.#highScore = 0;
    this.#lives     = this.#character.lives;
    this.#hud.setScore(this.#score);
    this.#hud.setLives(this.#lives);
  }

  #renderer; #input; #hud; #character;
  #maze; #player; #ghosts; #blinky;
  #scheduler; #collisions; #states;
  #score; #highScore; #lives; #levelIndex;
  #godMode = false;

  // ---- Public -----------------------------------------------------------

  start() {
    const loop = () => {
      this.#tick();
      requestAnimationFrame(loop);
    };
    loop();
  }

  // ---- Tick loop --------------------------------------------------------

  #tick() {
    if (this.#states.current === 'playing') {
      this.#updateEntities();
      this.#resolveCollisions();
      this.#checkWin();
    }
    this.#renderer.draw({
      maze:      this.#maze,
      player:    this.#player,
      ghosts:    this.#ghosts,
      scheduler: this.#scheduler,
      stateName: this.#states.current,
    });
  }

  #updateEntities() {
    this.#player.update(this.#maze);
    this.#scheduler.tick();
    for (const ghost of this.#ghosts) {
      if (!this.#scheduler.canGhostMove(ghost)) continue;
      ghost.update(this.#maze, this.#player, this.#blinky);
    }
  }

  #resolveCollisions() {
    this.#collisions.resolveDots(this.#player, this.#maze);
    this.#collisions.resolveGhosts(this.#player, this.#ghosts);
  }

  #checkWin() {
    if (this.#maze.dotsRemaining === 0) this.#states.transition('win');
  }

  // ---- State handlers ---------------------------------------------------

  #enterDying() {
    this.#player.kill();
    if (!this.#godMode) {
      this.#lives--;
      this.#hud.setLives(this.#lives);
    }
    this.#states.setTimer(() => {
      if (this.#lives < 0 && !this.#godMode) {
        this.#states.transition('over');
      } else {
        this.#respawn();
        this.#states.transition('ready'); // player must input to resume
      }
    }, DEATH_PAUSE_MS);
  }

  #enterOver() {
    this.#updateHighScore();
    this.#hud.setMessage('GAME OVER — MOVE TO RESTART');
  }

  #enterWin() {
    this.#updateHighScore();
    this.#hud.setMessage(
      this.#levelIndex < LEVELS.length - 1
        ? 'LEVEL CLEAR! MOVE TO CONTINUE'
        : 'YOU WIN! MOVE TO RESTART'
    );
  }

  // ---- Lifecycle --------------------------------------------------------

  #respawn() {
    this.#player  = new Player(this.#character);
    this.#ghosts  = GHOST_CONFIG.map(cfg => new Ghost(cfg));
    this.#blinky  = this.#ghosts.find(g => g.name === 'blinky');
    this.#scheduler = new Scheduler(this.#ghosts);
    this.#collisions.resetCombo();
  }

  #resetGame() {
    this.#score      = 0;
    this.#lives      = this.#character.lives;
    this.#levelIndex = 0;
    this.#hud.setScore(this.#score);
    this.#hud.setLives(this.#lives);
    this.#maze.loadTemplate(LEVELS[0]);
    this.#respawn();
  }

  #handleStart() {
    const s = this.#states.current;
    if (s === 'ready' || s === 'over') {
      this.#resetGame();
      this.#states.transition('playing');
    } else if (s === 'win') {
      if (this.#levelIndex < LEVELS.length - 1) {
        this.#levelIndex++;
        this.#maze.loadTemplate(LEVELS[this.#levelIndex]);
        this.#respawn();
        this.#states.transition('playing');
      } else {
        this.#resetGame();
        this.#states.transition('playing');
      }
    }
  }

  // ---- God mode ---------------------------------------------------------

  #toggleGodMode() {
    this.#godMode = !this.#godMode;
    this.#hud.setMessage(this.#godMode ? 'GOD MODE ON' : 'GOD MODE OFF');
    if (this.#states.current === 'playing') {
      setTimeout(() => {
        if (this.#states.current === 'playing') this.#hud.setMessage('');
      }, 1000);
    }
  }

  // ---- Pause ------------------------------------------------------------

  #handlePause() {
    const s = this.#states.current;
    if      (s === 'playing') this.#states.transition('paused');
    else if (s === 'paused')  this.#states.transition('playing');
  }

  // ---- Score ------------------------------------------------------------

  #addScore(points) {
    this.#score += points;
    this.#hud.setScore(this.#score);
  }

  #updateHighScore() {
    if (this.#score > this.#highScore) {
      this.#highScore = this.#score;
      this.#hud.setHighScore(this.#highScore);
    }
  }
}
