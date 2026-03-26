import * as THREE from 'three';
import { NOTES } from './audio.js';
import { laneToY, LANE_HEIGHT, BASE_Y, LANE_COUNT } from './ball.js';

const WALL_WIDTH = 6;
const WALL_THICKNESS = 0.5;

// Wall spans from ground to just above the top lane
const WALL_BOTTOM = 0;
const WALL_TOP = BASE_Y + LANE_COUNT * LANE_HEIGHT + 0.3;

// Hole is 1.5x the lane spacing so it's generous to pass through
const HOLE_SIZE = LANE_HEIGHT * 1.6;

const woodColor = 0xdeb887;
const woodColorDark = 0xc8a060;

export function createWall(scene, laneIndex) {
  const group = new THREE.Group();

  const holeCenter = laneToY(laneIndex);
  const holeBottom = holeCenter - HOLE_SIZE / 2;
  const holeTop = holeCenter + HOLE_SIZE / 2;

  const bottomH = Math.max(0, holeBottom - WALL_BOTTOM);
  if (bottomH > 0.01) {
    addPanel(group, bottomH, WALL_BOTTOM + bottomH / 2);
  }

  const topH = Math.max(0, WALL_TOP - holeTop);
  if (topH > 0.01) {
    addPanel(group, topH, holeTop + topH / 2);
  }

  const label = createLabel(laneIndex);
  label.position.set(0, holeCenter, WALL_THICKNESS / 2 + 0.05);
  group.add(label);

  scene.add(group);

  return {
    group,
    laneIndex,
    holeBottom,
    holeTop,
    passed: false,
    disposed: false,
    dispose() {
      scene.remove(group);
      group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      this.disposed = true;
    },
  };
}

function addPanel(group, height, centerY) {
  const geo = new THREE.BoxGeometry(WALL_WIDTH, height, WALL_THICKNESS);
  const mat = new THREE.MeshStandardMaterial({
    color: woodColor,
    roughness: 0.55,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = centerY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function createLabel(laneIndex) {
  const info = NOTES[laneIndex];
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const c = canvas.getContext('2d');

  c.clearRect(0, 0, 256, 128);
  c.fillStyle = 'rgba(0,0,0,0.55)';
  c.roundRect(10, 4, 236, 120, 16);
  c.fill();

  c.fillStyle = '#ffffff';
  c.font = 'bold 72px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(info.solfege, 128, 48);

  c.font = '30px sans-serif';
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fillText(info.note, 128, 100);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.0, 1.0, 1);
  return sprite;
}
