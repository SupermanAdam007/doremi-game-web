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

// Separate sizes: YIN needs clean time-domain; spectrum benefits from smoothing
const YIN_FFT_SIZE  = 2048; // time-domain for pitch detection
const SPEC_FFT_SIZE = 2048; // frequency-domain for spectrum display
const MIN_RMS = 0.008;

export function createAudioDetector() {
  let ctx = null;
  let yinAnalyser  = null; // smoothingTimeConstant=0, for YIN time-domain data
  let specAnalyser = null; // smoothingTimeConstant=0.7, for spectrum display
  let timeData = null;
  let freqData = null;
  let running = false;

  // One-frame octave-jump suppressor: zero added latency for stable notes.
  let prevHz = null;

  function filteredHz(raw) {
    const out = (prevHz !== null && Math.abs(Math.log2(raw / prevHz)) > 0.6)
      ? prevHz   // jump > ~tritone: hold previous
      : raw;
    prevHz = raw;
    return out;
  }

  async function start() {
    if (running && ctx) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);

    // YIN analyser: NO smoothing — smoothingTimeConstant=0 can return zeros on
    // Safari/WebKit, so we leave it at the safe default (0) but rely on a
    // separate node so the spectrum analyser can keep its smoothing independently.
    yinAnalyser = ctx.createAnalyser();
    yinAnalyser.fftSize = YIN_FFT_SIZE;
    yinAnalyser.smoothingTimeConstant = 0;
    source.connect(yinAnalyser);

    // Spectrum analyser: smoothed for a pleasant visual
    specAnalyser = ctx.createAnalyser();
    specAnalyser.fftSize = SPEC_FFT_SIZE;
    specAnalyser.smoothingTimeConstant = 0.7;
    source.connect(specAnalyser);

    timeData = new Float32Array(yinAnalyser.fftSize);
    freqData = new Float32Array(specAnalyser.frequencyBinCount);
    running = true;
  }

  function getFrequencyData() {
    if (!running || !specAnalyser) return null;
    specAnalyser.getFloatFrequencyData(freqData);
    return { data: freqData, sampleRate: ctx.sampleRate, binCount: specAnalyser.frequencyBinCount };
  }

  function detectPitch() {
    if (!running || !yinAnalyser) return null;

    yinAnalyser.getFloatTimeDomainData(timeData);

    let rms = 0;
    for (let i = 0; i < timeData.length; i++) rms += timeData[i] * timeData[i];
    rms = Math.sqrt(rms / timeData.length);
    if (rms < MIN_RMS) return null;

    const rawHz = yin(timeData, ctx.sampleRate);
    if (rawHz === -1) return null;

    const hz = filteredHz(rawHz);
    return { hz, rms };
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
    yinAnalyser = null;
    specAnalyser = null;
  }

  // Returns { hz, rms } or null. Caller uses hzToLane() to quantize to a lane.
  return { start, detectPitch, hzToLane, getFrequencyData, stop };
}

// YIN pitch detection algorithm — much more robust than autocorrelation for voice
function yin(buf, sampleRate) {
  const n = buf.length;
  const half = n >> 1;
  const threshold = 0.15;

  const minHz = 200;
  const maxHz = 620;
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(half, Math.ceil(sampleRate / minHz));

  const diff = new Float32Array(half);

  // Step 1: difference function
  for (let lag = 1; lag < half; lag++) {
    let s = 0;
    for (let i = 0; i < half; i++) {
      const d = buf[i] - buf[i + lag];
      s += d * d;
    }
    diff[lag] = s;
  }

  // Step 2: cumulative mean normalised difference
  const cmnd = new Float32Array(half);
  cmnd[0] = 1;
  let runSum = 0;
  for (let lag = 1; lag < half; lag++) {
    runSum += diff[lag];
    cmnd[lag] = runSum === 0 ? 0 : diff[lag] * lag / runSum;
  }

  // Step 3: absolute threshold — find first dip below threshold in valid range
  let bestLag = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (cmnd[lag] < threshold) {
      // refine: walk down to local minimum
      while (lag + 1 <= maxLag && cmnd[lag + 1] < cmnd[lag]) lag++;
      bestLag = lag;
      break;
    }
  }

  // fallback: global minimum in range
  if (bestLag === -1) {
    let minVal = Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (cmnd[lag] < minVal) { minVal = cmnd[lag]; bestLag = lag; }
    }
    if (minVal > 0.25) return -1;
  }

  // Step 4: parabolic interpolation for sub-sample accuracy
  if (bestLag > 0 && bestLag < half - 1) {
    const s0 = cmnd[bestLag - 1];
    const s1 = cmnd[bestLag];
    const s2 = cmnd[bestLag + 1];
    const denom = s0 - 2 * s1 + s2;
    if (denom !== 0) {
      const shift = 0.5 * (s0 - s2) / denom;
      if (isFinite(shift)) bestLag += shift;
    }
  }

  return sampleRate / bestLag;
}
