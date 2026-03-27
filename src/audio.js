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
const MIN_DB = -50;       // ignore peaks below this dB
const PEAK_MIN_HZ = 200;
const PEAK_MAX_HZ = 620;

export function createAudioDetector() {
  let ctx = null;
  let analyser = null;
  let freqData = null;
  let running = false;

  let prevHz = null;

  function filteredHz(raw) {
    const out = (prevHz !== null && Math.abs(Math.log2(raw / prevHz)) > 0.6)
      ? prevHz
      : raw;
    prevHz = raw;
    return out;
  }

  async function start() {
    if (running && ctx) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);

    analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    freqData = new Float32Array(analyser.frequencyBinCount);
    running = true;
  }

  function getFrequencyData() {
    if (!running || !analyser) return null;
    analyser.getFloatFrequencyData(freqData);
    return { data: freqData, sampleRate: ctx.sampleRate, binCount: analyser.frequencyBinCount };
  }

  function detectPitch() {
    if (!running || !analyser) return null;

    analyser.getFloatFrequencyData(freqData);

    const sampleRate = ctx.sampleRate;
    const binCount = analyser.frequencyBinCount;
    const nyquist = sampleRate / 2;
    const minBin = Math.floor((PEAK_MIN_HZ / nyquist) * binCount);
    const maxBin = Math.ceil((PEAK_MAX_HZ / nyquist) * binCount);

    let peakDb = -Infinity;
    let peakBin = minBin;
    for (let i = minBin; i <= maxBin && i < binCount; i++) {
      if (freqData[i] > peakDb) {
        peakDb = freqData[i];
        peakBin = i;
      }
    }

    if (peakDb < MIN_DB) return null;

    // Parabolic interpolation around peak for sub-bin accuracy
    let interpBin = peakBin;
    if (peakBin > 0 && peakBin < binCount - 1) {
      const a = freqData[peakBin - 1];
      const b = freqData[peakBin];
      const c = freqData[peakBin + 1];
      const denom = a - 2 * b + c;
      if (denom !== 0) {
        const shift = 0.5 * (a - c) / denom;
        if (Math.abs(shift) < 1) interpBin += shift;
      }
    }

    const rawHz = (interpBin / binCount) * nyquist;
    const hz = filteredHz(rawHz);

    return { hz, rms: peakDb };
  }

  function hzToLane(hz) {
    if (hz == null) return null;

    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < NOTES.length; i++) {
      const cents = Math.abs(1200 * Math.log2(hz / NOTES[i].hz));
      if (cents < closestDist) {
        closestDist = cents;
        closest = i;
      }
    }

    return closestDist > 150 ? null : closest;
  }

  function stop() {
    running = false;
    if (ctx) { ctx.close(); ctx = null; }
    analyser = null;
  }

  return { start, detectPitch, hzToLane, getFrequencyData, stop };
}
