export const State = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
};

export function createGameState() {
  let state = State.IDLE;
  let streak = 0;
  let bestStreak = 0;
  let wallsPassed = 0;
  let bounces = 0;

  const listeners = new Set();

  function on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify() {
    for (const fn of listeners) fn(snapshot());
  }

  function snapshot() {
    return { state, streak, bestStreak, wallsPassed, bounces };
  }

  function play() {
    state = State.PLAYING;
    streak = 0;
    bestStreak = 0;
    wallsPassed = 0;
    bounces = 0;
    notify();
  }

  function passWall() {
    streak++;
    wallsPassed++;
    if (streak > bestStreak) bestStreak = streak;
    notify();
  }

  function bounce() {
    streak = 0;
    bounces++;
    notify();
  }

  function pause() {
    if (state === State.PLAYING) {
      state = State.PAUSED;
      notify();
    }
  }

  function resume() {
    if (state === State.PAUSED) {
      state = State.PLAYING;
      notify();
    }
  }

  function togglePause() {
    if (state === State.PLAYING) pause();
    else if (state === State.PAUSED) resume();
  }

  function reset() {
    state = State.IDLE;
    streak = 0;
    wallsPassed = 0;
    bounces = 0;
    notify();
  }

  return { snapshot, play, passWall, bounce, pause, resume, togglePause, reset, on };
}
