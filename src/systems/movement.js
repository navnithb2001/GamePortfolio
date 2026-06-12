import * as THREE from 'three';

const ACCEL = 17; // u/s² under throttle
const BRAKE = 30; // u/s² when throttle opposes motion
const MAX_FWD = 26; // u/s
const MAX_REV = 12;
const AUTO_MAX = 70; // u/s fast-motion cap for route-map autopilot rides
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
      // Fast-motion autopilot: sprint toward the target, brake hard on arrival.
      const remaining = autoTarget - distance;
      const desired = THREE.MathUtils.clamp(remaining * 1.4, -AUTO_MAX, AUTO_MAX);
      velocity = THREE.MathUtils.damp(velocity, desired, 4.5, dt);
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

    const auto = autoTarget !== null;
    velocity = THREE.MathUtils.clamp(velocity, auto ? -AUTO_MAX : -MAX_REV, auto ? AUTO_MAX : MAX_FWD);
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
