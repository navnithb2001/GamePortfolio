import * as THREE from 'three';

export function createLights(scene) {
  // Lavender ground bounce tints shadowed faces purple against the warm sun —
  // the contrast that gives Bruno-style low-poly scenes their depth.
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6d3fff, 1.2);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd2c2, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // Tight frustum that follows the train so shadows stay crisp.
  const s = 60;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 230;
  sun.shadow.bias = -0.0002;
  sun.shadow.radius = 5;
  sun.shadow.blurSamples = 8;
  scene.add(sun);
  scene.add(sun.target);

  function update(focus) {
    sun.position.set(focus.x + 45, 75, focus.z + 35);
    sun.target.position.set(focus.x, 0, focus.z);
  }

  return { update };
}
