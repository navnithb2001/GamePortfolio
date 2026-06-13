import * as THREE from 'three';
import { buildCanopyGeometry, createFoliageMaterial } from './foliage.js';
import { TREE_COLORS, BUSH_COLORS } from './folioAssets.js';

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

function lambert(color, flat = false) {
  return new THREE.MeshLambertMaterial({ color, flatShading: flat });
}

// Ground plane is 1700×1700 centered at (0,0,-300); maps world → canvas px.
const GROUND_SIZE = 1700;
const GROUND_CENTER_Z = -300;
const TEX_SIZE = 2048;
const worldToPx = (x, z) => [
  ((x + GROUND_SIZE / 2) / GROUND_SIZE) * TEX_SIZE,
  ((z - GROUND_CENTER_Z + GROUND_SIZE / 2) / GROUND_SIZE) * TEX_SIZE
];

// Soft radial gradient + mottled speckle, plus painted green meadow zones
// so the grass carpet sits on matching ground color.
function makeGroundTexture(rand, meadows, corridor) {
  const c = document.createElement('canvas');
  c.width = c.height = TEX_SIZE;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(
    TEX_SIZE / 2, TEX_SIZE / 2, 100,
    TEX_SIZE / 2, TEX_SIZE / 2, TEX_SIZE * 0.74
  );
  grad.addColorStop(0, '#f8ecd0');
  grad.addColorStop(0.55, '#f0deb4');
  grad.addColorStop(1, '#e6c894');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = `rgba(${rand() > 0.5 ? '185,150,105' : '255,250,230'},0.05)`;
    ctx.beginPath();
    ctx.arc(rand() * TEX_SIZE, rand() * TEX_SIZE, 18 + rand() * 70, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 5200; i++) {
    ctx.fillStyle = `rgba(150,115,80,${0.03 + rand() * 0.05})`;
    ctx.fillRect(rand() * TEX_SIZE, rand() * TEX_SIZE, 2.2, 2.2);
  }
  // Green ground band along the corridor so the soil under the grass field
  // reads green (matches the grass mask band in grassField.js).
  const bandPx = (78 / GROUND_SIZE) * TEX_SIZE * 0.5;
  ctx.strokeStyle = 'rgba(150,180,96,0.62)';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = bandPx;
  ctx.beginPath();
  corridor.forEach((p, i) => {
    const [px, py] = worldToPx(p.x, p.z);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();
  // Meadow zones: layered soft green gradients.
  for (const m of meadows) {
    const [px, py] = worldToPx(m.x, m.z);
    const pr = (m.r / GROUND_SIZE) * TEX_SIZE;
    for (const [scale, alpha] of [[1.25, 0.35], [0.85, 0.5]]) {
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr * scale);
      g.addColorStop(0, `rgba(151,186,98,${alpha})`);
      g.addColorStop(0.7, `rgba(160,190,110,${alpha * 0.6})`);
      g.addColorStop(1, 'rgba(160,190,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}


// Cone with jittered side vertices for a hand-modelled faceted silhouette.
function ruggedCone(radius, height, segments, rand, jitter = 0.1) {
  const geo = new THREE.ConeGeometry(radius, height, segments, 3);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const isApex = v.y > height * 0.49;
    const isBase = v.y < -height * 0.49;
    if (isApex || isBase) continue;
    pos.setXYZ(
      i,
      v.x + (rand() - 0.5) * radius * jitter * 2,
      v.y + (rand() - 0.5) * height * jitter,
      v.z + (rand() - 0.5) * radius * jitter * 2
    );
  }
  geo.computeVertexNormals();
  return geo;
}

export function createScenery(scene, curve, trackLength, stationDistances, assets) {
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
  // Scatter hugging the track: picks a corridor point, offsets sideways.
  const scatterNear = (count, minDist, maxDist, place) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 30) {
      guard++;
      const p = corridor[Math.floor(rand() * corridor.length)];
      const a = rand() * Math.PI * 2;
      const r = minDist + rand() * (maxDist - minDist);
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (!clearOf(x, z, minDist)) continue;
      place(x, z, placed);
      placed++;
    }
  };

  // Meadow zones hugging the corridor — painted onto the ground texture and
  // filled with instanced grass below. One guaranteed meadow flanks every
  // station (where riders actually stop and look), plus random ones between.
  const meadows = [];
  const UPv = new THREE.Vector3(0, 1, 0);
  for (const d of stationDistances) {
    const t = d / trackLength;
    const p = curve.getPointAt(t);
    const n = UPv.clone().cross(curve.getTangentAt(t)).normalize();
    for (const side of [1, -1]) {
      meadows.push({
        x: p.x + n.x * side * (17 + rand() * 6),
        z: p.z + n.z * side * (17 + rand() * 6),
        r: 12 + rand() * 8
      });
    }
  }
  {
    let guard = 0;
    while (meadows.length < 30 && guard < 500) {
      guard++;
      const p = corridor[Math.floor(rand() * corridor.length)];
      const a = rand() * Math.PI * 2;
      const off = 10 + rand() * 38;
      const x = p.x + Math.cos(a) * off;
      const z = p.z + Math.sin(a) * off;
      const r = 9 + rand() * 13;
      if (meadows.some((m) => (m.x - x) ** 2 + (m.z - z) ** 2 < (m.r + r) ** 2 * 0.5)) continue;
      meadows.push({ x, z, r });
    }
  }

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rand, meadows, corridor) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, GROUND_CENTER_Z);
  ground.receiveShadow = true;
  scene.add(ground);

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  const stationPoints = stationDistances.map((d) => curve.getPointAt(d / trackLength));

  // --- Bruno Simon trees: instanced trunks + foliage canopies per species ----
  // The shared canopy geometry (an 80-quad sphere) is instanced once per leaf
  // anchor of every tree; each instance matrix = treePlacement * anchorMatrix.
  const canopyGeo = buildCanopyGeometry(7, 72);
  const TREE_TOTAL = 150;
  const speciesPick = ['oak', 'oak', 'oak', 'cherry', 'cherry', 'birch'];
  const placements = { oak: [], cherry: [], birch: [] };
  scatter(TREE_TOTAL, 10, 150, (x, z) => {
    const sp = speciesPick[Math.floor(rand() * speciesPick.length)];
    const s = 0.5 + rand() * 0.45;
    dummy.position.set(x, 0, z);
    dummy.scale.setScalar(s);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.updateMatrix();
    placements[sp].push(dummy.matrix.clone());
  });

  const tmpMat = new THREE.Matrix4();
  for (const sp of ['oak', 'cherry', 'birch']) {
    const data = assets.trees[sp];
    const mats = placements[sp];
    if (!mats.length || !data) continue;

    const trunks = new THREE.InstancedMesh(data.body, assets.paletteMat, mats.length);
    trunks.castShadow = true;
    trunks.receiveShadow = true;
    mats.forEach((m, i) => trunks.setMatrixAt(i, m));
    scene.add(trunks);

    const [colorA, colorB] = TREE_COLORS[sp];
    const { material, depthMaterial } = createFoliageMaterial({
      colorA,
      colorB,
      foliageTexture: assets.foliageTexture
    });
    const canopies = new THREE.InstancedMesh(canopyGeo, material, mats.length * data.anchors.length);
    canopies.customDepthMaterial = depthMaterial;
    canopies.castShadow = true;
    canopies.receiveShadow = true;
    let k = 0;
    for (const tm of mats) {
      for (const anchor of data.anchors) {
        tmpMat.multiplyMatrices(tm, anchor);
        canopies.setMatrixAt(k++, tmpMat);
      }
    }
    scene.add(canopies);
  }

  // --- bushes: trunk-less foliage clumps hugging the line ---------------------
  const BUSHES = 110;
  const bushMat = createFoliageMaterial({
    colorA: BUSH_COLORS[0],
    colorB: BUSH_COLORS[1],
    foliageTexture: assets.foliageTexture
  });
  const bushes = new THREE.InstancedMesh(canopyGeo, bushMat.material, BUSHES);
  bushes.customDepthMaterial = bushMat.depthMaterial;
  bushes.castShadow = true;
  bushes.receiveShadow = true;
  let bushCount = 0;
  scatterNear(BUSHES, 6, 52, (x, z) => {
    const s = 0.8 + rand() * 0.9;
    dummy.position.set(x, s * 0.7, z);
    dummy.scale.set(s, s * 0.8, s);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.updateMatrix();
    bushes.setMatrixAt(bushCount++, dummy.matrix);
  });
  bushes.count = bushCount;
  scene.add(bushes);

  const FLOWERS = 160;
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 4).translate(0, 0.2, 0), lambert(0x5e9e54), FLOWERS);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 6, 5).translate(0, 0.44, 0), lambert(0xffffff), FLOWERS);
  const petals = [0xff8fab, 0xfff066, 0xffffff, 0xff9f43, 0xc9a7f5];
  scatterNear(FLOWERS, 3.4, 22, (x, z, i) => {
    const s = 0.8 + rand() * 0.8;
    dummy.position.set(x, 0, z);
    dummy.scale.setScalar(s);
    dummy.rotation.set(0, 0, (rand() - 0.5) * 0.3);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
    heads.setColorAt(i, tint.set(petals[Math.floor(rand() * petals.length)]));
  });
  scene.add(stems, heads);

  // --- rocks ------------------------------------------------------------------
  const ROCKS = 90;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.8, 0), lambert(0xc4ad8c, true), ROCKS);
  scatter(ROCKS, 6, 130, (x, z, i) => {
    const s = 0.35 + rand() * 1.0;
    dummy.position.set(x, s * 0.4, z);
    dummy.scale.set(s * (0.8 + rand() * 0.5), s * 0.7, s);
    dummy.rotation.set(rand() * 0.6, rand() * Math.PI * 2, 0);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  });
  rocks.castShadow = true;
  scene.add(rocks);

  // --- ponds ------------------------------------------------------------------
  for (let i = 0; i < 3; i++) {
    scatterNear(1, 20, 55, (x, z) => {
      const r = 4.5 + rand() * 4.5;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(r + 1.1, r + 1.1, 0.1, 18), lambert(0xd9bc8e));
      rim.position.set(x, 0.03, z);
      rim.receiveShadow = true;
      const water = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.14, 18), lambert(0x76c7e0));
      water.position.set(x, 0.07, z);
      scene.add(rim, water);
    });
  }

  // --- telegraph poles along the line ----------------------------------------
  const poleDistances = [];
  for (let d = 14; d < trackLength - 8; d += 28) {
    if (stationDistances.some((sd) => Math.abs(d - sd) < 16)) continue;
    poleDistances.push(d);
  }
  const POLES = poleDistances.length;
  const poles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.08, 0.12, 4.4, 6).translate(0, 2.2, 0),
    lambert(0x6b4f3a),
    POLES
  );
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.13, 0.13).translate(0, 4.05, 0), lambert(0x6b4f3a), POLES);
  const knobs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 6, 5), lambert(0xfff3df), POLES * 2);
  const UP = new THREE.Vector3(0, 1, 0);
  const tan = new THREE.Vector3();
  const norm = new THREE.Vector3();
  const armDir = new THREE.Vector3();
  poleDistances.forEach((d, i) => {
    const t = d / trackLength;
    const p = curve.getPointAt(t);
    tan.copy(curve.getTangentAt(t));
    norm.crossVectors(UP, tan).normalize();
    dummy.position.copy(p).addScaledVector(norm, 4.8);
    dummy.position.y = 0;
    dummy.rotation.set(0, Math.atan2(tan.x, tan.z), 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    arms.setMatrixAt(i, dummy.matrix);
    // Two insulator knobs on the crossarm ends.
    armDir.set(Math.cos(-dummy.rotation.y), 0, Math.sin(-dummy.rotation.y));
    for (const side of [0, 1]) {
      dummy.position.addScaledVector(armDir, side === 0 ? 0.55 : -1.1);
      dummy.position.y = 4.18;
      dummy.updateMatrix();
      knobs.setMatrixAt(i * 2 + side, dummy.matrix);
      dummy.position.y = 0;
    }
  });
  poles.castShadow = arms.castShadow = true;
  scene.add(poles, arms, knobs);

  // --- mid-ground hills for depth layering ------------------------------------
  const hillTones = [0xecd3a3, 0xcdd49b, 0xe3c79a, 0xc4cf90];
  let hillsPlaced = 0;
  let hillGuard = 0;
  while (hillsPlaced < 10 && hillGuard < 250) {
    hillGuard++;
    const a = rand() * Math.PI * 2;
    const r = 130 + rand() * 95;
    const x = Math.cos(a) * r;
    const z = -300 + Math.sin(a) * r;
    if (!clearOf(x, z, 72)) continue;
    hillsPlaced++;
    const hr = 24 + rand() * 22;
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(hr, 8, 5),
      lambert(hillTones[hillsPlaced % hillTones.length], true)
    );
    hill.scale.y = 0.28 + rand() * 0.1;
    hill.position.set(x, 0, z);
    scene.add(hill);
  }

  // --- distant faceted mountains ----------------------------------------------
  const mountainMat = lambert(0xdbb791, true);
  const snowMat = lambert(0xfffaf0, true);
  let mountainsPlaced = 0;
  let mountainGuard = 0;
  while (mountainsPlaced < 14 && mountainGuard < 300) {
    mountainGuard++;
    const angle = rand() * Math.PI * 2;
    const r = 190 + rand() * 170;
    const x = Math.cos(angle) * r;
    const z = -300 + Math.sin(angle) * r;
    if (!clearOf(x, z, 110)) continue;
    mountainsPlaced++;
    const h = 38 + rand() * 62;
    const base = 35 + rand() * 50;
    const m = new THREE.Mesh(ruggedCone(base, h, 6, rand), mountainMat);
    m.position.set(x, h / 2 - 1, z);
    m.rotation.y = rand() * Math.PI;
    scene.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(base * 0.3, h * 0.28, 6), snowMat);
    cap.position.set(x, h - h * 0.15, z);
    cap.rotation.y = m.rotation.y;
    scene.add(cap);
  }

  // --- clouds ------------------------------------------------------------------
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Group();
    const blobs = 3 + Math.floor(rand() * 3);
    for (let b = 0; b < blobs; b++) {
      const s = 2.2 + rand() * 2.6;
      const blob = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), cloudMat);
      blob.position.set(b * 2.8 - blobs * 1.3, rand() * 1.2, rand() * 2 - 1);
      blob.scale.y = 0.55;
      cloud.add(blob);
    }
    cloud.position.set((rand() * 2 - 1) * 170, 38 + rand() * 24, 40 - rand() * 700);
    cloud.userData.speed = 0.6 + rand() * 0.9;
    scene.add(cloud);
    clouds.push(cloud);
  }

  // --- balloons clustered beside the terminus station --------------------------
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

  return { update, meadows, corridor, stationPoints };
}
