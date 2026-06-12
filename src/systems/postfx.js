import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Display-space color grade: saturation boost, gentle S-curve contrast,
// warm highlights / purple shadows split-tone, and a soft vignette.
// Runs after OutputPass, so it operates on tone-mapped sRGB values.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.22 },
    uContrast: { value: 0.16 },
    uVignette: { value: 0.32 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb;
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, uSaturation);
      col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
      col += (1.0 - smoothstep(0.0, 0.6, luma)) * vec3(0.015, 0.004, 0.045);
      col *= mix(vec3(1.0), vec3(1.045, 1.0, 0.94), smoothstep(0.45, 1.0, luma));
      float d = length(vUv - 0.5) * 1.3;
      col *= 1.0 - uVignette * smoothstep(0.45, 1.05, d);
      gl_FragColor = vec4(col, tex.a);
    }
  `
};

export function createPostFX(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    samples: 4,
    type: THREE.HalfFloatType
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(GradeShader));

  function resize() {
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  resize();

  return { render: () => composer.render(), resize };
}
