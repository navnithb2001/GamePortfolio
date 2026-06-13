import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Loads the (MIT-licensed) graphics borrowed from Bruno Simon's folio-2025.
// His runtime uses three/webgpu + TSL materials that don't survive glTF
// export, so every mesh comes in with a flat "palette" material — we re-apply
// his palette.png swatch atlas through the meshes' own UVs to recover the
// exact baked colors, and swap emissive glass for a bright unlit bulb.

const BASE = `${import.meta.env.BASE_URL}folio-assets/`;

function load(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

// Extract trunk geometry (tree-local) + each leaf node's matrix as a canopy
// anchor, following Trees.js (treeBody mesh + treeLeaves* anchor nodes).
function parseTree(scene) {
  scene.updateMatrixWorld(true);
  let body = null;
  const anchors = [];
  scene.traverse((child) => {
    if (!child.isMesh) return;
    if (child.name.startsWith('treeBody')) body = child;
    else if (child.name.startsWith('treeLeaves')) anchors.push(child.matrixWorld.clone());
  });
  return { body: body.geometry, anchors };
}

export async function loadFolioAssets() {
  const gltf = new GLTFLoader();
  const tex = new THREE.TextureLoader();

  const [oakG, cherryG, birchG, benchesG, lanternsG, foliageTexture, paletteTexture] =
    await Promise.all([
      load(gltf, `${BASE}oakTreesVisual.glb`),
      load(gltf, `${BASE}cherryTreesVisual.glb`),
      load(gltf, `${BASE}birchTreesVisual.glb`),
      load(gltf, `${BASE}benches.glb`),
      load(gltf, `${BASE}lanterns.glb`),
      load(tex, `${BASE}foliageSDF.png`),
      load(tex, `${BASE}palette.png`)
    ]);

  foliageTexture.colorSpace = THREE.NoColorSpace;
  foliageTexture.flipY = false;

  paletteTexture.colorSpace = THREE.SRGBColorSpace;
  paletteTexture.flipY = false; // glTF UV convention
  paletteTexture.magFilter = THREE.NearestFilter;
  paletteTexture.minFilter = THREE.NearestFilter;
  paletteTexture.generateMipmaps = false;

  const paletteMat = new THREE.MeshLambertMaterial({ map: paletteTexture });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff7a2e });

  // Re-skin a loaded prop: palette swatches for body, bright bulb for glass.
  const reskin = (root) => {
    root.traverse((child) => {
      if (!child.isMesh) return;
      const emissive = child.material && /emissive/i.test(child.material.name || '');
      child.material = emissive ? bulbMat : paletteMat;
      child.castShadow = true;
      child.receiveShadow = true;
    });
  };

  // Pull one representative prop out of the model (his GLBs ship many placed
  // copies), recentered at the origin so we can re-place it ourselves.
  const extractProto = (scene, meshFilter, includeNames) => {
    scene.updateMatrixWorld(true);
    const group = new THREE.Group();
    let ref = null;
    scene.traverse((child) => {
      if (child.isMesh && meshFilter(child.name) && !ref) ref = child;
    });
    const base = ref.getWorldPosition(new THREE.Vector3());
    scene.traverse((child) => {
      if (!child.isMesh || !includeNames(child.name)) return;
      const wp = child.getWorldPosition(new THREE.Vector3());
      if (wp.distanceTo(base) > 6) return; // only the cluster nearest ref
      const m = child.clone();
      m.position.copy(wp.sub(base));
      m.quaternion.copy(child.getWorldQuaternion(new THREE.Quaternion()));
      m.scale.copy(child.getWorldScale(new THREE.Vector3()));
      group.add(m);
    });
    reskin(group);
    return group;
  };

  const benchProto = extractProto(
    benchesG.scene,
    (n) => n.startsWith('benchPhysicalDynamic'),
    (n) => n.startsWith('benchPhysicalDynamic')
  );
  const lanternProto = extractProto(
    lanternsG.scene,
    (n) => n.startsWith('base'),
    (n) => n.startsWith('base') || n.startsWith('light')
  );

  return {
    foliageTexture,
    trees: {
      oak: parseTree(oakG.scene),
      cherry: parseTree(cherryG.scene),
      birch: parseTree(birchG.scene)
    },
    paletteMat,
    benchProto,
    lanternProto
  };
}

// Bruno's leaf-color pairs (shaded → lit), from World.js / Bushes.js.
export const TREE_COLORS = {
  oak: ['#b4b536', '#d8cf3b'],
  cherry: ['#ff6d6d', '#ff9990'],
  birch: ['#ff4f2b', '#ff903f']
};
export const BUSH_COLORS = ['#b4b536', '#d8cf3b'];
