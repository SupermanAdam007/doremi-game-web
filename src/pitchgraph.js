import { NOTES } from './audio.js';

const HISTORY_SIZE = 120;
const NOTE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

export function createPitchGraph(containerEl) {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 200;
  containerEl.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const history = [];

  function push(lane) {
    history.push(lane);
    if (history.length > HISTORY_SIZE) history.shift();
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(10, 10, 30, 0.8)';
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();

    const margin = { top: 10, bottom: 10, left: 45, right: 10 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;

    for (let i = 0; i < NOTES.length; i++) {
      const y = margin.top + plotH - (i / (NOTES.length - 1)) * plotH;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(w - margin.right, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(NOTES[i].solfege, margin.left - 6, y);
    }

    if (history.length < 2) return;

    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#7fff7f';

    let started = false;
    for (let i = 0; i < history.length; i++) {
      const lane = history[i];
      if (lane == null) {
        started = false;
        continue;
      }
      const x = margin.left + (i / (HISTORY_SIZE - 1)) * plotW;
      const y = margin.top + plotH - (lane / (NOTES.length - 1)) * plotH;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    for (let i = 0; i < history.length; i++) {
      const lane = history[i];
      if (lane == null) continue;
      const x = margin.left + (i / (HISTORY_SIZE - 1)) * plotW;
      const y = margin.top + plotH - (lane / (NOTES.length - 1)) * plotH;
      if (i === history.length - 1) {
        ctx.fillStyle = NOTE_COLORS[lane] || '#7fff7f';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return { push, draw };
}
