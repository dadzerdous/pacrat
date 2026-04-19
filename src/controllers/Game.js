// Game.js
// Top-level orchestrator. Owns every model-layer object, wires callbacks
// between them, and runs the tick loop.

import { Maze } from '../models/Maze.js';
import { Pacman } from '../models/Pacman.js';
import { Ghost } from '../models/Ghost.js';
import { ghostTargets } from '../const/ghostAI.js';
import { ModeScheduler } from './ModeScheduler.js';
import { CollisionSystem } from './CollisionSystem.js';
import { StateMachine } from './StateMachine.js';
import { LEVELS } from '../maze-templates/MazeTemplate.js';

const STARTING_LIVES = 3;
const DEATH_ANIMATION_MS = 1500;

const GHOST_CONFIG = [
  { name: 'blinky', color: '#FF0000', spawn: { x: 13, y: 11 }, targetFn: ghostTargets.blinky },
  { name: 'pinky',  color: '#FFB8FF', spawn: { x: 13, y: 14 }, targetFn: ghostTargets.pinky  },
  { name: 'inky',   color: '#00FFFF', spawn: { x: 12, y: 14 }, targetFn: ghostTargets.inky   },
  { name: 'clyde',  color: '#FFB852', spawn: { x: 14, y: 14 }, targetFn: ghostTargets.clyde  },
];

export class Game {
  constructor({ renderer, inputController, hud }) {
    this.#renderer = renderer;
    this.#input = inputController;
    this.#hud = hud;

    this.#levelIndex = 0;
    this.#maze = new Maze(LEVELS[0]);
    this.#pacman = new Pacman();
    this.#ghosts = GHOST_CONFIG.map(cfg => new Ghost(cfg));
    this.#blinky = this.#ghosts.find(g => g.name === 'blinky');

    this.#modeScheduler = new ModeScheduler(this.#ghosts);

    this.#collisions = new CollisionSystem({
      onScore:        (pts)      => this.#addScore(pts),
      onPelletEaten:  ()         => this.#modeScheduler.onPelletEaten(),
      onPacmanCaught: ()         => this.#stateMachine.transition('dying'),
      onGhostEaten:   (_g, _pts) => {},
    });

    this.#stateMachine = new StateMachine({
      ready:   { onEnter: () => this.#hud.setMessage('MOVE TO START') },
      playing: { onEnter: () => this.#hud.setMessage('') },
      paused:  { onEnter: () => this.#hud.setMessage('PAUSED') },
      dying:   { onEnter: () => this.#enterDying() },
      over:    { onEnter: () => this.#enterOver() },
      win:     { onEnter: () => this.#enterWin() },
    }, 'ready');

    this.#input.onDirection = (dir) => {
      // If the game is waiting to start, a direction press starts it too.
      const s = this.#stateMachine.current;
      if (s === 'ready' || s === 'over' || s === 'win') this.#handleStartPress();
      this.#pacman.queueDirection(dir);
    };
    this.#input.onStart = () => this.#handleStartPress();
    this.#input.onGodMode = () => this.#toggleGodMode();
    this.#input.onPause = () => this.#handlePause();

    this.#score = 0;
    this.#highScore = 0;
    this.#lives = STARTING_LIVES;
    this.#hud.setScore(this.#score);
    this.#hud.setLives(this.#lives);
  }

  #renderer; #input; #hud;
  #maze; #pacman; #ghosts; #blinky;
  #modeScheduler; #collisions; #stateMachine;
  #score; #highScore; #lives;
  #levelIndex;
  #godMode = false;
  #rafHandle;

  // ================================================================
  //  PUBLIC ENTRY POINTS
  // ================================================================

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

  #tick() {
    if (this.#stateMachine.current === 'playing') {
      this.#updateEntities();
      this.#resolveInteractions();
      this.#checkWinCondition();
    }
    this.#render();
  }

  #updateEntities() {
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
  //  STATE HANDLERS
  // ================================================================

  #enterDying() {
    this.#pacman.kill();
    if (!this.#godMode) {
      this.#lives--;
      this.#hud.setLives(this.#lives);
    }

    this.#stateMachine.setTimer(() => {
      if (this.#lives < 0 && !this.#godMode) {
        this.#stateMachine.transition('over');
      } else {
        this.#respawnRound();
        this.#stateMachine.transition('ready');
      }
    }, DEATH_ANIMATION_MS);
  }

  #enterOver() {
    this.#updateHighScore();
    this.#hud.setMessage('GAME OVER - MOVE TO RESTART');
  }

  #enterWin() {
    this.#updateHighScore();
    if (this.#levelIndex < LEVELS.length - 1) {
      this.#hud.setMessage('LEVEL CLEAR! MOVE TO CONTINUE');
    } else {
      this.#hud.setMessage('YOU WIN! MOVE TO RESTART');
    }
  }

  // ================================================================
  //  ROUND & GAME LIFECYCLE
  // ================================================================

  #respawnRound() {
    this.#pacman = new Pacman();
    this.#ghosts = GHOST_CONFIG.map(cfg => new Ghost(cfg));
    this.#blinky = this.#ghosts.find(g => g.name === 'blinky');
    this.#modeScheduler = new ModeScheduler(this.#ghosts);
    this.#collisions.resetCombo();
  }

  #resetGame() {
    this.#score = 0;
    this.#lives = STARTING_LIVES;
    this.#levelIndex = 0;
    this.#hud.setScore(this.#score);
    this.#hud.setLives(this.#lives);

    this.#maze.loadTemplate(LEVELS[0]);
    this.#respawnRound();
  }

  #handleStartPress() {
    const s = this.#stateMachine.current;
    if (s === 'ready' || s === 'over') {
      this.#resetGame();
      this.#stateMachine.transition('playing');
    } else if (s === 'win') {
      if (this.#levelIndex < LEVELS.length - 1) {
        // More levels — advance. Score and lives carry over.
        this.#levelIndex++;
        this.#maze.loadTemplate(LEVELS[this.#levelIndex]);
        this.#respawnRound();
        this.#stateMachine.transition('playing');
      } else {
        // Last level beaten — full restart from level 1.
        this.#resetGame();
        this.#stateMachine.transition('playing');
      }
    }
  }

  // ================================================================
  //  GOD MODE
  // ================================================================

  #toggleGodMode() {
    this.#godMode = !this.#godMode;
    this.#hud.setMessage(this.#godMode ? 'GOD MODE ON' : 'GOD MODE OFF');
    if (this.#stateMachine.current === 'playing') {
      setTimeout(() => {
        if (this.#stateMachine.current === 'playing') {
          this.#hud.setMessage('');
        }
      }, 1000);
    }
  }

  // ================================================================
  //  GOD MODE
  // ================================================================
  #handlePause() {
    const s = this.#stateMachine.current;
    if (s === 'playing') {
      this.#stateMachine.transition('paused');
    } else if (s === 'paused') {
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
