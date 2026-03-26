import * as THREE from 'three';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd0d4da);
  scene.fog = new THREE.Fog(0xd0d4da, 30, 60);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);
  const baseCamPos = new THREE.Vector3(3.5, 3.0, 8);
  const baseLookAt = new THREE.Vector3(-0.5, 2.5, -15);
  camera.position.copy(baseCamPos);
  camera.lookAt(baseLookAt);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.3);
  dirLight.position.set(5, 14, 2);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 70;
  dirLight.shadow.camera.left = -12;
  dirLight.shadow.camera.right = 12;
  dirLight.shadow.camera.top = 18;
  dirLight.shadow.camera.bottom = -5;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xaaccff, 0.5);
  fillLight.position.set(-5, 6, 8);
  scene.add(fillLight);

  const road = createRoad();
  scene.add(road);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const camLookTarget = baseLookAt.clone();
  const CAM_LERP = 4;

  function followBallZ(ballZ, dt) {
    const targetZ = baseCamPos.z + ballZ * 0.6;
    camera.position.z += (targetZ - camera.position.z) * Math.min(1, CAM_LERP * dt);

    camLookTarget.z = baseLookAt.z + ballZ * 0.3;
    camera.lookAt(camLookTarget);
  }

  function render() {
    renderer.render(scene, camera);
  }

  function scrollRoad(dt) {
    road.material.map.offset.y -= dt * 0.06;
  }

  return { scene, camera, renderer, render, scrollRoad, followBallZ };
}

function createRoad() {
  const tex = generateRoadTexture();
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 30);

  const geo = new THREE.PlaneGeometry(14, 120);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, -40);
  mesh.receiveShadow = true;
  return mesh;
}

function generateRoadTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');

  c.fillStyle = '#888888';
  c.fillRect(0, 0, size, size);

  c.strokeStyle = '#999999';
  c.lineWidth = 1;
  for (let i = 0; i < size; i += 32) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i, size);
    c.stroke();
  }

  c.setLineDash([16, 16]);
  c.strokeStyle = '#ffffff';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(size / 2, 0);
  c.lineTo(size / 2, size);
  c.stroke();

  return new THREE.CanvasTexture(canvas);
}
