import { NOTES } from './audio.js';

const HISTORY_SIZE = 150;
const NOTE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

export function createPitchGraph(containerEl) {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 280;
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

    ctx.fillStyle = 'rgba(8, 8, 24, 0.92)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.stroke();

    const margin = { top: 16, bottom: 16, left: 52, right: 16 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;

    for (let i = 0; i < NOTES.length; i++) {
      const y = margin.top + plotH - (i / (NOTES.length - 1)) * plotH;

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(w - margin.right, y);
      ctx.stroke();

      ctx.fillStyle = NOTE_COLORS[i];
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(NOTES[i].solfege, margin.left - 8, y);
    }

    if (history.length < 2) return;

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#7fff7f';
    ctx.shadowColor = 'rgba(127,255,127,0.5)';
    ctx.shadowBlur = 6;

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
    ctx.shadowBlur = 0;

    const lastLane = history[history.length - 1];
    if (lastLane != null) {
      const x = margin.left + ((history.length - 1) / (HISTORY_SIZE - 1)) * plotW;
      const y = margin.top + plotH - (lastLane / (NOTES.length - 1)) * plotH;
      ctx.fillStyle = NOTE_COLORS[lastLane] || '#7fff7f';
      ctx.shadowColor = NOTE_COLORS[lastLane] || '#7fff7f';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  return { push, draw };
}
