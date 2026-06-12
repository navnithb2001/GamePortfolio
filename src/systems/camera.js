import * as THREE from 'three';
import { pointAt, tangentAt } from '../world/track.js';

const CHASE_BACK = 16;
const CHASE_UP = 8.5;
const LOOK_AHEAD = 7;

export function createChaseCamera(curve, trackLength, startDistance) {
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 700);

  const trainPos = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const smoothedLook = new THREE.Vector3();

  function computeDesired(dist) {
    pointAt(curve, trackLength, dist, trainPos);
    tangentAt(curve, trackLength, dist, tangent);
    desired.copy(trainPos).addScaledVector(tangent, -CHASE_BACK);
    desired.y += CHASE_UP;
    lookTarget.copy(trainPos).addScaledVector(tangent, LOOK_AHEAD);
    lookTarget.y += 3;
  }

  // Start pulled out high for a brief establishing glide-in.
  resize();
  computeDesired(startDistance);
  camera.position.copy(desired).add(new THREE.Vector3(26, 30, 30));
  smoothedLook.copy(lookTarget);
  camera.lookAt(smoothedLook);

  function update(dist, dt) {
    computeDesired(dist);
    const k = 1 - Math.exp(-2.6 * dt);
    camera.position.lerp(desired, k);
    smoothedLook.lerp(lookTarget, 1 - Math.exp(-4 * dt));
    camera.lookAt(smoothedLook);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = camera.aspect < 0.8 ? 64 : 50; // wider view in portrait
    camera.updateProjectionMatrix();
  }

  return { camera, update, resize };
}
