import * as THREE from 'three';

const ACCEL = 17; // u/s² under throttle
const BRAKE = 30; // u/s² when throttle opposes motion
const MAX_FWD = 26; // u/s
const MAX_REV = 12;
const DRAG = 1.1; // exponential coast decay
const MIN_DIST = 4.6; // keeps the coach on the rails at the rear

export function createMovement(trackLength, startDistance) {
  let distance = startDistance;
  let velocity = 0;
  let autoTarget = null;

  function update(dt, throttle, wheelImpulse, manualInput) {
    if (manualInput) autoTarget = null;

    velocity += wheelImpulse;

    if (autoTarget !== null) {
      // Autopilot: chase a velocity proportional to remaining distance.
      const remaining = autoTarget - distance;
      const desired = THREE.MathUtils.clamp(remaining * 0.55, -MAX_FWD * 0.8, MAX_FWD * 0.8);
      velocity = THREE.MathUtils.damp(velocity, desired, 3.5, dt);
      if (Math.abs(remaining) < 0.4 && Math.abs(velocity) < 0.6) {
        velocity = 0;
        autoTarget = null;
      }
    } else if (throttle !== 0) {
      const opposing = Math.sign(throttle) !== Math.sign(velocity) && velocity !== 0;
      velocity += throttle * (opposing ? BRAKE : ACCEL) * dt;
    } else {
      velocity *= Math.exp(-DRAG * dt);
      if (Math.abs(velocity) < 0.02) velocity = 0;
    }

    velocity = THREE.MathUtils.clamp(velocity, -MAX_REV, MAX_FWD);
    distance += velocity * dt;

    // Hard stops at the buffer ends.
    if (distance <= MIN_DIST) {
      distance = MIN_DIST;
      if (velocity < 0) velocity = 0;
    } else if (distance >= trackLength - 0.5) {
      distance = trackLength - 0.5;
      if (velocity > 0) velocity = 0;
    }

    return { distance, velocity };
  }

  return {
    update,
    driveTo(target) {
      autoTarget = THREE.MathUtils.clamp(target, MIN_DIST, trackLength - 0.5);
    },
    get distance() {
      return distance;
    },
    get velocity() {
      return velocity;
    }
  };
}
