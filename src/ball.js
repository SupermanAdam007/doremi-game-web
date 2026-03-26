import * as THREE from 'three';
import { NOTES } from './audio.js';

const LANE_COUNT = NOTES.length;
const LANE_HEIGHT = 0.75;
const BASE_Y = 1.2;
const LERP_SPEED = 8;

const REST_Z = 0;
const BOUNCE_Z = 4;
const Z_RETURN_SPEED = 6;

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
  let bouncing = false;

  function setLane(lane) {
    if (lane == null) return;
    const clamped = Math.max(0, Math.min(LANE_COUNT - 1, lane));
    targetY = laneToY(clamped);
  }

  function update(dt) {
    mesh.position.y += (targetY - mesh.position.y) * Math.min(1, LERP_SPEED * dt);

    if (bouncing) {
      mesh.position.z += (REST_Z - mesh.position.z) * Math.min(1, Z_RETURN_SPEED * dt);
      if (Math.abs(mesh.position.z - REST_Z) < 0.05) {
        mesh.position.z = REST_Z;
        bouncing = false;
      }
    }
  }

  function bounceBack() {
    mesh.position.z = BOUNCE_Z;
    bouncing = true;
  }

  function isBouncing() {
    return bouncing;
  }

  function reset() {
    mesh.position.set(0, laneToY(3), REST_Z);
    targetY = mesh.position.y;
    bouncing = false;
  }

  function flash(color) {
    mat.emissive.set(color);
    setTimeout(() => mat.emissive.set(0x000000), 200);
  }

  return { mesh, setLane, update, bounceBack, isBouncing, reset, flash };
}
