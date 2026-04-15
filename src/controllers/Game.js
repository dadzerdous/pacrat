// Game.js
// Top-level orchestrator. Owns every model-layer object, wires callbacks
// between them, and runs the tick loop.
//
// The tick loop itself is deliberately short — it reads top-to-bottom like
// a sentence. Each phase delegates to a named private helper so drilling
// into "what happens during entity updates" is one click away.
//
// Game is the only class that knows about all the others. Everything below
// it receives its collaborators through constructor args or callbacks — no
// globals, no ambient references, no "reach up" to Game.

import { Maze } from '../models/Maze.js';
import { Pacman } from '../models/Pacman.js';
import { Ghost } from '../models/Ghost.js';
import { ghostTargets } from '../const/ghostAI.js';
import { ModeScheduler } from './ModeScheduler.js';
import { CollisionSystem } from './CollisionSystem.js';
import { StateMachine } from './StateMachine.js';
import { LEVEL_1 } from '../maze-templates/MazeTemplate.js';

const STARTING_LIVES = 3;
const DEATH_ANIMATION_MS = 1500;   // how long the death spiral plays before respawn or game-over

// Ghost spawn positions and AI bindings. Kept here (not inside Ghost) because
// this is configuration — which brain goes in which body — not behavior.
const GHOST_CONFIG = [
  { name: 'blinky', color: '#FF0000', spawn: { x: 13.5, y: 11 }, targetFn: ghostTargets.blinky },
  { name: 'pinky',  color: '#FFB8FF', spawn: { x: 13.5, y: 14 }, targetFn: ghostTargets.pinky  },
  { name: 'inky',   color: '#00FFFF', spawn: { x: 11.5, y: 14 }, targetFn: ghostTargets.inky   },
  { name: 'clyde',  color: '#FFB852', spawn: { x: 15.5, y: 14 }, targetFn: ghostTargets.clyde  },
];

export class Game {
  constructor({ renderer, inputController, hud }) {
    // Injected collaborators. Renderer and HUD are View; InputController
    // is the Controller in MVC terms. Game doesn't construct them — whoever
    // sets up the page (main.js) hands them in already wired to the DOM.
    this.#renderer = renderer;
    this.#input = inputController;
    this.#hud = hud;

    // Model construction. Order matters: CollisionSystem needs callbacks
    // that reference ModeScheduler and StateMachine, so those come first.
    this.#maze = new Maze(LEVEL_1);
    this.#pacman = new Pacman();
    this.#ghosts = GHOST_CONFIG.map(cfg => new Ghost(cfg));
    this.#blinky = this.#ghosts.find(g => g.name === 'blinky');

    this.#modeScheduler = new ModeScheduler(this.#ghosts);

    this.#collisions = new CollisionSystem({
      onScore:        (pts)        => this.#addScore(pts),
      onPelletEaten:  ()           => this.#modeScheduler.onPelletEaten(),
      onPacmanCaught: ()           => this.#stateMachine.transition('dying'),
      onGhostEaten:   (_g, _pts)   => {},  // CollisionSystem handles ghost.eat() internally
    });

    // StateMachine defined last because its hooks close over everything above.
    this.#stateMachine = new StateMachine({
      ready:   { onEnter: () => this.#hud.setMessage('PRESS SPACE TO START') },
      playing: { onEnter: () => this.#hud.setMessage('') },
      dying:   { onEnter: () => this.#enterDying() },
      over:    { onEnter: () => this.#enterOver() },
      win:     { onEnter: () => this.#enterWin() },
    }, 'ready');

    // Wire input. InputController emits high-level intents — the raw
    // keyboard/touch mapping is its problem, not ours.
    this.#input.onDirection = (dir) => this.#pacman.queueDirection(dir);
    this.#input.onStart = () => this.#handleStartPress();

    // Round-level state (not per-level — survives across deaths).
    this.#score = 0;
    this.#highScore = 0;
    this.#lives = STARTING_LIVES;
    this.#hud.setScore(this.#score);
    this.#hud.setLives(this.#lives);
  }

  // --- Private fields (declared so the shape is visible at a glance) ---
  #renderer; #input; #hud;
  #maze; #pacman; #ghosts; #blinky;
  #modeScheduler; #collisions; #stateMachine;
  #score; #highScore; #lives;
  #rafHandle;

  // ================================================================
  //  PUBLIC ENTRY POINTS
  // ================================================================

  /** Start the animation loop. Called once by main.js after construction. */
  start() {
    const loop = () => {
      this.#tick();
      this.#rafHandle = requestAnimationFrame(loop);
    };
    loop();
  }

  // ================================================================
  //  TICK LOOP
  // ================================================================
  //
  //  The whole frame in six lines. Each helper is small and named for
  //  its responsibility — read top-to-bottom to see the frame's shape,
  //  drill into any helper to see the details.

  #tick() {
    if (this.#stateMachine.current === 'playing') {
      this.#updateEntities();
      this.#resolveInteractions();
      this.#checkWinCondition();
    }
    this.#render();
  }

  #updateEntities() {
    // Pacman first — Inky's AI targets relative to Pacman's position, so
    // ghosts should react to where Pacman is *now*, not last frame.
    this.#pacman.update(this.#maze);

    this.#modeScheduler.tick();

    for (const ghost of this.#ghosts) {
      if (!this.#modeScheduler.canGhostMove(ghost)) continue;
      ghost.update(this.#maze, this.#pacman, this.#blinky);
    }
  }

  #resolveInteractions() {
    this.#collisions.resolveDots(this.#pacman, this.#maze);
    this.#collisions.resolveGhosts(this.#pacman, this.#ghosts);
  }

  #checkWinCondition() {
    if (this.#maze.dotsRemaining === 0) {
      this.#stateMachine.transition('win');
    }
  }

  #render() {
    this.#renderer.draw({
      maze: this.#maze,
      pacman: this.#pacman,
      ghosts: this.#ghosts,
      modeScheduler: this.#modeScheduler,
      stateName: this.#stateMachine.current,
    });
  }

  // ================================================================
  //  STATE HANDLERS  (invoked by StateMachine onEnter hooks)
  // ================================================================

  /** Entered when CollisionSystem fires onPacmanCaught. Plays the death
   *  animation, then either respawns or transitions to 'over'. The timer
   *  is registered through StateMachine so a later transition cancels it. */
  #enterDying() {
    this.#pacman.kill();
    this.#lives--;
    this.#hud.setLives(this.#lives);

    this.#stateMachine.setTimer(() => {
      if (this.#lives < 0) {
        this.#stateMachine.transition('over');
      } else {
        this.#respawnRound();
        this.#stateMachine.transition('playing');
      }
    }, DEATH_ANIMATION_MS);
  }

  #enterOver() {
    this.#updateHighScore();
    this.#hud.setMessage('GAME OVER - SPACE');
  }

  #enterWin() {
    this.#updateHighScore();
    this.#hud.setMessage('YOU WIN! SPACE');
  }

  // ================================================================
  //  ROUND & GAME LIFECYCLE
  // ================================================================

  /** Start-of-life reset. Entities go back to spawn but maze + score persist.
   *  Called after each death. ModeScheduler.onPacmanDeath resets its timers
   *  so the house-exit rhythm replays. */
  #respawnRound() {
    this.#pacman = new Pacman();
    this.#ghosts = GHOST_CONFIG.map(cfg => new Ghost(cfg));
    this.#blinky = this.#ghosts.find(g => g.name === 'blinky');
    this.#modeScheduler = new ModeScheduler(this.#ghosts);

    // CollisionSystem keeps its callback wiring, but its combo counter
    // needs to reset so the next pellet starts fresh at 200.
    this.#collisions.resetCombo();
  }

  /** Full reset. Called when the player presses space from 'ready', 'over',
   *  or 'win'. Rebuilds everything from scratch. */
  #resetGame() {
    this.#score = 0;
    this.#lives = STARTING_LIVES;
    this.#hud.setScore(this.#score);
    this.#hud.setLives(this.#lives);

    this.#maze.reset();
    this.#respawnRound();
  }

  /** Space-bar handler. Starts a new game from any waiting state;
   *  ignored during 'playing' and 'dying' so mid-game spaces don't
   *  accidentally restart. */
  #handleStartPress() {
    const s = this.#stateMachine.current;
    if (s === 'ready' || s === 'over' || s === 'win') {
      this.#resetGame();
      this.#stateMachine.transition('playing');
    }
  }

  // ================================================================
  //  SCORE
  // ================================================================

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
