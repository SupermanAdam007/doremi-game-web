const NOTES = [
  { solfege: 'Do', note: 'C4', hz: 261.63 },
  { solfege: 'Re', note: 'D4', hz: 293.66 },
  { solfege: 'Mi', note: 'E4', hz: 329.63 },
  { solfege: 'Fa', note: 'F4', hz: 349.23 },
  { solfege: 'Sol', note: 'G4', hz: 392.00 },
  { solfege: 'La', note: 'A4', hz: 440.00 },
  { solfege: 'Ti', note: 'B4', hz: 493.88 },
  { solfege: 'Do', note: 'C5', hz: 523.25 },
];

export { NOTES };

const FFT_SIZE = 4096;
const MIN_RMS = 0.01;

export function createAudioDetector() {
  let ctx = null;
  let analyser = null;
  let timeData = null;
  let running = false;

  async function start() {
    if (running && ctx) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);

    analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    source.connect(analyser);

    timeData = new Float32Array(analyser.fftSize);
    running = true;
  }

  function detectPitch() {
    if (!running || !analyser) return null;

    analyser.getFloatTimeDomainData(timeData);

    let rms = 0;
    for (let i = 0; i < timeData.length; i++) {
      rms += timeData[i] * timeData[i];
    }
    rms = Math.sqrt(rms / timeData.length);
    if (rms < MIN_RMS) return null;

    const hz = autoCorrelate(timeData, ctx.sampleRate);
    if (hz === -1) return null;

    return { hz, rms };
  }

  function hzToLane(hz) {
    if (hz == null) return null;

    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < NOTES.length; i++) {
      const cents = 1200 * Math.log2(hz / NOTES[i].hz);
      const dist = Math.abs(cents);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }

    if (closestDist > 80) return null;

    return closest;
  }

  function stop() {
    running = false;
    if (ctx) ctx.close();
  }

  return { start, detectPitch, hzToLane, stop };
}

function autoCorrelate(buf, sampleRate) {
  const n = buf.length;
  const minHz = 200;
  const maxHz = 600;
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.ceil(sampleRate / minHz);

  let bestCorr = 0;
  let bestLag = -1;

  let foundGoodCorr = false;
  let lastCorr = 1;

  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let corr = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < n - lag; i++) {
      corr += buf[i] * buf[i + lag];
      norm1 += buf[i] * buf[i];
      norm2 += buf[i + lag] * buf[i + lag];
    }
    const denom = Math.sqrt(norm1 * norm2);
    if (denom === 0) continue;
    corr /= denom;

    if (corr > 0.9) foundGoodCorr = true;

    if (foundGoodCorr && corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }

    if (foundGoodCorr && corr < lastCorr && bestLag !== -1) {
      break;
    }
    lastCorr = corr;
  }

  if (bestLag === -1 || bestCorr < 0.8) return -1;

  let shift =0;
  if (bestLag > minLag && bestLag < maxLag) {
    const corrPrev = normCorr(buf, bestLag - 1);
    const corrNext = normCorr(buf, bestLag + 1);
    shift = 0.5 * (corrPrev - corrNext) / (corrPrev - 2 * bestCorr + corrNext);
    if (!isFinite(shift)) shift = 0;
  }

  return sampleRate / (bestLag + shift);
}

function normCorr(buf, lag) {
  const n = buf.length;
  let corr = 0, n1 = 0, n2 = 0;
  for (let i = 0; i < n - lag; i++) {
    corr += buf[i] * buf[i + lag];
    n1 += buf[i] * buf[i];
    n2 += buf[i + lag] * buf[i + lag];
  }
  const d = Math.sqrt(n1 * n2);
  return d === 0 ? 0 : corr / d;
}
