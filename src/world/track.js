import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

// Winding S-curve route laid out on the XZ plane, travelling roughly -Z.
const ROUTE = [
  [0, 0, 30],
  [0, 0, 0],
  [38, 0, -62],
  [-8, 0, -132],
  [-52, 0, -208],
  [-2, 0, -282],
  [58, 0, -352],
  [28, 0, -432],
  [-32, 0, -492],
  [-12, 0, -562],
  [22, 0, -625]
];

export function createTrack() {
  const curve = new THREE.CatmullRomCurve3(
    ROUTE.map((p) => new THREE.Vector3(...p)),
    false,
    'catmullrom',
    0.5
  );
  const length = curve.getLength();
  const group = new THREE.Group();

  // Two rails: tubes along curves offset perpendicular to the track.
  const railMat = new THREE.MeshLambertMaterial({ color: 0x5d5048 });
  const samples = 600;
  const tmpN = new THREE.Vector3();
  for (const offset of [-0.7, 0.7]) {
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      tmpN.crossVectors(UP, tan).normalize();
      pts.push(p.addScaledVector(tmpN, offset).setY(0.22));
    }
    const railCurve = new THREE.CatmullRomCurve3(pts);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, samples, 0.09, 6, false), railMat);
    group.add(rail);
  }

  // Sleepers: one InstancedMesh, placed at fixed arc-length intervals.
  const spacing = 1.9;
  const count = Math.floor(length / spacing);
  const sleeperGeo = new THREE.BoxGeometry(2.2, 0.16, 0.55);
  const sleeperMat = new THREE.MeshLambertMaterial({ color: 0x9a7350 });
  const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const t = (i * spacing) / length;
    curve.getPointAt(t, dummy.position);
    dummy.position.y = 0.08;
    const tan = curve.getTangentAt(t);
    dummy.lookAt(dummy.position.x + tan.x, 0.08, dummy.position.z + tan.z);
    dummy.updateMatrix();
    sleepers.setMatrixAt(i, dummy.matrix);
  }
  sleepers.receiveShadow = true;
  group.add(sleepers);

  return { curve, length, group };
}

// Pose helpers reused by the train, camera, and station placement.
export function pointAt(curve, length, dist, out) {
  const t = THREE.MathUtils.clamp(dist / length, 0, 1);
  return curve.getPointAt(t, out);
}

export function tangentAt(curve, length, dist, out) {
  const t = THREE.MathUtils.clamp(dist / length, 0, 1);
  return out ? out.copy(curve.getTangentAt(t)) : curve.getTangentAt(t);
}
