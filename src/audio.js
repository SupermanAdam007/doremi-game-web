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

const FFT_SIZE = 2048;
const MIN_DB = -60;

export function createAudioDetector() {
  let ctx = null;
  let analyser = null;
  let dataArray = null;
  let running = false;

  async function start() {
    if (running && ctx) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);

    analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);

    dataArray = new Float32Array(analyser.frequencyBinCount);
    running = true;
  }

  function detectPitch() {
    if (!running || !analyser) return null;

    analyser.getFloatFrequencyData(dataArray);

    let maxVal = -Infinity;
    let maxIndex = 0;
    const nyquist = ctx.sampleRate / 2;

    const minBin = Math.floor((200 / nyquist) * dataArray.length);
    const maxBin = Math.ceil((600 / nyquist) * dataArray.length);

    for (let i = minBin; i < maxBin; i++) {
      if (dataArray[i] > maxVal) {
        maxVal = dataArray[i];
        maxIndex = i;
      }
    }

    if (maxVal < MIN_DB) return null;

    const binHz = ctx.sampleRate / analyser.fftSize;
    const rawHz = maxIndex * binHz;

    const alpha = dataArray[maxIndex - 1] ?? dataArray[maxIndex];
    const beta = dataArray[maxIndex];
    const gamma = dataArray[maxIndex + 1] ?? dataArray[maxIndex];
    const peakOffset = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
    const interpolatedHz = (maxIndex + (isFinite(peakOffset) ? peakOffset : 0)) * binHz;

    return { hz: interpolatedHz, db: maxVal };
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

    if (closestDist > 100) return null;

    return closest;
  }

  function stop() {
    running = false;
    if (ctx) ctx.close();
  }

  return { start, detectPitch, hzToLane, stop };
}
