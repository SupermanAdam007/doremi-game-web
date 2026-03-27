import * as THREE from 'three';
import { NOTES } from './audio.js';

export const LANE_COUNT = NOTES.length;
export const LANE_HEIGHT = 0.75;
export const BASE_Y = 1.2;
const LERP_SPEED = 22;

const REST_Z = 0;
const GRAVITY = 2.8; // lanes per second the ball falls when silent
const FLOOR_Y = BASE_Y;

export function laneToY(lane) {
  return BASE_Y + lane * LANE_HEIGHT;
}

export function createBall(scene) {
  const geo = new THREE.SphereGeometry(0.3, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff8c00,
    roughness: 0.35,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.set(0, laneToY(3), REST_Z);
  scene.add(mesh);

  let targetY = mesh.position.y;
  let hasSound = false;
  let blocked = false;

  // Bounce: ball flies toward camera then returns to REST_Z
  let bounceTime = 0;
  let bounceCooldown = 0;
  const BOUNCE_DURATION = 1.0;
  const BOUNCE_COOLDOWN = 1.2;
  const BOUNCE_AMP = 1.2;        // distance toward camera on bounce peak

  function setLane(lane) {
    if (lane == null) {
      hasSound = false;
      return;
    }
    hasSound = true;
    const clamped = Math.max(0, Math.min(LANE_COUNT - 1, lane));
    targetY = laneToY(clamped);
  }

  function setBlocked(isBlocked) {
    blocked = isBlocked;
  }

  function update(dt) {
    if (!hasSound) {
      targetY = Math.max(FLOOR_Y, targetY - GRAVITY * LANE_HEIGHT * dt);
    }

    mesh.position.y += (targetY - mesh.position.y) * Math.min(1, LERP_SPEED * dt);

    if (bounceCooldown > 0) bounceCooldown -= dt;

    if (bounceTime > 0) {
      bounceTime -= dt;
      // t goes 0→1 over BOUNCE_DURATION; sin(t*π) is a single clean arc (0 → peak → 0)
      const t = 1 - bounceTime / BOUNCE_DURATION;
      mesh.position.z = REST_Z + BOUNCE_AMP * Math.sin(t * Math.PI);
    } else {
      mesh.position.z = REST_Z;
    }
  }

  function bounceBack() {
    if (bounceCooldown > 0) return;
    bounceTime = BOUNCE_DURATION;
    bounceCooldown = BOUNCE_COOLDOWN;
  }

  function isBouncing() {
    return bounceTime > 0;
  }

  function isOnCooldown() {
    return bounceCooldown > 0;
  }

  function reset() {
    mesh.position.set(0, laneToY(3), REST_Z);
    targetY = mesh.position.y;
    bounceTime = 0;
    bounceCooldown = 0;
    hasSound = false;
    blocked = false;
  }

  function flash(color) {
    mat.emissive.set(color);
    setTimeout(() => mat.emissive.set(0x000000), 250);
  }

  return { mesh, setLane, setBlocked, update, bounceBack, isBouncing, isOnCooldown, reset, flash };
}
