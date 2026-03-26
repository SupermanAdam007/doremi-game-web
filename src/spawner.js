import { NOTES } from './audio.js';
import { createWall } from './wall.js';

const SPAWN_Z = -50;
const DESPAWN_Z = 12;
const BASE_SPEED = 7;
const SPEED_RAMP = 0.12;
const BASE_INTERVAL = 3.5;
const MIN_INTERVAL = 1.8;

export function createSpawner(scene) {
  const walls = [];
  let timer = 0;
  let nextLane = 0;

  function speed(wallsPassed) {
    return BASE_SPEED + wallsPassed * SPEED_RAMP;
  }

  function interval(wallsPassed) {
    return Math.max(MIN_INTERVAL, BASE_INTERVAL - wallsPassed * 0.06);
  }

  function spawn() {
    const lane = nextLane;
    nextLane = (nextLane + 1) % NOTES.length;

    const wall = createWall(scene, lane);
    wall.group.position.z = SPAWN_Z;
    walls.push(wall);
  }

  function update(dt, wallsPassed, blockedWall) {
    // When a wall is blocked, freeze everything — no new spawns, no movement
    if (blockedWall) return;

    const spd = speed(wallsPassed);

    timer += dt;
    if (timer >= interval(wallsPassed)) {
      timer = 0;
      spawn();
    }

    for (let i = walls.length - 1; i >= 0; i--) {
      const w = walls[i];
      w.group.position.z += spd * dt;
      if (w.group.position.z > DESPAWN_Z) {
        w.dispose();
        walls.splice(i, 1);
      }
    }
  }

  function getActiveWalls() {
    return walls;
  }

  function removeWall(wall) {
    const idx = walls.indexOf(wall);
    if (idx !== -1) {
      wall.dispose();
      walls.splice(idx, 1);
    }
  }

  function clear() {
    for (const w of walls) w.dispose();
    walls.length = 0;
    timer = 0;
    nextLane = 0;
  }

  return { update, getActiveWalls, removeWall, clear, spawn };
}
