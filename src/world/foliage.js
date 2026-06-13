import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// World-space sun direction, matching lights.js (focus + (45,75,35) → focus).
export const SUN_DIR = new THREE.Vector3(45, 75, 35).normalize();

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

// Port of Bruno Simon's Foliage canopy: ~80 small quads scattered over a
// sphere, each quad's normals blended 85% toward the sphere normal so the
// whole cloud shades like a soft round volume. Alpha is cut by his leaf SDF.
export function buildCanopyGeometry(seed = 1, count = 80) {
  const rng = mulberry32(seed);
  const planes = [];
  const tmp = new THREE.Vector3();
  const sphereN = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const plane = new THREE.PlaneGeometry(0.8, 0.8);

    const radius = 1 - Math.pow(rng(), 3);
    const theta = Math.PI * 2 * rng();
    const phi = Math.PI * rng();
    const sx = radius * Math.sin(phi) * Math.cos(theta);
    const sy = radius * Math.cos(phi);
    const sz = radius * Math.sin(phi) * Math.sin(theta);

    plane.rotateZ(rng() * 9999);
    plane.translate(sx, sy, sz);

    sphereN.set(sx, sy, sz).normalize();
    const pos = plane.attributes.position.array;
    const normals = new Float32Array(12);
    for (let v = 0; v < 4; v++) {
      const v3 = v * 3;
      tmp.set(pos[v3], pos[v3 + 1], pos[v3 + 2]).lerp(sphereN, 0.85).normalize();
      normals[v3] = tmp.x;
      normals[v3 + 1] = tmp.y;
      normals[v3 + 2] = tmp.z;
    }
    plane.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    planes.push(plane);
  }

  const geo = mergeGeometries(planes);
  planes.forEach((p) => p.dispose());
  return geo;
}

// MeshLambertMaterial whose albedo is a two-tone gradient driven by
// dot(worldNormal, sunDir) — lit side = colorB, shaded side = colorA — and
// whose alpha is cut by the leaf SDF so the quads read as clumps of leaves.
export function createFoliageMaterial({ colorA, colorB, foliageTexture }) {
  const material = new THREE.MeshLambertMaterial({
    alphaMap: foliageTexture,
    alphaTest: 0.32,
    side: THREE.DoubleSide,
    transparent: false
  });

  const uniforms = {
    uColorA: { value: new THREE.Color(colorA) },
    uColorB: { value: new THREE.Color(colorB) },
    uSunDir: { value: SUN_DIR.clone() }
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uColorA = uniforms.uColorA;
    shader.uniforms.uColorB = uniforms.uColorB;
    shader.uniforms.uSunDir = uniforms.uSunDir;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldNormalF;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
         vec3 wnF = objectNormal;
         #ifdef USE_INSTANCING
           wnF = mat3(instanceMatrix) * wnF;
         #endif
         vWorldNormalF = normalize(mat3(modelMatrix) * wnF);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uColorA;
         uniform vec3 uColorB;
         uniform vec3 uSunDir;
         varying vec3 vWorldNormalF;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float fMix = smoothstep(0.0, 1.0, dot(normalize(vWorldNormalF), uSunDir));
         diffuseColor.rgb *= mix(uColorA, uColorB, fMix);`
      );
  };

  // Leaf-shaped shadows instead of solid sphere blobs.
  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    alphaMap: foliageTexture,
    alphaTest: 0.32
  });

  return { material, depthMaterial, uniforms };
}
