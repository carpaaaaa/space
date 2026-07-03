"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Galassia } from "@/lib/galassia";
import { materialeStelle, geometriaSubset } from "./materiali";

/** Aggancia un materiale a un ref per mutarne le uniform dentro useFrame. */
function useMaterialeRef(mat: THREE.ShaderMaterial) {
  const ref = useRef<THREE.ShaderMaterial | null>(null);
  useEffect(() => {
    ref.current = mat;
  }, [mat]);
  return ref;
}

/** Un layer di stelle con aggiornamento visibilita. */
export function StratoStelle({
  g,
  indici,
  alpha,
  scala,
  additive = true,
  lod,
  filtriVersione,
}: {
  g: Galassia;
  indici: number[];
  alpha: number;
  scala: number;
  additive?: boolean;
  /** [distMin che accende, distMax che spegne]: dissolve col fattore zoom */
  lod?: [number, number];
  filtriVersione: number;
}) {
  const { geom, aggiorna } = useMemo(
    () => geometriaSubset(indici, g.pos, g.size, g.color, g.vis),
    // la geometria dipende solo dal dataset
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g]
  );
  const mat = useMemo(
    () => materialeStelle({ alpha, scala, additive }),
    [alpha, scala, additive]
  );

  useEffect(() => {
    aggiorna(g.vis);
  }, [filtriVersione, aggiorna, g]);

  useEffect(() => {
    return () => {
      geom.dispose();
      mat.dispose();
    };
  }, [geom, mat]);

  const matRef = useMaterialeRef(mat);
  useFrame(({ camera }) => {
    const m = matRef.current;
    if (!m || !lod) return;
    const dist = camera.position.length();
    const t = THREE.MathUtils.clamp((lod[1] - dist) / (lod[1] - lod[0]), 0, 1);
    m.uniforms.uAlpha.value = alpha * t;
  });

  return <points geometry={geom} material={mat} frustumCulled={false} />;
}

/** Il nucleo dorato: strati di glow che respirano lentamente (mai a scatti). */
export function Nucleo({ ridotto }: { ridotto: boolean }) {
  const mat = useMemo(() => {
    const m = materialeStelle({ alpha: 1, scala: 2.4 });
    return m;
  }, []);
  const geom = useMemo(() => {
    const gg = new THREE.BufferGeometry();
    const pos = new Float32Array([0, 0, 0, 0, 0.4, 0, 0, -0.3, 0, 0.8, 0.1, 0.5]);
    const size = new Float32Array([34, 15, 52, 8]);
    const color = new Float32Array([
      // f6e7c1
      0.965, 0.906, 0.757,
      // ffd98a
      1.0, 0.851, 0.541,
      // ffbf69 alone largo
      1.0, 0.749, 0.412,
      // scintilla
      1.0, 0.93, 0.8,
    ]);
    const vis = new Float32Array([1, 1, 0.5, 0.8]);
    gg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    gg.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    gg.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    gg.setAttribute("aVis", new THREE.BufferAttribute(vis, 1));
    return gg;
  }, []);

  useEffect(
    () => () => {
      geom.dispose();
      mat.dispose();
    },
    [geom, mat]
  );

  const matRef = useMaterialeRef(mat);
  useFrame(({ clock }) => {
    const m = matRef.current;
    if (!m) return;
    if (ridotto) {
      m.uniforms.uScala.value = 2.4;
      return;
    }
    // respiro lento ~7s, ampiezza minima: glow diffuso, non un "pulse"
    const t = clock.elapsedTime;
    m.uniforms.uScala.value = 2.4 * (1 + Math.sin((t * Math.PI * 2) / 7) * 0.025);
  });

  return <points geometry={geom} material={mat} frustumCulled={false} />;
}

function rngSemplice(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Polvere e foschia dei bracci: scenografia procedurale (non-dato) che segue
 * gli stessi parametri di spirale del layout server (R_CORE 9, R_MAX 95,
 * TWIST 3.05, 10 bracci) per dare la resa flocculenta di NGC 4414.
 */
export function PolvereBracci() {
  const { geomPolvere, matPolvere, geomFoschia, matFoschia } = useMemo(() => {
    const rnd = rngSemplice(441441);
    const R_CORE = 9;
    const R_MAX = 95;
    const TWIST = 3.05;
    const N_BRACCI = 10;

    // corsie di polvere seppia sottili sul bordo interno dei bracci
    const NP = 1100;
    const pp = new Float32Array(NP * 3);
    const sp = new Float32Array(NP);
    const cp = new Float32Array(NP * 3);
    const vp = new Float32Array(NP).fill(1);
    for (let i = 0; i < NP; i++) {
      const slot = Math.floor(rnd() * N_BRACCI) + 0.34; // corsia, non braccio
      const t = 0.12 + Math.pow(rnd(), 0.8) * 0.85;
      const raggio = R_CORE + Math.pow(t, 0.9) * (R_MAX - R_CORE) + (rnd() - 0.5) * 2.4;
      const angolo =
        (slot / N_BRACCI) * Math.PI * 2 + t * TWIST + (rnd() - 0.5) * (0.05 + 0.1 * t);
      pp[i * 3] = Math.cos(angolo) * raggio;
      pp[i * 3 + 1] = (rnd() - 0.5) * 0.9;
      pp[i * 3 + 2] = Math.sin(angolo) * raggio;
      sp[i] = 1.6 + rnd() * 2.8;
      const scuro = 0.45 + rnd() * 0.4;
      cp[i * 3] = 0.5 * scuro;
      cp[i * 3 + 1] = 0.38 * scuro;
      cp[i * 3 + 2] = 0.24 * scuro;
    }
    const gp = new THREE.BufferGeometry();
    gp.setAttribute("position", new THREE.BufferAttribute(pp, 3));
    gp.setAttribute("aSize", new THREE.BufferAttribute(sp, 1));
    gp.setAttribute("aColor", new THREE.BufferAttribute(cp, 3));
    gp.setAttribute("aVis", new THREE.BufferAttribute(vp, 1));

    // foschia calda solo attorno al bulge (additiva, molto tenue)
    const NF = 260;
    const pf = new Float32Array(NF * 3);
    const sf = new Float32Array(NF);
    const cf = new Float32Array(NF * 3);
    const vf = new Float32Array(NF).fill(1);
    for (let i = 0; i < NF; i++) {
      const raggio = Math.pow(rnd(), 1.5) * R_CORE * 1.6;
      const angolo = rnd() * Math.PI * 2;
      pf[i * 3] = Math.cos(angolo) * raggio;
      pf[i * 3 + 1] = (rnd() - 0.5) * 2.6;
      pf[i * 3 + 2] = Math.sin(angolo) * raggio;
      sf[i] = 6 + rnd() * 9;
      cf[i * 3] = 1.0;
      cf[i * 3 + 1] = 0.87;
      cf[i * 3 + 2] = 0.56;
    }
    const gf = new THREE.BufferGeometry();
    gf.setAttribute("position", new THREE.BufferAttribute(pf, 3));
    gf.setAttribute("aSize", new THREE.BufferAttribute(sf, 1));
    gf.setAttribute("aColor", new THREE.BufferAttribute(cf, 3));
    gf.setAttribute("aVis", new THREE.BufferAttribute(vf, 1));

    return {
      geomPolvere: gp,
      matPolvere: materialeStelle({ alpha: 0.3, scala: 2.6, additive: false }),
      geomFoschia: gf,
      matFoschia: materialeStelle({ alpha: 0.085, scala: 3.2 }),
    };
  }, []);

  useEffect(
    () => () => {
      geomPolvere.dispose();
      matPolvere.dispose();
      geomFoschia.dispose();
      matFoschia.dispose();
    },
    [geomPolvere, matPolvere, geomFoschia, matFoschia]
  );

  return (
    <group>
      <points geometry={geomFoschia} material={matFoschia} frustumCulled={false} renderOrder={1} />
      <points geometry={geomPolvere} material={matPolvere} frustumCulled={false} renderOrder={6} />
    </group>
  );
}

/** Campo stelle ambientale: scenografia, dichiaratamente non-dato. */
export function SfondoAmbientale() {
  const { geom, mat } = useMemo(() => {
    const rnd = rngSemplice(20260702);
    const N = 1500;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const color = new Float32Array(N * 3);
    const vis = new Float32Array(N).fill(1);
    for (let i = 0; i < N; i++) {
      // guscio sferico lontano
      const r = 420 + rnd() * 520;
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(2 * rnd() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      size[i] = 0.5 + rnd() * 1.7;
      // mix caldo/freddo come un campo fotografico
      const caldo = rnd() < 0.3;
      const l = 0.55 + rnd() * 0.45;
      color[i * 3] = l * (caldo ? 1.0 : 0.82);
      color[i * 3 + 1] = l * (caldo ? 0.88 : 0.88);
      color[i * 3 + 2] = l * (caldo ? 0.7 : 1.0);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    gg.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    gg.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    gg.setAttribute("aVis", new THREE.BufferAttribute(vis, 1));
    return { geom: gg, mat: materialeStelle({ alpha: 0.5, scala: 1.6 }) };
  }, []);

  useEffect(
    () => () => {
      geom.dispose();
      mat.dispose();
    },
    [geom, mat]
  );

  return <points geometry={geom} material={mat} frustumCulled={false} />;
}
