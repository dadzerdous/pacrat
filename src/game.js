// game.js
// Top-level orchestrator. Owns every model object, wires callbacks between
// them, and runs the tick loop via requestAnimationFrame.

import { Maze }          from './maze.js';
import { Player }        from './player.js';
import { Ghost }         from './ghost.js';
import { ghostTargets }  from './ghostAI.js';
import { Scheduler }     from './scheduler.js';
import { Collisions }    from './collisions.js';
import { StateMachine }  from './stateMachine.js';
import { generateLevel, getLevelConfig } from './levelgen.js';
import { CHARACTERS }    from './characters.js';

const DEATH_PAUSE_MS = 1500;

// All four ghost archetypes — sliced to ghostCount per level
const GHOST_ARCHETYPES = [
  { name: 'blinky', color: '#FF0000', targetFn: ghostTargets.blinky },
  { name: 'pinky',  color: '#FFB8FF', targetFn: ghostTargets.pinky  },
  { name: 'inky',   color: '#00FFFF', targetFn: ghostTargets.inky   },
  { name: 'clyde',  color: '#FFB852', targetFn: ghostTargets.clyde  },
];

export class Game {
  constructor({ renderer, input, hud, character = CHARACTERS[0] }) {
    this.#renderer   = renderer;
    this.#input      = input;
    this.#hud        = hud;
    this.#character  = character;
    this.#levelIndex = 0;

    this.#loadLevel(0);

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
  #godMode    = false;
  #freshStart = true;
  #spawnPoint;

  // ---- Public -----------------------------------------------------------

  start() {
    const loop = () => {
      this.#tick();
      requestAnimationFrame(loop);
    };
    loop();
  }

  // ---- Level loading ----------------------------------------------------

  #loadLevel(index) {
    const cfg = getLevelConfig(index);
    const { grid, playerSpawn, exitPos } = generateLevel(index);

    this.#maze = new Maze(grid, exitPos);

    // Store player spawn on maze so respawn can find it after a death
    this.#maze.playerSpawn = playerSpawn;

    // Ghost house centre — middle of the maze
    this.#spawnPoint = {
      x: Math.floor(this.#maze.cols / 2),
      y: Math.floor(this.#maze.rows / 2) - 1,
    };

    this.#player = new Player(this.#character, playerSpawn);

    const archetypes = GHOST_ARCHETYPES.slice(0, cfg.ghostCount);
    this.#ghosts = archetypes.map(a => new Ghost({
      name:     a.name,
      color:    a.color,
      targetFn: a.targetFn,
      spawn:    this.#spawnPoint,
      speed:    cfg.ghostSpeed,
    }));
    this.#blinky    = this.#ghosts.find(g => g.name === 'blinky') ?? this.#ghosts[0];
    this.#scheduler = new Scheduler(this.#ghosts, this.#spawnPoint, cfg.exitDelays);
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
    // Win = all dots eaten AND player steps on the exit tile
    const [col, row] = this.#player.tile();
    if (this.#maze.isOnExit(col, row)) {
      this.#states.transition('win');
    }
  }

  // ---- State handlers ---------------------------------------------------

  #enterDying() {
    this.#player.kill();
    if (!this.#godMode) {
      this.#lives--;
      this.#hud.setLives(this.#lives);
    }
    this.#states.setTimer(() => {
      if (this.#lives <= 0 && !this.#godMode) {
        this.#states.transition('over');
      } else {
        this.#respawn();
        this.#freshStart = false;
        this.#states.transition('ready');
      }
    }, DEATH_PAUSE_MS);
  }

  #enterOver() {
    this.#updateHighScore();
    this.#hud.setMessage('GAME OVER — MOVE TO RESTART');
  }

  #enterWin() {
    this.#updateHighScore();
    this.#hud.setMessage('LEVEL CLEAR! MOVE TO CONTINUE');
  }

  // ---- Lifecycle --------------------------------------------------------

  /** Respawn player and ghosts on current maze — dots stay eaten. */
  #respawn() {
    const cfg        = getLevelConfig(this.#levelIndex);
    const archetypes = GHOST_ARCHETYPES.slice(0, cfg.ghostCount);

    this.#player = new Player(this.#character, this.#maze.playerSpawn);
    this.#ghosts = archetypes.map(a => new Ghost({
      name:     a.name,
      color:    a.color,
      targetFn: a.targetFn,
      spawn:    this.#spawnPoint,
      speed:    cfg.ghostSpeed,
    }));
    this.#blinky    = this.#ghosts.find(g => g.name === 'blinky') ?? this.#ghosts[0];
    this.#scheduler = new Scheduler(this.#ghosts, this.#spawnPoint, cfg.exitDelays);
    this.#collisions.resetCombo();
  }

  #resetGame() {
    this.#score      = 0;
    this.#lives      = this.#character.lives;
    this.#levelIndex = 0;
    this.#freshStart = true;
    this.#hud.setScore(this.#score);
    this.#hud.setLives(this.#lives);
    this.#loadLevel(0);
  }

  #handleStart() {
    const s = this.#states.current;
    if (s === 'ready') {
      if (this.#freshStart) this.#resetGame();
      this.#freshStart = false;
      this.#states.transition('playing');
    } else if (s === 'over') {
      this.#resetGame();
      this.#freshStart = false;
      this.#states.transition('playing');
    } else if (s === 'win') {
      this.#levelIndex++;
      this.#loadLevel(this.#levelIndex);
      this.#freshStart = false;
      this.#states.transition('playing');
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
