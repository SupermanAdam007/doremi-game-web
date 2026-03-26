import * as THREE from 'three';
import { NOTES } from './audio.js';
import { laneToY } from './ball.js';

const WALL_WIDTH = 6;
const WALL_THICKNESS = 0.4;
const TOTAL_HEIGHT = 10;
const HOLE_SIZE = 1.0;

const woodColor = 0xdeb887;

export function createWall(scene, laneIndex) {
  const group = new THREE.Group();

  const holeCenter = laneToY(laneIndex);
  const holeBottom = holeCenter - HOLE_SIZE / 2;
  const holeTop = holeCenter + HOLE_SIZE / 2;

  const bottomH = holeBottom;
  if (bottomH > 0.01) {
    const bottomGeo = new THREE.BoxGeometry(WALL_WIDTH, bottomH, WALL_THICKNESS);
    const bottomMat = new THREE.MeshStandardMaterial({
      color: woodColor,
      roughness: 0.6,
      metalness: 0.05,
    });
    const bottomMesh = new THREE.Mesh(bottomGeo, bottomMat);
    bottomMesh.position.y = bottomH / 2;
    bottomMesh.castShadow = true;
    bottomMesh.receiveShadow = true;
    group.add(bottomMesh);
  }

  const topStart = holeTop;
  const topH = TOTAL_HEIGHT - topStart;
  if (topH > 0.01) {
    const topGeo = new THREE.BoxGeometry(WALL_WIDTH, topH, WALL_THICKNESS);
    const topMat = new THREE.MeshStandardMaterial({
      color: woodColor,
      roughness: 0.6,
      metalness: 0.05,
    });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.position.y = topStart + topH / 2;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    group.add(topMesh);
  }

  const label = createLabel(laneIndex);
  label.position.set(0, holeCenter, WALL_THICKNESS / 2 + 0.01);
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

function createLabel(laneIndex) {
  const info = NOTES[laneIndex];
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const c = canvas.getContext('2d');

  c.fillStyle = '#fff';
  c.font = 'bold 64px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(info.solfege, 128, 48);

  c.font = '32px sans-serif';
  c.fillStyle = '#ddd';
  c.fillText(info.note, 128, 100);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.8, 1);
  return sprite;
}
