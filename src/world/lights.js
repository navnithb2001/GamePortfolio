import * as THREE from 'three';

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xfff7e6, 0xd9c39a, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2dc, 1.85);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // Tight frustum that follows the train so shadows stay crisp.
  const s = 55;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 220;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  function update(focus) {
    sun.position.set(focus.x + 45, 75, focus.z + 35);
    sun.target.position.set(focus.x, 0, focus.z);
  }

  return { update };
}
