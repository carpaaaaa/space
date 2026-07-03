"use client";

import * as THREE from "three";

const VERTEX = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aVis;
varying vec3 vColor;
varying float vAlpha;
uniform float uScala;
uniform float uAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(1.0, -mv.z);
  gl_PointSize = clamp(aSize * uScala * (260.0 / dist), 0.6, 72.0);
  vColor = aColor;
  vAlpha = aVis * uAlpha;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha <= 0.003) discard;
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;
  float nucleo = pow(smoothstep(1.0, 0.0, d), 2.4);
  float alone = exp(-d * 3.2) * 0.55;
  float a = (nucleo + alone) * vAlpha;
  vec3 c = vColor * (0.72 + 0.6 * nucleo);
  gl_FragColor = vec4(c, a);
}
`;

export function materialeStelle(opts: {
  alpha: number;
  scala: number;
  additive?: boolean;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uScala: { value: opts.scala },
      uAlpha: { value: opts.alpha },
    },
    transparent: true,
    depthWrite: false,
    blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
}

/** Geometria per un sottoinsieme di stelle; ritorna anche la mappa globale->locale. */
export function geometriaSubset(
  indici: number[],
  pos: Float32Array,
  size: Float32Array,
  color: Float32Array,
  vis: Float32Array
): { geom: THREE.BufferGeometry; aggiorna: (vis: Float32Array) => void } {
  const n = indici.length;
  const p = new Float32Array(n * 3);
  const s = new Float32Array(n);
  const c = new Float32Array(n * 3);
  const v = new Float32Array(n);
  indici.forEach((gi, li) => {
    p[li * 3] = pos[gi * 3];
    p[li * 3 + 1] = pos[gi * 3 + 1];
    p[li * 3 + 2] = pos[gi * 3 + 2];
    s[li] = size[gi];
    c[li * 3] = color[gi * 3];
    c[li * 3 + 1] = color[gi * 3 + 1];
    c[li * 3 + 2] = color[gi * 3 + 2];
    v[li] = vis[gi];
  });
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(p, 3));
  geom.setAttribute("aSize", new THREE.BufferAttribute(s, 1));
  geom.setAttribute("aColor", new THREE.BufferAttribute(c, 3));
  geom.setAttribute("aVis", new THREE.BufferAttribute(v, 1));
  geom.computeBoundingSphere();
  const attrVis = geom.getAttribute("aVis") as THREE.BufferAttribute;
  const arr = attrVis.array as Float32Array;
  return {
    geom,
    aggiorna(visGlobale: Float32Array) {
      indici.forEach((gi, li) => {
        arr[li] = visGlobale[gi];
      });
      attrVis.needsUpdate = true;
    },
  };
}
