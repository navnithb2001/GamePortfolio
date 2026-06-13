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

// Forest-floor gradient + mottled speckle, plus painted meadow zones so the
// grass carpet sits on matching ground color instead of desert soil.
function makeGroundTexture(rand, meadows, corridor) {
  const c = document.createElement('canvas');
  c.width = c.height = TEX_SIZE;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(
    TEX_SIZE / 2, TEX_SIZE / 2, 100,
    TEX_SIZE / 2, TEX_SIZE / 2, TEX_SIZE * 0.74
  );
  grad.addColorStop(0, '#9c963f');
  grad.addColorStop(0.52, '#70773a');
  grad.addColorStop(1, '#46523a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = rand() > 0.55
      ? `rgba(54, 65, 34, ${0.035 + rand() * 0.05})`
      : `rgba(176, 166, 58, ${0.035 + rand() * 0.04})`;
    ctx.beginPath();
    ctx.arc(rand() * TEX_SIZE, rand() * TEX_SIZE, 24 + rand() * 92, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 7600; i++) {
    ctx.fillStyle = rand() > 0.72
      ? `rgba(96, 75, 43, ${0.025 + rand() * 0.04})`
      : `rgba(55, 68, 35, ${0.025 + rand() * 0.05})`;
    ctx.fillRect(rand() * TEX_SIZE, rand() * TEX_SIZE, 2.2, 2.2);
  }
  // Lush ground band along the corridor where the camera spends most time.
  const bandPx = (138 / GROUND_SIZE) * TEX_SIZE * 0.5;
  ctx.strokeStyle = 'rgba(157, 151, 48, 0.72)';
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
      g.addColorStop(0, `rgba(184, 173, 62, ${alpha})`);
      g.addColorStop(0.68, `rgba(124, 129, 48, ${alpha * 0.68})`);
      g.addColorStop(1, 'rgba(72, 88, 42, 0)');
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

function makeGrassTuftGeometry() {
  const positions = [];
  const addBlade = (angle, width, height, lean) => {
    const sx = Math.sin(angle);
    const cz = Math.cos(angle);
    const px = Math.cos(angle) * width;
    const pz = -Math.sin(angle) * width;
    positions.push(-px, 0, -pz, px, 0, pz, sx * lean, height, cz * lean);
  };

  for (let i = 0; i < 5; i++) {
    addBlade(i * 1.256 + (i % 2) * 0.34, 0.045 + i * 0.006, 0.55 + (i % 3) * 0.14, 0.05 + i * 0.012);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function makePondGeometries(rand, rx, rz, segments = 28) {
  const edge = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const wobble = 0.84 + rand() * 0.26 + Math.sin(a * 3.0 + rand() * 2.0) * 0.04;
    edge.push({
      x: Math.cos(a) * rx * wobble,
      z: Math.sin(a) * rz * wobble
    });
  }

  const waterPositions = [0, 0, 0];
  const waterUvs = [0.5, 0.5];
  const waterIndices = [];
  edge.forEach((p, i) => {
    waterPositions.push(p.x, 0, p.z);
    waterUvs.push(p.x / (rx * 2) + 0.5, p.z / (rz * 2) + 0.5);
    waterIndices.push(0, i + 1, ((i + 1) % segments) + 1);
  });

  const water = new THREE.BufferGeometry();
  water.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
  water.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2));
  water.setIndex(waterIndices);
  water.computeVertexNormals();

  const shorePositions = [];
  const shoreIndices = [];
  edge.forEach((p, i) => {
    const widen = 1.16 + rand() * 0.2;
    shorePositions.push(p.x, 0, p.z, p.x * widen, 0, p.z * widen);
    const j = (i + 1) % segments;
    shoreIndices.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1);
  });

  const shore = new THREE.BufferGeometry();
  shore.setAttribute('position', new THREE.Float32BufferAttribute(shorePositions, 3));
  shore.setIndex(shoreIndices);
  shore.computeVertexNormals();

  return { water, shore, edge };
}

function createPondWaterMaterial(fog) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#2c8aa3') },
      uShallow: { value: new THREE.Color('#83d4c2') },
      uFoam: { value: new THREE.Color('#fff1c7') },
      uFogColor: { value: new THREE.Color(fog.color.getHex()) },
      uFogNear: { value: fog.near },
      uFogFar: { value: fog.far }
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vFogDepth;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float waveA = sin((pos.x * 0.55 + pos.z * 0.38) + uTime * 1.25);
        float waveB = sin((pos.x * -0.32 + pos.z * 0.72) + uTime * 0.85);
        pos.y += (waveA + waveB) * 0.035;
        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorld = world.xyz;
        vec4 mv = viewMatrix * world;
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;

      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vFogDepth;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float dist = length(p);
        float shore = smoothstep(0.62, 1.0, dist);

        float slope = vWorld.x * 0.62 + vWorld.z * 0.44 + uTime * 0.48;
        float ripple = abs(fract(slope) - 0.5);
        float rippleLine = smoothstep(0.075, 0.0, ripple);
        float waterNoise = noise(vWorld.xz * 0.42 + uTime * 0.05);

        vec3 col = mix(uDeep, uShallow, shore * 0.7 + waterNoise * 0.22);
        col = mix(col, uFoam, rippleLine * (0.12 + shore * 0.2));
        col = mix(col, uFoam, smoothstep(0.72, 1.0, shore) * 0.28);

        float fog = smoothstep(uFogNear, uFogFar, vFogDepth);
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, 0.82);
      }
    `
  });
}

export function createScenery(scene, curve, trackLength, stationDistances, assets) {
  const rand = mulberry32(20260612);

  // Corridor samples used to keep props off the line.
  const corridor = [];
  for (let i = 0; i <= 240; i++) corridor.push(curve.getPointAt(i / 240));
  const stationPoints = stationDistances.map((d) => curve.getPointAt(d / trackLength));
  const UPv = new THREE.Vector3(0, 1, 0);
  const clearOf = (x, z, minDist) => {
    const d2 = minDist * minDist;
    for (const p of corridor) {
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < d2) return false;
    }
    return true;
  };
  const clearOfStations = (x, z, minDist) => {
    const d2 = minDist * minDist;
    for (const p of stationPoints) {
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < d2) return false;
    }
    return true;
  };
  const clearSpot = (x, z, trackDist, stationDist = trackDist) =>
    clearOf(x, z, trackDist) && clearOfStations(x, z, stationDist);
  const scatter = (count, minDist, spreadX, place) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 30) {
      guard++;
      const x = (rand() * 2 - 1) * spreadX;
      const z = 60 - rand() * 760;
      if (!clearSpot(x, z, minDist, minDist + 8)) continue;
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
      if (!clearSpot(x, z, minDist, minDist + 10)) continue;
      place(x, z, placed);
      placed++;
    }
  };

  // Meadow zones hugging the corridor — painted onto the ground texture and
  // filled with instanced grass below. One guaranteed meadow flanks every
  // station (where riders actually stop and look), plus random ones between.
  const meadows = [];
  for (const d of stationDistances) {
    const t = d / trackLength;
    const p = curve.getPointAt(t);
    const n = UPv.clone().cross(curve.getTangentAt(t)).normalize();
    for (const side of [1, -1]) {
      meadows.push({
        x: p.x + n.x * side * (15 + rand() * 12),
        z: p.z + n.z * side * (15 + rand() * 12),
        r: 24 + rand() * 18
      });
    }
  }
  {
    let guard = 0;
    while (meadows.length < 86 && guard < 1600) {
      guard++;
      const p = corridor[Math.floor(rand() * corridor.length)];
      const a = rand() * Math.PI * 2;
      const off = 9 + rand() * 76;
      const x = p.x + Math.cos(a) * off;
      const z = p.z + Math.sin(a) * off;
      const r = 14 + rand() * 22;
      if (!clearSpot(x, z, 3.4, 12)) continue;
      if (meadows.some((m) => (m.x - x) ** 2 + (m.z - z) ** 2 < (m.r + r) ** 2 * 0.22)) continue;
      meadows.push({ x, z, r });
    }
  }

  const meadowWeights = meadows.map((m) => m.r * m.r);
  const meadowTotalWeight = meadowWeights.reduce((sum, w) => sum + w, 0);
  const pickMeadow = () => {
    let target = rand() * meadowTotalWeight;
    for (let i = 0; i < meadows.length; i++) {
      target -= meadowWeights[i];
      if (target <= 0) return meadows[i];
    }
    return meadows[meadows.length - 1];
  };
  const scatterInMeadows = (count, minTrackDist, stationClear, place) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 45) {
      guard++;
      const m = pickMeadow();
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * m.r * (0.18 + rand() * 0.82);
      const squash = 0.72 + rand() * 0.42;
      const x = m.x + Math.cos(a) * r;
      const z = m.z + Math.sin(a) * r * squash;
      if (!clearSpot(x, z, minTrackDist, stationClear)) continue;
      place(x, z, placed, m);
      placed++;
    }
    return placed;
  };

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

  // --- Bruno Simon trees: instanced trunks + foliage canopies per species ----
  // The shared canopy geometry (an 80-quad sphere) is instanced once per leaf
  // anchor of every tree; each instance matrix = treePlacement * anchorMatrix.
  const canopyGeo = buildCanopyGeometry(7, 72);
  const speciesPick = ['oak', 'oak', 'oak', 'oak', 'oak', 'oak', 'cherry', 'birch'];
  const placements = { oak: [], cherry: [], birch: [] };

  const addTree = (x, z, scale) => {
    const sp = speciesPick[Math.floor(rand() * speciesPick.length)];
    dummy.position.set(x, 0, z);
    dummy.scale.set(
      scale * (0.82 + rand() * 0.28),
      scale * (0.92 + rand() * 0.22),
      scale * (0.82 + rand() * 0.28)
    );
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.updateMatrix();
    placements[sp].push(dummy.matrix.clone());
  };

  const treeTan = new THREE.Vector3();
  const treeNorm = new THREE.Vector3();
  const plantForestBelt = ({ count, minOffset, maxOffset, alongJitter, scaleMin, scaleMax, stationClear }) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 70) {
      guard++;
      const t = 0.02 + rand() * 0.96;
      const p = curve.getPointAt(t);
      treeTan.copy(curve.getTangentAt(t));
      treeNorm.crossVectors(UPv, treeTan).normalize();
      const side = rand() < 0.5 ? -1 : 1;
      const offset = minOffset + Math.pow(rand(), 0.82) * (maxOffset - minOffset);
      const along = (rand() - 0.5) * alongJitter;
      const x = p.x + treeNorm.x * side * offset + treeTan.x * along;
      const z = p.z + treeNorm.z * side * offset + treeTan.z * along;
      if (!clearSpot(x, z, 12, stationClear)) continue;
      addTree(x, z, scaleMin + rand() * (scaleMax - scaleMin));
      placed++;
    }
  };

  plantForestBelt({ count: 170, minOffset: 12, maxOffset: 27, alongJitter: 14, scaleMin: 0.48, scaleMax: 0.78, stationClear: 20 });
  plantForestBelt({ count: 250, minOffset: 18, maxOffset: 48, alongJitter: 22, scaleMin: 0.58, scaleMax: 1.0, stationClear: 24 });
  plantForestBelt({ count: 280, minOffset: 40, maxOffset: 96, alongJitter: 38, scaleMin: 0.72, scaleMax: 1.24, stationClear: 28 });
  plantForestBelt({ count: 190, minOffset: 84, maxOffset: 185, alongJitter: 60, scaleMin: 0.9, scaleMax: 1.65, stationClear: 34 });

  // Extra irregular woodland outside the corridor removes the "tree rows" read.
  scatter(110, 12, 245, (x, z) => {
    addTree(x, z, 0.65 + rand() * 0.75);
  });

  // Grove edges: trees share the same meadow footprints as the grass and
  // bushes, which is what makes the vegetation read as one continuous world.
  for (const m of meadows) {
    if (rand() > 0.58) continue;
    const trees = 2 + Math.floor(rand() * 6);
    for (let i = 0; i < trees; i++) {
      const a = rand() * Math.PI * 2;
      const r = m.r * (0.48 + rand() * 0.82);
      const x = m.x + Math.cos(a) * r;
      const z = m.z + Math.sin(a) * r;
      if (!clearSpot(x, z, 10, 18)) continue;
      addTree(x, z, 0.48 + rand() * 0.82);
    }
  }

  const tmpMat = new THREE.Matrix4();
  for (const sp of ['oak', 'cherry', 'birch']) {
    const data = assets.trees[sp];
    const mats = placements[sp];
    if (!mats.length || !data) continue;

    const trunks = new THREE.InstancedMesh(data.body, assets.paletteMat, mats.length);
    trunks.frustumCulled = false;
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
    canopies.frustumCulled = false;
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
  const BUSHES = 560;
  const bushMat = createFoliageMaterial({
    colorA: BUSH_COLORS[0],
    colorB: BUSH_COLORS[1],
    foliageTexture: assets.foliageTexture
  });
  const bushes = new THREE.InstancedMesh(canopyGeo, bushMat.material, BUSHES);
  bushes.frustumCulled = false;
  bushes.customDepthMaterial = bushMat.depthMaterial;
  bushes.castShadow = true;
  bushes.receiveShadow = true;
  let bushCount = 0;
  scatterInMeadows(BUSHES, 5.2, 12, (x, z) => {
    const s = 0.55 + rand() * 1.15;
    dummy.position.set(x, s * 0.7, z);
    dummy.scale.set(s * (0.85 + rand() * 0.3), s * (0.58 + rand() * 0.28), s * (0.85 + rand() * 0.3));
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.updateMatrix();
    bushes.setMatrixAt(bushCount++, dummy.matrix);
  });
  bushes.count = bushCount;
  scene.add(bushes);

  const FLOWERS = 760;
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 4).translate(0, 0.2, 0), lambert(0x5e9e54), FLOWERS);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 6, 5).translate(0, 0.44, 0), lambert(0xffffff), FLOWERS);
  stems.frustumCulled = false;
  heads.frustumCulled = false;
  const petals = [0xff8fab, 0xfff066, 0xffffff, 0xff9f43, 0xc9a7f5];
  let flowerCount = 0;
  scatterInMeadows(FLOWERS, 3.1, 9, (x, z) => {
    const s = 0.65 + rand() * 0.9;
    dummy.position.set(x, 0, z);
    dummy.scale.setScalar(s);
    dummy.rotation.set(0, 0, (rand() - 0.5) * 0.3);
    dummy.updateMatrix();
    stems.setMatrixAt(flowerCount, dummy.matrix);
    heads.setMatrixAt(flowerCount, dummy.matrix);
    heads.setColorAt(flowerCount, tint.set(petals[Math.floor(rand() * petals.length)]));
    flowerCount++;
  });
  stems.count = flowerCount;
  heads.count = flowerCount;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  scene.add(stems, heads);

  // Low-poly grass tufts stay visible from the chase camera where individual
  // shader blades collapse into a green texture at mid-distance.
  const TUFTS = 1400;
  const tuftGeo = makeGrassTuftGeometry();
  const tuftMat = new THREE.MeshLambertMaterial({ color: 0x756f2d, flatShading: true, side: THREE.DoubleSide });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, TUFTS);
  tufts.frustumCulled = false;
  tufts.castShadow = true;
  tufts.receiveShadow = true;
  let tuftCount = 0;
  scatterInMeadows(TUFTS, 2.8, 8, (x, z) => {
    const s = 0.42 + rand() * 0.72;
    dummy.position.set(x, 0, z);
    dummy.scale.set(s * (0.72 + rand() * 0.5), s * (0.7 + rand() * 0.55), s * (0.72 + rand() * 0.5));
    dummy.rotation.set((rand() - 0.5) * 0.28, rand() * Math.PI * 2, (rand() - 0.5) * 0.28);
    dummy.updateMatrix();
    tufts.setMatrixAt(tuftCount++, dummy.matrix);
  });
  tufts.count = tuftCount;
  scene.add(tufts);

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
  const ponds = [];
  const waterMaterial = createPondWaterMaterial(scene.fog);
  const shoreMat = lambert(0xc99756, true);
  const reedMat = lambert(0x6d7a2f, true);
  const reedTipMat = lambert(0x4e3321, true);
  const waterStoneMat = lambert(0xd8cfc0, true);
  const pondSpecs = [
    { t: 0.14, side: -1, offset: 45, rx: 18, rz: 11, rot: 0.25 },
    { t: 0.32, side: 1, offset: 58, rx: 14, rz: 9, rot: -0.35 },
    { t: 0.52, side: -1, offset: 62, rx: 20, rz: 12, rot: 0.7 },
    { t: 0.72, side: 1, offset: 46, rx: 13, rz: 8, rot: 0.15 }
  ];
  const pondTan = new THREE.Vector3();
  const pondNorm = new THREE.Vector3();
  const pondCenter = new THREE.Vector3();
  const rippleRings = [];
  const reedGeo = new THREE.CylinderGeometry(0.035, 0.055, 1.5, 5).translate(0, 0.75, 0);
  const reedTipGeo = new THREE.ConeGeometry(0.12, 0.36, 6).translate(0, 1.64, 0);

  for (const spec of pondSpecs) {
    const p = curve.getPointAt(spec.t);
    pondTan.copy(curve.getTangentAt(spec.t));
    pondNorm.crossVectors(UPv, pondTan).normalize();
    pondCenter.copy(p).addScaledVector(pondNorm, spec.side * spec.offset);
    if (!clearSpot(pondCenter.x, pondCenter.z, 18, 26)) continue;

    const pondGroup = new THREE.Group();
    pondGroup.position.set(pondCenter.x, 0, pondCenter.z);
    pondGroup.rotation.y = Math.atan2(pondTan.x, pondTan.z) + spec.rot;

    const { water, shore, edge } = makePondGeometries(rand, spec.rx, spec.rz);
    const shoreMesh = new THREE.Mesh(shore, shoreMat);
    shoreMesh.position.y = 0.018;
    shoreMesh.receiveShadow = true;

    const waterMesh = new THREE.Mesh(water, waterMaterial);
    waterMesh.position.y = 0.095;
    waterMesh.renderOrder = 2;

    pondGroup.add(shoreMesh, waterMesh);

    for (let i = 0; i < 18; i++) {
      const edgePoint = edge[Math.floor(rand() * edge.length)];
      const reed = new THREE.Mesh(reedGeo, reedMat);
      reed.position.set(edgePoint.x * (0.9 + rand() * 0.22), 0.02, edgePoint.z * (0.9 + rand() * 0.22));
      reed.rotation.set((rand() - 0.5) * 0.28, rand() * Math.PI * 2, (rand() - 0.5) * 0.28);
      reed.scale.setScalar(0.75 + rand() * 0.65);
      reed.castShadow = true;
      const tip = new THREE.Mesh(reedTipGeo, reedTipMat);
      tip.position.copy(reed.position);
      tip.rotation.copy(reed.rotation);
      tip.scale.copy(reed.scale);
      tip.castShadow = true;
      pondGroup.add(reed, tip);
    }

    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 + rand() * 0.45, 0), waterStoneMat);
      stone.position.set(Math.cos(a) * spec.rx * (0.72 + rand() * 0.36), 0.16, Math.sin(a) * spec.rz * (0.72 + rand() * 0.36));
      stone.scale.set(1.5 + rand(), 0.22, 0.9 + rand() * 0.8);
      stone.rotation.set(rand() * 0.2, rand() * Math.PI, rand() * 0.2);
      stone.castShadow = true;
      stone.receiveShadow = true;
      pondGroup.add(stone);
    }

    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9 + i * 0.72, 0.96 + i * 0.72, 34),
        new THREE.MeshBasicMaterial({ color: 0xfff1c7, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set((rand() - 0.5) * spec.rx * 0.65, 0.12 + i * 0.004, (rand() - 0.5) * spec.rz * 0.65);
      ring.userData.phase = rand() * Math.PI * 2;
      ring.userData.speed = 0.45 + rand() * 0.35;
      pondGroup.add(ring);
      rippleRings.push(ring);
    }

    scene.add(pondGroup);
    ponds.push({
      x: pondCenter.x,
      z: pondCenter.z,
      rx: spec.rx * 1.22,
      rz: spec.rz * 1.22,
      rotation: pondGroup.rotation.y
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
  const hillTones = [0x7fa457, 0x6f9650, 0x8fab5b, 0x5f844c];
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
  const mountainMat = lambert(0x8d9574, true);
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
  const cloudGeo = new THREE.SphereGeometry(1, 12, 8);
  const cloudMats = [
    new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: 0xf1f4fb, fog: false, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: 0xdfe6f2, fog: false, toneMapped: false })
  ];
  const clouds = [];
  const addCloud = (x, y, z, cloudScale) => {
    const cloud = new THREE.Group();
    const blobs = 5 + Math.floor(rand() * 6);
    for (let b = 0; b < blobs; b++) {
      const s = cloudScale * (2.5 + rand() * 2.7);
      const mat = b % 5 === 0 ? cloudMats[2] : (b % 3 === 0 ? cloudMats[1] : cloudMats[0]);
      const blob = new THREE.Mesh(cloudGeo, mat);
      blob.position.set(
        (b - (blobs - 1) * 0.5) * cloudScale * (3.15 + rand() * 0.8) + (rand() - 0.5) * 2.6,
        (rand() - 0.18) * cloudScale * 1.2,
        (rand() - 0.5) * cloudScale * 4.8
      );
      blob.scale.set(
        s * (1.2 + rand() * 0.75),
        s * (0.3 + rand() * 0.18),
        s * (0.62 + rand() * 0.42)
      );
      cloud.add(blob);
    }
    cloud.position.set(x, y, z);
    cloud.rotation.y = (rand() - 0.5) * 0.18;
    cloud.userData.speed = 0.2 + rand() * 0.45;
    cloud.userData.wrap = 300 + cloudScale * 32;
    scene.add(cloud);
    clouds.push(cloud);
  };

  for (let i = 0; i < 38; i++) {
    addCloud(
      (rand() * 2 - 1) * 305,
      58 + rand() * 44,
      80 - rand() * 850,
      0.62 + rand() * 1.0
    );
  }
  for (let i = 0; i < 16; i++) {
    addCloud(
      (i / 15 - 0.5) * 520 + (rand() - 0.5) * 34,
      62 + rand() * 25,
      25 - rand() * 330,
      0.7 + rand() * 0.75
    );
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
    waterMaterial.uniforms.uTime.value = time;
    for (const ring of rippleRings) {
      const k = (time * ring.userData.speed + ring.userData.phase) % 1;
      const s = 0.65 + k * 1.8;
      ring.scale.setScalar(s);
      ring.material.opacity = 0.2 * (1 - k);
    }
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > c.userData.wrap) c.position.x = -c.userData.wrap;
    }
    for (const b of balloons) {
      b.position.y += Math.sin(time * 1.4 + b.userData.phase) * 0.003;
      b.rotation.z = Math.sin(time * 0.9 + b.userData.phase) * 0.06;
    }
  }

  return { update, meadows, corridor, stationPoints, ponds };
}
