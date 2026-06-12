import * as THREE from 'three';
import { pointAt, tangentAt } from './track.js';

const COLORS = {
  body: 0xd94f3d,
  chassis: 0x3a3243,
  trim: 0xfff3df,
  wheel: 0x2c2733,
  hub: 0xc9b9a1,
  coach: 0x4ba3a8,
  roof: 0xfff3df
};

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function addShadows(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

// Wheel geometry baked so mesh.rotation.x rolls the wheel.
function makeWheel(r, w) {
  const geo = new THREE.CylinderGeometry(r, r, w, 14);
  geo.rotateZ(Math.PI / 2);
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(geo, lambert(COLORS.wheel));
  const hubGeo = new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.04, 10);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, lambert(COLORS.hub));
  wheel.add(tire, hub);
  return wheel;
}

function buildLocomotive(wheels) {
  const loco = new THREE.Group();

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 4.0), lambert(COLORS.chassis));
  chassis.position.y = 0.75;
  loco.add(chassis);

  const boilerGeo = new THREE.CylinderGeometry(0.62, 0.62, 2.3, 14);
  boilerGeo.rotateX(Math.PI / 2);
  const boiler = new THREE.Mesh(boilerGeo, lambert(COLORS.body));
  boiler.position.set(0, 1.45, 0.75);
  loco.add(boiler);

  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.25, 14).rotateX(Math.PI / 2), lambert(COLORS.trim));
  nose.position.set(0, 1.45, 1.95);
  loco.add(nose);

  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.55, 10), lambert(COLORS.chassis));
  chimney.position.set(0, 2.25, 1.55);
  loco.add(chimney);
  const chimneyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10), lambert(COLORS.chassis));
  chimneyCap.position.set(0, 2.55, 1.55);
  loco.add(chimneyCap);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lambert(COLORS.trim));
  dome.position.set(0, 2.05, 0.6);
  loco.add(dome);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.3), lambert(COLORS.body));
  cab.position.set(0, 1.75, -1.15);
  loco.add(cab);
  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 1.6), lambert(COLORS.roof));
  cabRoof.position.set(0, 2.58, -1.15);
  loco.add(cabRoof);
  const cabWindow = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.55, 0.7), lambert(0xbfe6ef));
  cabWindow.position.set(0, 1.95, -0.95);
  loco.add(cabWindow);

  // Cowcatcher: a wedge at the front.
  const cow = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.9, 4), lambert(COLORS.chassis));
  cow.rotation.set(-Math.PI / 2.6, Math.PI / 4, 0);
  cow.position.set(0, 0.55, 2.1);
  loco.add(cow);

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.18, 10).rotateX(Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xfff1b8, emissive: 0xffd860, emissiveIntensity: 0.9 })
  );
  lamp.position.set(0, 1.85, 2.12);
  loco.add(lamp);

  // Three drive wheels per side.
  for (const side of [-0.78, 0.78]) {
    for (const z of [1.0, 0, -1.0]) {
      const w = makeWheel(0.42, 0.18);
      w.position.set(side, 0.42, z);
      loco.add(w);
      wheels.push(w);
    }
  }
  return loco;
}

function buildCoach(wheels) {
  const coach = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 3.0), lambert(COLORS.coach));
  body.position.y = 1.35;
  coach.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 3.3), lambert(COLORS.roof));
  roof.position.y = 2.08;
  coach.add(roof);
  const winMat = lambert(0xbfe6ef);
  for (const z of [-0.95, 0, 0.95]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.5, 0.55), winMat);
    win.position.set(0, 1.55, z);
    coach.add(win);
  }
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 2.7), lambert(COLORS.chassis));
  skirt.position.y = 0.62;
  coach.add(skirt);
  for (const side of [-0.78, 0.78]) {
    for (const z of [0.95, -0.95]) {
      const w = makeWheel(0.34, 0.16);
      w.position.set(side, 0.34, z);
      coach.add(w);
      wheels.push(w);
    }
  }
  return coach;
}

export function createTrain(scene, curve, trackLength) {
  const wheels = [];
  const loco = buildLocomotive(wheels);
  const coach = buildCoach(wheels);
  addShadows(loco);
  addShadows(coach);
  scene.add(loco, coach);

  // Smoke puff pool — each puff owns a material so opacity fades independently.
  const puffGeo = new THREE.SphereGeometry(1, 8, 6);
  const puffs = [];
  for (let i = 0; i < 22; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const m = new THREE.Mesh(puffGeo, mat);
    m.visible = false;
    scene.add(m);
    puffs.push({ mesh: m, life: 0, maxLife: 1 });
  }
  let puffTimer = 0;
  const chimneyWorld = new THREE.Vector3();

  const tmpPos = new THREE.Vector3();
  const tmpTan = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const COACH_GAP = 4.2;

  function placeOnTrack(obj, dist) {
    pointAt(curve, trackLength, dist, tmpPos);
    tangentAt(curve, trackLength, dist, tmpTan);
    obj.position.copy(tmpPos);
    tmpLook.copy(tmpPos).add(tmpTan);
    obj.lookAt(tmpLook); // model front is +Z, matching Object3D.lookAt
  }

  function update(dist, velocity, dt, time) {
    placeOnTrack(loco, dist);
    placeOnTrack(coach, dist - COACH_GAP);

    const roll = (velocity * dt) / 0.4;
    for (const w of wheels) w.rotation.x += roll;

    // Gentle chuff bob scaled by speed.
    loco.position.y += Math.abs(Math.sin(time * 14)) * 0.015 * Math.min(Math.abs(velocity) / 10, 1);

    // Smoke: spawn faster the harder the train works.
    const speed = Math.abs(velocity);
    puffTimer -= dt;
    if (speed > 0.6 && puffTimer <= 0) {
      puffTimer = THREE.MathUtils.lerp(0.42, 0.09, Math.min(speed / 24, 1));
      const free = puffs.find((p) => p.life <= 0);
      if (free) {
        loco.localToWorld(chimneyWorld.set(0, 2.6, 1.55));
        free.mesh.position.copy(chimneyWorld);
        free.maxLife = 1.5 + Math.random() * 0.4;
        free.life = free.maxLife;
        free.mesh.visible = true;
      }
    }
    for (const p of puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = 1 - p.life / p.maxLife; // 0 → 1 over lifetime
      p.mesh.position.y += dt * 1.9;
      p.mesh.scale.setScalar(0.35 + k * 1.5);
      p.mesh.material.opacity = 0.8 * (1 - k);
      if (p.life <= 0) p.mesh.visible = false;
    }
  }

  return { loco, update };
}
