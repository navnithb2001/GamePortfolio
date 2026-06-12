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

function lambert(color, flat = false) {
  return new THREE.MeshLambertMaterial({ color, flatShading: flat });
}

// Soft radial gradient + mottled speckle so the sand reads as terrain, not a flat fill.
function makeGroundTexture(rand) {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(512, 512, 60, 512, 512, 760);
  grad.addColorStop(0, '#f8ecd0');
  grad.addColorStop(0.55, '#f0deb4');
  grad.addColorStop(1, '#e6c894');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(${rand() > 0.5 ? '185,150,105' : '255,250,230'},0.05)`;
    ctx.beginPath();
    ctx.arc(rand() * 1024, rand() * 1024, 10 + rand() * 38, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(150,115,80,${0.03 + rand() * 0.05})`;
    ctx.fillRect(rand() * 1024, rand() * 1024, 1.6, 1.6);
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

export function createScenery(scene, curve, trackLength, stationDistances) {
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

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1700, 1700),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rand) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -300);
  ground.receiveShadow = true;
  scene.add(ground);

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  // --- pines: trunk + three stacked cones sharing one matrix per tree -------
  const PINES = 170;
  const pineParts = [
    new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.26, 1.4, 6).translate(0, 0.7, 0), lambert(0x8a6248), PINES),
    new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 1.9, 6).translate(0, 2.2, 0), lambert(0x6cc06f, true), PINES),
    new THREE.InstancedMesh(new THREE.ConeGeometry(1.15, 1.6, 6).translate(0, 3.35, 0), lambert(0x6cc06f, true), PINES),
    new THREE.InstancedMesh(new THREE.ConeGeometry(0.7, 1.3, 6).translate(0, 4.35, 0), lambert(0x6cc06f, true), PINES)
  ];
  scatter(PINES, 9, 140, (x, z, i) => {
    const s = 0.6 + rand() * 1.3;
    dummy.position.set(x, 0, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = rand() * Math.PI * 2;
    dummy.updateMatrix();
    tint.setHSL(0.32 + rand() * 0.07, 0.5, 0.42 + rand() * 0.16);
    for (const part of pineParts) {
      part.setMatrixAt(i, dummy.matrix);
      if (part !== pineParts[0]) part.setColorAt(i, tint);
    }
  });
  for (const part of pineParts) {
    part.castShadow = true;
    scene.add(part);
  }

  // --- puffball trees -------------------------------------------------------
  const PUFFS = 130;
  const puffTrunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.24, 1.9, 6).translate(0, 0.95, 0),
    lambert(0x8a6248),
    PUFFS
  );
  const puffTops = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.5, 0).translate(0, 2.9, 0),
    lambert(0x7bc47f, true),
    PUFFS
  );
  scatter(PUFFS, 9, 140, (x, z, i) => {
    const s = 0.7 + rand() * 1.2;
    dummy.position.set(x, 0, z);
    dummy.scale.set(s, s * (0.9 + rand() * 0.3), s);
    dummy.rotation.y = rand() * Math.PI * 2;
    dummy.updateMatrix();
    puffTrunks.setMatrixAt(i, dummy.matrix);
    puffTops.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.27 + rand() * 0.12, 0.5, 0.46 + rand() * 0.14);
    puffTops.setColorAt(i, tint);
  });
  puffTrunks.castShadow = puffTops.castShadow = true;
  scene.add(puffTrunks, puffTops);

  // --- bushes ----------------------------------------------------------------
  const BUSHES = 90;
  const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.9, 0), lambert(0x8fcc7a, true), BUSHES);
  scatterNear(BUSHES, 6, 50, (x, z, i) => {
    const s = 0.5 + rand() * 0.9;
    dummy.position.set(x, s * 0.5, z);
    dummy.scale.set(s, s * 0.65, s);
    dummy.rotation.y = rand() * Math.PI * 2;
    dummy.updateMatrix();
    bushes.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.28 + rand() * 0.1, 0.48, 0.45 + rand() * 0.15);
    bushes.setColorAt(i, tint);
  });
  bushes.castShadow = true;
  scene.add(bushes);

  // --- grass tufts and flowers near the line ---------------------------------
  const GRASS = 380;
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.11, 0.55, 5), lambert(0x7fb069, true), GRASS);
  scatterNear(GRASS, 3.4, 26, (x, z, i) => {
    const s = 0.6 + rand() * 1.1;
    dummy.position.set(x, 0.22 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI, (rand() - 0.5) * 0.35);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.26 + rand() * 0.09, 0.5, 0.42 + rand() * 0.16);
    grass.setColorAt(i, tint);
  });
  scene.add(grass);

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
    const r = 175 + rand() * 165;
    const x = Math.cos(angle) * r;
    const z = -300 + Math.sin(angle) * r;
    if (!clearOf(x, z, 110)) continue;
    mountainsPlaced++;
    const h = 45 + rand() * 90;
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

  return { update };
}
