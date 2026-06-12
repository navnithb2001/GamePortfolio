import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const WALL = 0xfff3df;
const DARK = 0x3a3243;

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function hex(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function makeSignTexture(name, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = hex(color);
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 128, 22);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 64px "Avenir Next", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 256, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture(name) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 1024, 256);
  ctx.fillStyle = 'rgba(58, 50, 67, 0.78)';
  ctx.font = '800 150px "Avenir Next", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 512, 138);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Builds one station (platform, building, sign) facing local +Z toward the track.
function buildStation(name, color) {
  const g = new THREE.Group();
  const accent = lambert(color);

  const platform = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 5), lambert(0xd9c4a3));
  platform.position.set(0, 0.45, 3.4);
  g.add(platform);

  const building = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 4), lambert(WALL));
  building.position.set(0, 2.6, 0);
  g.add(building);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.4, 4), accent);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.05, 1, 0.62);
  roof.position.set(0, 5.5, 0);
  g.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.2), lambert(DARK));
  door.position.set(0, 1.95, 2.0);
  g.add(door);
  for (const x of [-2.4, 2.4]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.2), lambert(0xbfe6ef));
    win.position.set(x, 2.7, 2.0);
    g.add(win);
  }

  // Awning over the platform edge.
  const awning = new THREE.Mesh(new THREE.BoxGeometry(9, 0.18, 2.4), accent);
  awning.position.set(0, 4.0, 3.3);
  g.add(awning);
  for (const x of [-4, 4]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.1, 8), lambert(DARK));
    post.position.set(x, 2.4, 4.1);
    g.add(post);
  }

  // Name board on two posts at the platform's track edge. Lives in its own
  // group so placement code can spin it to face approaching trains.
  const signGroup = new THREE.Group();
  signGroup.position.set(0, 0, 5.55);
  const signTex = makeSignTexture(name, color);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 1.75),
    new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, toneMapped: false })
  );
  sign.position.set(0, 4.0, 0.08);
  signGroup.add(sign);
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.95, 0.12), lambert(WALL));
  signBack.position.set(0, 4.0, 0);
  signGroup.add(signBack);
  for (const x of [-3.2, 3.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 8), lambert(DARK));
    post.position.set(x, 2.3, 0);
    signGroup.add(post);
  }
  g.add(signGroup);

  // Warm glowing platform lamps.
  for (const x of [-6.8, 6.8]) {
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.5, 6), lambert(DARK));
    lampPole.position.set(x, 2.15, 4.2);
    g.add(lampPole);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xffe9c0, emissive: 0xffb84d, emissiveIntensity: 1.4 })
    );
    bulb.position.set(x, 3.55, 4.2);
    g.add(bulb);
  }

  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.7), accent);
  bench.position.set(5.2, 1.3, 3.2);
  g.add(bench);
  for (const x of [4.3, 6.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.6), lambert(DARK));
    leg.position.set(x, 1.05, 3.2);
    g.add(leg);
  }

  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // Glow ring on the roof tip used as the "you are here" highlight.
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 10, 8),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.0 })
  );
  beacon.position.set(0, 6.9, 0);
  g.add(beacon);

  return { group: g, signGroup, beaconMat: beacon.material };
}

// Places a station beside the track plus its big name painted on the ground.
export function createStations(scene, curve, trackLength, stationDefs) {
  const built = [];
  const tmpTan = new THREE.Vector3();
  const tmpNorm = new THREE.Vector3();

  stationDefs.forEach((def, i) => {
    const t = THREE.MathUtils.clamp(def.distance / trackLength, 0, 1);
    const point = curve.getPointAt(t);
    tmpTan.copy(curve.getTangentAt(t));
    tmpNorm.crossVectors(UP, tmpTan).normalize();
    const side = i % 2 === 0 ? 1 : -1;

    const { group, signGroup, beaconMat } = buildStation(def.name, def.color);
    group.position.copy(point).addScaledVector(tmpNorm, side * 9.5);
    group.position.y = 0;
    group.lookAt(point.x, 0, point.z);
    scene.add(group);
    // Spin the name board to face down the line so it reads on approach
    // (group.lookAt on flat ground yields a pure yaw, so subtraction works).
    signGroup.rotation.y = Math.atan2(-tmpTan.x, -tmpTan.z) - group.rotation.y;

    // Ground label on the opposite side, oriented to read while driving in.
    const heading = Math.atan2(tmpTan.x, tmpTan.z);
    const labelHolder = new THREE.Group();
    labelHolder.position.copy(point).addScaledVector(tmpNorm, -side * 11.5);
    labelHolder.position.y = 0.06;
    labelHolder.rotation.y = heading + Math.PI;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 3.75),
      new THREE.MeshBasicMaterial({ map: makeGroundTexture(def.name), transparent: true, toneMapped: false })
    );
    label.rotation.x = -Math.PI / 2;
    labelHolder.add(label);
    scene.add(labelHolder);

    built.push({
      def,
      setActive(on) {
        beaconMat.emissiveIntensity = on ? 0.9 : 0.0;
      }
    });
  });

  // Buffer stop at the end of the line.
  const endT = 1;
  const endPoint = curve.getPointAt(endT);
  tmpTan.copy(curve.getTangentAt(endT));
  const buffer = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.6), lambert(0xd94f3d));
  block.position.y = 1.0;
  buffer.add(block);
  for (const x of [-0.7, 0.7]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 1.8), lambert(DARK));
    strut.position.set(x, 0.55, -0.8);
    strut.rotation.x = -0.5;
    buffer.add(strut);
  }
  buffer.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  buffer.position.copy(endPoint).addScaledVector(tmpTan, 1.2);
  buffer.lookAt(endPoint.x, 0, endPoint.z);
  scene.add(buffer);

  return built;
}
