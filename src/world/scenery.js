import * as THREE from 'three';

// Deterministic RNG so the world looks identical every visit.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

export function createScenery(scene, curve, skyColor) {
  const rand = mulberry32(20260612);

  // Corridor samples used to keep props off the line.
  const corridor = [];
  for (let i = 0; i <= 240; i++) corridor.push(curve.getPointAt(i / 240));
  const clearOf = (x, z, minDist) => {
    const d2 = minDist * minDist;
    for (const p of corridor) {
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < d2) return false;
    }
    return true;
  };
  const scatter = (count, minDist, spreadX, place) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 30) {
      guard++;
      const x = (rand() * 2 - 1) * spreadX;
      const z = 60 - rand() * 760;
      if (!clearOf(x, z, minDist)) continue;
      place(x, z, placed);
      placed++;
    }
  };

  // Ground.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1700, 1700), lambert(0xf0deb4));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -300);
  ground.receiveShadow = true;
  scene.add(ground);

  const dummy = new THREE.Object3D();

  // Trees: instanced trunks + canopies.
  const TREES = 260;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6);
  const canopyGeo = new THREE.ConeGeometry(1.5, 3.4, 7);
  const trunks = new THREE.InstancedMesh(trunkGeo, lambert(0x8a6248), TREES);
  const canopies = new THREE.InstancedMesh(canopyGeo, lambert(0x6cc06f), TREES);
  const canopyColor = new THREE.Color();
  scatter(TREES, 9, 130, (x, z, i) => {
    const s = 0.7 + rand() * 1.4;
    dummy.position.set(x, 0.8 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = rand() * Math.PI * 2;
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = (1.6 + 1.4) * s;
    dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);
    canopyColor.setHSL(0.33 + rand() * 0.06, 0.45, 0.5 + rand() * 0.12);
    canopies.setColorAt(i, canopyColor);
  });
  trunks.castShadow = canopies.castShadow = true;
  scene.add(trunks, canopies);

  // Rocks.
  const ROCKS = 90;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.8, 0), lambert(0xc8b394), ROCKS);
  scatter(ROCKS, 7, 120, (x, z, i) => {
    const s = 0.4 + rand() * 1.1;
    dummy.position.set(x, s * 0.4, z);
    dummy.scale.set(s * (0.8 + rand() * 0.5), s * 0.7, s);
    dummy.rotation.set(rand() * 0.6, rand() * Math.PI * 2, 0);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  });
  rocks.castShadow = true;
  scene.add(rocks);

  // Distant mountains ringing the route, kept well off the line.
  const mountainMat = lambert(0xe2bf94);
  const snowMat = lambert(0xfffaf0);
  let mountainsPlaced = 0;
  let mountainGuard = 0;
  while (mountainsPlaced < 14 && mountainGuard < 300) {
    mountainGuard++;
    const angle = rand() * Math.PI * 2;
    const r = 175 + rand() * 165;
    const x = Math.cos(angle) * r;
    const z = -300 + Math.sin(angle) * r;
    if (!clearOf(x, z, 110)) continue;
    mountainsPlaced++;
    const h = 45 + rand() * 90;
    const base = 35 + rand() * 50;
    const m = new THREE.Mesh(new THREE.ConeGeometry(base, h, 5), mountainMat);
    m.position.set(x, h / 2 - 1, z);
    m.rotation.y = rand() * Math.PI;
    scene.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(base * 0.32, h * 0.3, 5), snowMat);
    cap.position.set(x, h - h * 0.14, z);
    cap.rotation.y = m.rotation.y;
    scene.add(cap);
  }

  // Clouds: clumps of flat-shaded spheres drifting slowly.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    const blobs = 3 + Math.floor(rand() * 3);
    for (let b = 0; b < blobs; b++) {
      const s = 2.2 + rand() * 2.6;
      const blob = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), cloudMat);
      blob.position.set(b * 2.8 - blobs * 1.3, rand() * 1.2, rand() * 2 - 1);
      blob.scale.y = 0.6;
      cloud.add(blob);
    }
    cloud.position.set((rand() * 2 - 1) * 160, 38 + rand() * 22, 40 - rand() * 700);
    cloud.userData.speed = 0.6 + rand() * 0.9;
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Balloons clustered beside the terminus station for the contact celebration.
  const balloons = [];
  const endPoint = curve.getPointAt(1);
  const endTan = curve.getTangentAt(1);
  const endNorm = new THREE.Vector3(0, 1, 0).cross(endTan).normalize();
  const balloonColors = [0xff6b6b, 0x4d96ff, 0xf6c344, 0xb368f0, 0x52c41a];
  balloonColors.forEach((color, i) => {
    const b = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 9), lambert(color));
    ball.scale.y = 1.15;
    b.add(ball);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.6, 4), lambert(0x3a3243));
    string.position.y = -1.55;
    b.add(string);
    b.position
      .copy(endPoint)
      .addScaledVector(endNorm, -9 + (i - 2) * 1.6)
      .addScaledVector(endTan, -6 - (i % 3) * 1.4);
    b.position.y = 5.6 + (i % 2) * 0.8;
    b.userData.phase = i * 1.3;
    scene.add(b);
    balloons.push(b);
  });

  function update(dt, time) {
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 200) c.position.x = -200;
    }
    for (const b of balloons) {
      b.position.y += Math.sin(time * 1.4 + b.userData.phase) * 0.003;
      b.rotation.z = Math.sin(time * 0.9 + b.userData.phase) * 0.06;
    }
  }

  return { update };
}
