import * as THREE from 'three';
import { pointAt, tangentAt } from '../world/track.js';

const CHASE_BACK = 16;
const CHASE_UP = 8.5;
const LOOK_AHEAD = 7;

export function createChaseCamera(curve, trackLength, startDistance) {
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 700);
  let baseFov = 50;

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

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    baseFov = camera.aspect < 0.8 ? 64 : 50; // wider view in portrait
    camera.updateProjectionMatrix();
  }

  // Start pulled out high for a brief establishing glide-in.
  resize();
  camera.fov = baseFov;
  computeDesired(startDistance);
  camera.position.copy(desired).add(new THREE.Vector3(26, 30, 30));
  smoothedLook.copy(lookTarget);
  camera.lookAt(smoothedLook);

  function update(dist, dt, velocity = 0) {
    computeDesired(dist);
    const speed = Math.abs(velocity);
    // Stiffen the chase at speed so a 70 u/s autopilot sprint doesn't leave
    // the train a tiny dot far ahead of a lagging camera.
    const lambda = 2.6 + speed * 0.07;
    camera.position.lerp(desired, 1 - Math.exp(-lambda * dt));
    smoothedLook.lerp(lookTarget, 1 - Math.exp(-(4 + speed * 0.07) * dt));
    camera.lookAt(smoothedLook);

    // FOV kick: subtle at driving speed, pronounced in fast motion.
    const targetFov = baseFov + Math.min(speed / 70, 1) ** 1.5 * 11;
    camera.fov += (targetFov - camera.fov) * Math.min(3 * dt, 1);
    camera.updateProjectionMatrix();
  }

  return { camera, update, resize };
}
