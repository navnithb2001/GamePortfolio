import * as THREE from 'three';
import './style.css';
import { STATIONS } from './content.js';
import { createTrack } from './world/track.js';
import { createTrain } from './world/train.js';
import { createStations } from './world/stations.js';
import { createScenery } from './world/scenery.js';
import { createLights } from './world/lights.js';
import { createControls } from './systems/controls.js';
import { createMovement } from './systems/movement.js';
import { createChaseCamera } from './systems/camera.js';
import { createZones } from './systems/zones.js';
import { createOverlay } from './ui/overlay.js';

const SKY = 0xfdeed7;

// --- renderer / scene -------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 130, 460);

// --- world -------------------------------------------------------------------
const { curve, length: trackLength, group: trackGroup } = createTrack();
scene.add(trackGroup);

// Stations spread along the line: welcome near the start, contact at the buffer.
const FIRST = 30;
const LAST = trackLength - 14;
const stationDefs = STATIONS.map((def, i) => ({
  ...def,
  distance: FIRST + (i * (LAST - FIRST)) / (STATIONS.length - 1)
}));
const stationDistances = stationDefs.map((s) => s.distance);

const builtStations = createStations(scene, curve, trackLength, stationDefs);
const scenery = createScenery(scene, curve, SKY);
const lights = createLights(scene);
const train = createTrain(scene, curve, trackLength);

// Deep link: ?at=education starts the ride at that station (&d=-20 nudges).
const params = new URLSearchParams(location.search);
const startStation = stationDefs.find((s) => s.id === params.get('at')) ?? stationDefs[0];
const startDistance = startStation.distance + (Number(params.get('d')) || 0);

// --- systems / ui ------------------------------------------------------------
const movement = createMovement(trackLength, startDistance);
const { camera, update: updateCamera, resize: resizeCamera } = createChaseCamera(
  curve,
  trackLength,
  startDistance
);

const overlay = createOverlay(stationDefs, {
  onStopClick: (i) => movement.driveTo(stationDefs[i].distance)
});

// ?go=skills auto-drives there on load (also handy for headless testing).
const goStation = stationDefs.find((s) => s.id === params.get('go'));
if (goStation) movement.driveTo(goStation.distance);

const controls = createControls({
  onFirstInput: () => overlay.hideHint()
});

const zones = createZones(stationDefs, {
  onEnter: (i) => {
    overlay.showCard(stationDefs[i]);
    overlay.setActiveStop(i);
    builtStations[i].setActive(true);
  },
  onLeave: (i) => {
    overlay.hideCard();
    overlay.setActiveStop(-1);
    builtStations[i].setActive(false);
  }
});

// --- loop ---------------------------------------------------------------------
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  resizeCamera();
});

const timer = new THREE.Timer();
const trainPos = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const time = timer.getElapsed();

  const { distance, velocity } = movement.update(
    dt,
    controls.getThrottle(),
    controls.consumeWheelImpulse(),
    controls.consumeManualFlag()
  );

  train.update(distance, velocity, dt, time);
  zones.update(distance);
  overlay.updateProgress(distance, stationDistances);
  updateCamera(distance, dt);

  trainPos.copy(train.loco.position);
  lights.update(trainPos);
  scenery.update(dt, time);

  // debug: ?cam=x,y,z,tx,ty,tz pins the camera
  const camOverride = params.get('cam');
  if (camOverride) {
    const [x, y, z, tx, ty, tz] = camOverride.split(',').map(Number);
    camera.position.set(x, y, z);
    camera.lookAt(tx, ty, tz);
  }

  renderer.render(scene, camera);
});
