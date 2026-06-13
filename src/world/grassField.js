import * as THREE from 'three';

// Port of Bruno Simon's Grass.js to a classic-WebGL ShaderMaterial.
// A square tile of single-triangle blades wraps (modulo) around a moving
// center, here the train, so a dense field follows the camera. Blades
// billboard toward the camera, sway at the tip, take their height from value
// noise, and exist only where a meadow mask says so.

const GROUND_CENTER = new THREE.Vector2(0, -300);
const GROUND_SIZE = 1700;
const MASK_TEX = 1024;

const worldToMaskPx = (x, z) => [
  ((x - GROUND_CENTER.x) / GROUND_SIZE + 0.5) * MASK_TEX,
  ((z - GROUND_CENTER.y) / GROUND_SIZE + 0.5) * MASK_TEX
];

// The grass tile follows the train. Growth comes from a mask: a thick route
// ribbon plus organic meadow islands. That gives Bruno-style dense patches
// instead of a flat, uniform lawn.
function makeMaskTexture(meadows, corridor, stationPoints, ponds) {
  const c = document.createElement('canvas');
  c.width = c.height = MASK_TEX;
  const ctx = c.getContext('2d');
  const pxPerWorld = MASK_TEX / GROUND_SIZE;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, MASK_TEX, MASK_TEX);

  // Base continuous ribbon beside the track, kept clear of the rails below.
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 72 * pxPerWorld;
  ctx.beginPath();
  corridor.forEach((p, i) => {
    const [px, py] = worldToMaskPx(p.x, p.z);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Organic meadow patches with soft edges. These line up with the greener
  // paint on the ground texture so grass and terrain blend together.
  for (const m of meadows) {
    const [px, py] = worldToMaskPx(m.x, m.z);
    const r = m.r * pxPerWorld;
    const g = ctx.createRadialGradient(px, py, r * 0.18, px, py, r * 1.25);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.68, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r * 1.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft thinning patches for natural density variation, after growth paint so
  // they break up the carpet without creating desert-size holes.
  for (let i = 0; i < 620; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(Math.random() * MASK_TEX, Math.random() * MASK_TEX, 7 + Math.random() * 24, 0, Math.PI * 2);
    ctx.fill();
  }

  // Erase the rail line itself.
  ctx.strokeStyle = '#000';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.6 * pxPerWorld;
  ctx.beginPath();
  corridor.forEach((p, i) => {
    const [px, py] = worldToMaskPx(p.x, p.z);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Erase station platform discs.
  ctx.fillStyle = '#000';
  for (const p of stationPoints) {
    const [px, py] = worldToMaskPx(p.x, p.z);
    ctx.beginPath();
    ctx.arc(px, py, 12 * pxPerWorld, 0, Math.PI * 2);
    ctx.fill();
  }

  // Erase pond basins so water is visible and not stabbed through by blades.
  for (const p of ponds) {
    const [px, py] = worldToMaskPx(p.x, p.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.rotation || 0);
    ctx.scale(Math.max(p.rx, 1) * pxPerWorld, Math.max(p.rz, 1) * pxPerWorld);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createGrassField(scene, { meadows, corridor, stationPoints, ponds = [], fog }) {
  // Keep the grass tile bigger than the camera's forward view. A slightly
  // lower subdivision count cuts vertex cost, while wider blades preserve the
  // carpet read.
  const SIZE = 220;
  const SUB = 480;
  const count = SUB * SUB;
  const frag = SIZE / SUB;

  const aCenter = new Float32Array(count * 3 * 2);
  const aRand = new Float32Array(count * 3);
  const aVid = new Float32Array(count * 3);

  for (let ix = 0; ix < SUB; ix++) {
    const fx = (ix / SUB - 0.5) * SIZE + frag * 0.5;
    for (let iz = 0; iz < SUB; iz++) {
      const fz = (iz / SUB - 0.5) * SIZE + frag * 0.5;
      const i = ix * SUB + iz;
      const px = fx + (Math.random() - 0.5) * frag;
      const pz = fz + (Math.random() - 0.5) * frag;
      const r = Math.random();
      for (let v = 0; v < 3; v++) {
        aCenter[(i * 3 + v) * 2] = px;
        aCenter[(i * 3 + v) * 2 + 1] = pz;
        aRand[i * 3 + v] = r;
        aVid[i * 3 + v] = v;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  // Three's renderer uses the position attribute to determine non-indexed draw
  // count, even though this shader builds final positions from custom attrs.
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3 * 3), 3));
  geo.setAttribute('aCenter', new THREE.BufferAttribute(aCenter, 2));
  geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 1));
  geo.setAttribute('aVid', new THREE.BufferAttribute(aVid, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const maskTexture = makeMaskTexture(meadows, corridor, stationPoints, ponds);

  const uniforms = {
    uCenter: { value: new THREE.Vector2() },
    uTime: { value: 0 },
    uSize: { value: SIZE },
    uBladeWidth: { value: 0.22 },
    uBladeHeight: { value: 1.34 },
    uCamera: { value: new THREE.Vector3() },
    uMask: { value: maskTexture },
    uMaskCenter: { value: GROUND_CENTER.clone() },
    uMaskSize: { value: GROUND_SIZE },
    uColorBase: { value: new THREE.Color('#6f6a2c') },
    uColorTip: { value: new THREE.Color('#b8ad43') },
    uSunDir: { value: new THREE.Vector3(45, 75, 35).normalize() },
    uFogColor: { value: new THREE.Color(fog.color.getHex()) },
    uFogNear: { value: fog.near },
    uFogFar: { value: fog.far }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec2 aCenter;
      attribute float aRand;
      attribute float aVid;

      uniform vec2 uCenter;
      uniform float uTime;
      uniform float uSize;
      uniform float uBladeWidth;
      uniform float uBladeHeight;
      uniform vec3 uCamera;
      uniform sampler2D uMask;
      uniform vec2 uMaskCenter;
      uniform float uMaskSize;

      varying float vTip;
      varying float vGrass;
      varying float vTileFade;
      varying float vFogDepth;

      // cheap value noise for height variation
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        float a = hash(i), b = hash(i+vec2(1,0));
        float c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
      }

      void main() {
        // Wrap the blade's tile cell around the moving center.
        vec2 loop = aCenter - uCenter;
        float halfSize = uSize * 0.5;
        loop.x = mod(loop.x + halfSize, uSize) - halfSize;
        loop.y = mod(loop.y + halfSize, uSize) - halfSize;
        vec2 worldXZ = loop + uCenter;
        float edge = max(abs(loop.x), abs(loop.y));
        float tileFade = 1.0 - smoothstep(halfSize * 0.76, halfSize * 0.98, edge);
        vTileFade = tileFade;

        // Meadow mask drives whether (and how tall) grass grows here.
        vec2 muv = (worldXZ - uMaskCenter) / uMaskSize + 0.5;
        float grass = texture2D(uMask, muv).r;
        grass *= tileFade;
        vGrass = grass;

        float tip = step(aVid, 0.5);
        vTip = tip;

        // Gentle, low-frequency height variation — no bald patches or stray
        // tall tufts, just a softly undulating even lawn.
        float heightVar = vnoise(worldXZ * 0.07) * 0.36 + 0.8;
        float height = uBladeHeight * (0.78 + 0.32 * aRand) * heightVar * grass;

        // Blade triangle: tip up, two base corners spread by width.
        float sx = (aVid < 0.5) ? 0.0 : (aVid < 1.5 ? 1.0 : -1.0);
        float sy = (aVid < 0.5) ? 1.0 : 0.0;
        vec3 shape = vec3(sx * uBladeWidth * grass, sy * height, 0.0);

        vec3 pos = vec3(worldXZ.x, 0.0, worldXZ.y) + shape;

        // Billboard the blade toward the camera around its base.
        float ang = atan(worldXZ.y - uCamera.z, worldXZ.x - uCamera.x) - 1.5707963;
        float s = sin(ang), c = cos(ang);
        vec2 d = pos.xz - worldXZ;
        pos.xz = worldXZ + vec2(d.x * c - d.y * s, d.x * s + d.y * c);

        // Wind sway on the tip only.
        float w = sin(uTime * 1.6 + worldXZ.x * 0.5 + worldXZ.y * 0.4);
        pos.x += w * 0.18 * tip * height;
        pos.z += cos(uTime * 1.3 + worldXZ.x * 0.4) * 0.12 * tip * height;

        // Push hidden (non-meadow) blades far above the camera.
        pos.y += step(grass, 0.12) * 1000.0;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorBase;
      uniform vec3 uColorTip;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;

      varying float vTip;
      varying float vGrass;
      varying float vTileFade;
      varying float vFogDepth;

      void main() {
        vec3 col = mix(uColorBase, uColorTip, vTip);
        col *= 0.82 + 0.18 * vGrass;          // subtle density shading
        col = mix(col * 0.8, col, vTileFade);
        float fog = smoothstep(uFogNear, uFogFar, vFogDepth);
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.receiveShadow = false;
  scene.add(mesh);

  const lead = new THREE.Vector3();

  return {
    update(trainPos, camera, time) {
      lead.copy(trainPos).sub(camera.position);
      lead.y = 0;
      if (lead.lengthSq() > 0.0001) lead.normalize();
      else lead.set(0, 0, -1);
      uniforms.uCenter.value.set(trainPos.x + lead.x * 54, trainPos.z + lead.z * 54);
      uniforms.uCamera.value.copy(camera.position);
      uniforms.uTime.value = time;
    }
  };
}
