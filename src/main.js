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
const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
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

gameState.on((snap) => {
  streakDisplay.textContent = snap.streak;
  streakDisplay.classList.toggle('visible', snap.state === State.PLAYING && snap.streak > 0);

  if (snap.state === State.PAUSED) {
    overlayPause.classList.remove('hidden');
    btnPause.textContent = '▶';
  } else {
    overlayPause.classList.add('hidden');
    btnPause.textContent = '⏸';
  }
});

btnStart.addEventListener('click', startGame);
btnResume.addEventListener('click', resumeGame);
btnPause.addEventListener('click', togglePause);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    const snap = gameState.snapshot();
    if (snap.state === State.PLAYING || snap.state === State.PAUSED) {
      togglePause();
    }
  }
});

function togglePause() {
  gameState.togglePause();
  if (gameState.snapshot().state === State.PLAYING) {
    prevTime = performance.now();
    requestAnimationFrame(loop);
  }
}

function resumeGame() {
  if (gameState.snapshot().state === State.PAUSED) {
    gameState.resume();
    prevTime = performance.now();
    requestAnimationFrame(loop);
  }
}

async function startGame() {
  overlayStart.classList.add('hidden');

  try {
    await audio.start();
  } catch (e) {
    alert('Microphone access is required to play. Please allow microphone permission and try again.');
    overlayStart.classList.remove('hidden');
    return;
  }

  spawner.clear();
  ball.reset();
  blockedWall = null;
  pitchGraphContainer.classList.add('active');
  btnPause.classList.remove('hidden');
  gameState.play();
  prevTime = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  const snap = gameState.snapshot();
  if (snap.state !== State.PLAYING) {
    // Keep graphs live during pause so player can tune pitch
    if (snap.state === State.PAUSED) {
      const pitch = audio.detectPitch();
      const lane = pitch ? audio.hzToLane(pitch.hz) : null;
      updateHUD(lane);
      pitchGraph.push(lane);
      pitchGraph.setFreqData(audio.getFrequencyData());
      pitchGraph.draw();
      render();
      requestAnimationFrame(loop);
    } else {
      render();
      startIdleLoop();
    }
    return;
  }

  const dt = Math.min((now - prevTime) / 1000, 0.1);
  prevTime = now;

  const pitch = audio.detectPitch();
  const lane = pitch ? audio.hzToLane(pitch.hz) : null;

  updateHUD(lane);
  pitchGraph.push(lane);
  pitchGraph.setFreqData(audio.getFrequencyData());
  pitchGraph.draw();

  ball.setLane(lane);
  ball.update(dt);
  followBallZ(ball.mesh.position.z, dt);

  if (blockedWall) {
    // World is fully frozen — no scrolling, no spawning, no other wall movement
    const result = checkCollision(ball.mesh, blockedWall);
    if (result === 'pass') {
      blockedWall.passed = true;
      gameState.passWall();
      ball.flash(0x00ff00);
      blockedWall = null;
    } else if (result === null) {
      // Ball escaped the contact zone (e.g. flew past) — unblock so game can continue
      blockedWall = null;
    } else if (!ball.isOnCooldown()) {
      // Cooldown expired — bounce again to signal wrong pitch
      ball.bounceBack();
      ball.flash(0xff4444);
      gameState.bounce();
    }
  } else {
    spawner.update(dt, snap.wallsPassed, null);
    scrollRoad(dt);
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

function updateHUD(lane) {
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
