import { createScene } from './scene.js';
import { createBall } from './ball.js';
import { createAudioDetector, NOTES } from './audio.js';
import { createSpawner } from './spawner.js';
import { checkCollision } from './collision.js';
import { createGameState, State } from './gamestate.js';
import { createPitchGraph } from './pitchgraph.js';

const canvas = document.getElementById('game-canvas');
const overlayStart = document.getElementById('overlay-start');
const overlayPause = document.getElementById('overlay-pause');
const btnStart = document.getElementById('btn-start');
const streakDisplay = document.getElementById('streak-display');
const detectedNoteEl = document.getElementById('detected-note');
const pitchIndicator = document.getElementById('pitch-indicator');
const pitchLanes = document.getElementById('pitch-lanes');
const pitchGraphContainer = document.getElementById('pitch-graph-container');

const { scene, render, scrollRoad, followBallZ } = createScene(canvas);
const ball = createBall(scene);
const audio = createAudioDetector();
const spawner = createSpawner(scene);
const gameState = createGameState();
const pitchGraph = createPitchGraph(pitchGraphContainer);

buildLaneLabels();

let prevTime = 0;
let blockedWall = null;
let graphVisible = false;

gameState.on((snap) => {
  streakDisplay.textContent = snap.streak;
  streakDisplay.classList.toggle('visible', snap.state === State.PLAYING && snap.streak > 0);

  if (snap.state === State.PAUSED) {
    overlayPause.classList.remove('hidden');
  } else {
    overlayPause.classList.add('hidden');
  }
});

btnStart.addEventListener('click', startGame);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    const snap = gameState.snapshot();
    if (snap.state === State.PLAYING || snap.state === State.PAUSED) {
      gameState.togglePause();
      if (gameState.snapshot().state === State.PLAYING) {
        prevTime = performance.now();
        requestAnimationFrame(loop);
      }
    }
  }

  if (e.code === 'KeyP' && !e.repeat) {
    graphVisible = true;
    pitchGraphContainer.classList.remove('hidden');
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyP') {
    graphVisible = false;
    pitchGraphContainer.classList.add('hidden');
  }
});

async function startGame() {
  overlayStart.classList.add('hidden');

  try {
    await audio.start();
  } catch (e) {
    alert('Microphone access is required to play.');
    return;
  }

  spawner.clear();
  ball.reset();
  blockedWall = null;
  gameState.play();
  prevTime = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  const snap = gameState.snapshot();
  if (snap.state !== State.PLAYING) {
    render();
    startIdleLoop();
    return;
  }

  const dt = Math.min((now - prevTime) / 1000, 0.1);
  prevTime = now;

  const pitch = audio.detectPitch();
  const lane = pitch ? audio.hzToLane(pitch.hz) : null;

  updateHUD(pitch, lane);

  if (graphVisible) {
    pitchGraph.push(lane);
    pitchGraph.draw();
  }

  ball.setLane(lane);
  ball.update(dt);
  followBallZ(ball.mesh.position.z, dt);

  if (!ball.isBouncing()) {
    spawner.update(dt, snap.wallsPassed, blockedWall);
    scrollRoad(dt);
  }

  if (blockedWall && !ball.isBouncing()) {
    const result = checkCollision(ball.mesh, blockedWall);
    if (result === 'pass') {
      blockedWall.passed = true;
      gameState.passWall();
      ball.flash(0x00ff00);
      blockedWall = null;
    } else if (result === 'blocked') {
      ball.bounceBack();
      ball.flash(0xff4444);
      gameState.bounce();
    }
  }

  if (!blockedWall) {
    for (const wall of spawner.getActiveWalls()) {
      if (wall.passed) continue;
      const result = checkCollision(ball.mesh, wall);
      if (result === 'pass') {
        wall.passed = true;
        gameState.passWall();
        ball.flash(0x00ff00);
      } else if (result === 'blocked') {
        blockedWall = wall;
        ball.bounceBack();
        ball.flash(0xff4444);
        gameState.bounce();
        break;
      }
    }
  }

  render();
  requestAnimationFrame(loop);
}

function updateHUD(pitch, lane) {
  if (lane != null) {
    const info = NOTES[lane];
    detectedNoteEl.textContent = `${info.solfege} / ${info.note}`;
    const pct = (lane / (NOTES.length - 1)) * 100;
    pitchIndicator.style.bottom = `${pct}%`;
    pitchIndicator.style.opacity = '1';
  } else {
    detectedNoteEl.textContent = '--';
    pitchIndicator.style.opacity = '0.3';
  }
}

function buildLaneLabels() {
  for (let i = 0; i < NOTES.length; i++) {
    const label = document.createElement('div');
    label.className = 'lane-label';
    const pct = (i / (NOTES.length - 1)) * 100;
    label.style.bottom = `${pct}%`;
    label.style.transform = 'translateY(50%)';
    label.textContent = NOTES[i].solfege;
    pitchLanes.appendChild(label);
  }
}

let idleRunning = false;

function startIdleLoop() {
  if (idleRunning) return;
  idleRunning = true;
  requestAnimationFrame(function idle() {
    render();
    if (gameState.snapshot().state !== State.PLAYING) {
      requestAnimationFrame(idle);
    } else {
      idleRunning = false;
    }
  });
}

startIdleLoop();
