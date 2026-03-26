import { NOTES } from './audio.js';

// Pitch history config: ~12 seconds at 60fps sampled every 4 frames
const SAMPLE_EVERY = 4;
const HISTORY_SECONDS = 12;
const HISTORY_SIZE = Math.round((60 / SAMPLE_EVERY) * HISTORY_SECONDS);

// Spectrum smoothing: higher = slower/smoother
const SPEC_SMOOTH_RISE = 0.85;  // for rising bars
const SPEC_SMOOTH_FALL = 0.6;   // for falling bars (fall a bit faster)

const NOTE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

const SPEC_MIN_HZ = 180;
const SPEC_MAX_HZ = 580;

export function createPitchGraph(containerEl) {
  const isMobile = window.innerWidth < 700;
  const W = isMobile ? Math.min(window.innerWidth - 16, 360) : 420;
  const SPEC_H = isMobile ? 80 : 100;
  const HIST_H = isMobile ? 110 : 150;
  const GAP = 5;
  const TOTAL_H = SPEC_H + GAP + HIST_H;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = TOTAL_H;
  containerEl.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const history = [];
  let frameCount = 0;
  let lastFreqResult = null;
  let smoothedBars = null; // exponentially smoothed bar heights [0..1]

  function push(lane) {
    frameCount++;
    if (frameCount % SAMPLE_EVERY === 0) {
      history.push(lane);
      if (history.length > HISTORY_SIZE) history.shift();
    }
  }

  function setFreqData(freqResult) {
    lastFreqResult = freqResult;
  }

  function draw() {
    ctx.clearRect(0, 0, W, TOTAL_H);
    drawBackground(0, 0, W, SPEC_H);
    drawSpectrum(0, 0, W, SPEC_H);
    drawBackground(0, SPEC_H + GAP, W, HIST_H);
    drawHistory(0, SPEC_H + GAP, W, HIST_H);
  }

  function drawBackground(x, y, w, h) {
    ctx.fillStyle = 'rgba(6, 6, 20, 0.94)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.stroke();
  }

  function drawSpectrum(ox, oy, w, h) {
    const margin = { top: 18, bottom: 20, left: 8, right: 8 };
    const pw = w - margin.left - margin.right;
    const ph = h - margin.top - margin.bottom;

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `bold ${isMobile ? 8 : 9}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('FREQUENCY SPECTRUM', ox + margin.left, oy + 4);

    if (!lastFreqResult) return;

    const { data, sampleRate, binCount } = lastFreqResult;
    const nyquist = sampleRate / 2;
    const minBin = Math.floor((SPEC_MIN_HZ / nyquist) * binCount);
    const maxBin = Math.ceil((SPEC_MAX_HZ / nyquist) * binCount);
    const binRange = maxBin - minBin;

    // Build smoothed bar array (one bar per pixel column)
    const numBars = Math.floor(pw);
    if (!smoothedBars || smoothedBars.length !== numBars) {
      smoothedBars = new Float32Array(numBars);
    }

    const floorDb = -80;
    const ceilDb = -10;

    for (let bar = 0; bar < numBars; bar++) {
      const binFrac = bar / numBars;
      const binIdx = minBin + Math.round(binFrac * (binRange - 1));
      const db = data[Math.min(binIdx, binCount - 1)];
      const raw = Math.max(0, (db - floorDb) / (ceilDb - floorDb));
      const prev = smoothedBars[bar];
      const alpha = raw > prev ? SPEC_SMOOTH_RISE : SPEC_SMOOTH_FALL;
      smoothedBars[bar] = prev * alpha + raw * (1 - alpha);
    }

    // Draw note zone shaded bands + labels
    for (let i = 0; i < NOTES.length; i++) {
      const hz = NOTES[i].hz;
      if (hz < SPEC_MIN_HZ || hz > SPEC_MAX_HZ) continue;
      const xFrac = (hz - SPEC_MIN_HZ) / (SPEC_MAX_HZ - SPEC_MIN_HZ);
      const nx = ox + margin.left + xFrac * pw;

      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(nx, oy + margin.top);
      ctx.lineTo(nx, oy + margin.top + ph);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = NOTE_COLORS[i];
      ctx.font = `bold ${isMobile ? 7 : 8}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(NOTES[i].solfege, nx, oy + h - 2);
    }

    // Draw smoothed bars
    const barW = pw / numBars;
    for (let bar = 0; bar < numBars; bar++) {
      const norm = smoothedBars[bar];
      if (norm < 0.005) continue;
      const bx = ox + margin.left + bar * barW;
      const bh = norm * ph;

      const hz = SPEC_MIN_HZ + (bar / numBars) * (SPEC_MAX_HZ - SPEC_MIN_HZ);
      let nearestNote = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < NOTES.length; i++) {
        const cents = Math.abs(1200 * Math.log2(hz / NOTES[i].hz));
        if (cents < nearestDist) { nearestDist = cents; nearestNote = i; }
      }

      ctx.fillStyle = nearestDist < 60
        ? NOTE_COLORS[nearestNote]
        : 'rgba(120,160,255,0.45)';
      ctx.fillRect(bx, oy + margin.top + ph - bh, Math.max(1, barW - 0.3), bh);
    }

    // Peak line
    let peakBar = 0;
    for (let bar = 1; bar < numBars; bar++) {
      if (smoothedBars[bar] > smoothedBars[peakBar]) peakBar = bar;
    }
    if (smoothedBars[peakBar] > 0.05) {
      const px = ox + margin.left + (peakBar / numBars) * pw;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, oy + margin.top);
      ctx.lineTo(px, oy + margin.top + ph);
      ctx.stroke();
    }
  }

  function drawHistory(ox, oy, w, h) {
    const margin = { top: 14, bottom: 8, left: 40, right: 8 };
    const pw = w - margin.left - margin.right;
    const ph = h - margin.top - margin.bottom;

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `bold ${isMobile ? 8 : 9}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('PITCH HISTORY', ox + margin.left, oy + 3);

    for (let i = 0; i < NOTES.length; i++) {
      const y = oy + margin.top + ph - (i / (NOTES.length - 1)) * ph;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox + margin.left, y);
      ctx.lineTo(ox + w - margin.right, y);
      ctx.stroke();

      ctx.fillStyle = NOTE_COLORS[i];
      ctx.font = `bold ${isMobile ? 8 : 10}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(NOTES[i].solfege, ox + margin.left - 4, y);
    }

    if (history.length < 2) return;

    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#7fff7f';
    ctx.shadowColor = 'rgba(127,255,127,0.4)';
    ctx.shadowBlur = 4;

    let started = false;
    for (let i = 0; i < history.length; i++) {
      const lane = history[i];
      if (lane == null) { started = false; continue; }
      const x = ox + margin.left + (i / (HISTORY_SIZE - 1)) * pw;
      const y = oy + margin.top + ph - (lane / (NOTES.length - 1)) * ph;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    const lastLane = history[history.length - 1];
    if (lastLane != null) {
      const x = ox + margin.left + pw;
      const y = oy + margin.top + ph - (lastLane / (NOTES.length - 1)) * ph;
      ctx.fillStyle = NOTE_COLORS[lastLane] || '#7fff7f';
      ctx.shadowColor = NOTE_COLORS[lastLane] || '#7fff7f';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  return { push, setFreqData, draw };
}
