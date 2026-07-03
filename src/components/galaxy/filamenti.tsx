"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Galassia } from "@/lib/galassia";
import { useUI } from "@/state/store";

function lineaMateriale(opacity: number, additive = true) {
  return new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function geometriaEdge(g: Galassia, indiciEdge: number[]): THREE.BufferGeometry {
  const pos = new Float32Array(indiciEdge.length * 6);
  const col = new Float32Array(indiciEdge.length * 6);
  indiciEdge.forEach((ei, k) => {
    const e = g.payload.edges[ei];
    const off = k * 6;
    for (const [slot, star] of [
      [0, e.a],
      [3, e.b],
    ] as const) {
      pos[off + slot] = g.pos[star * 3];
      pos[off + slot + 1] = g.pos[star * 3 + 1];
      pos[off + slot + 2] = g.pos[star * 3 + 2];
      if (e.sorprendente) {
        col[off + slot] = 1.0;
        col[off + slot + 1] = 0.85;
        col[off + slot + 2] = 0.54;
      } else {
        col[off + slot] = g.color[star * 3];
        col[off + slot + 1] = g.color[star * 3 + 1];
        col[off + slot + 2] = g.color[star * 3 + 2];
      }
    }
  });
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geom;
}

/**
 * Filamenti della galassia:
 * - tutti gli edge (toggle "filamenti"), tenuissimi;
 * - le surprising connections, sempre accese in oro tenue;
 * - gli edge della stella attiva (hover/selezione), ben visibili.
 */
export function Filamenti({ g }: { g: Galassia }) {
  const filamenti = useUI((s) => s.filtri.filamenti);
  const hover = useUI((s) => s.hover);
  const selezione = useUI((s) => s.selezione);

  const adiacenza = useMemo(() => {
    const m = new Map<number, number[]>();
    g.payload.edges.forEach((e, i) => {
      (m.get(e.a) ?? m.set(e.a, []).get(e.a)!).push(i);
      (m.get(e.b) ?? m.set(e.b, []).get(e.b)!).push(i);
    });
    return m;
  }, [g]);

  const tutti = useMemo(() => {
    const idx = g.payload.edges.map((_, i) => i);
    return { geom: geometriaEdge(g, idx), mat: lineaMateriale(0.055) };
  }, [g]);

  const sorprendenti = useMemo(() => {
    const idx = g.payload.edges
      .map((e, i) => (e.sorprendente ? i : -1))
      .filter((i) => i >= 0);
    return { geom: geometriaEdge(g, idx), mat: lineaMateriale(0.16) };
  }, [g]);

  const attivi = useMemo(() => {
    const stella = selezione ?? hover;
    const idx = stella == null ? [] : (adiacenza.get(stella) ?? []).slice(0, 400);
    return { geom: geometriaEdge(g, idx), mat: lineaMateriale(0.5) };
  }, [g, adiacenza, hover, selezione]);

  useEffect(() => {
    return () => {
      tutti.geom.dispose();
      tutti.mat.dispose();
      sorprendenti.geom.dispose();
      sorprendenti.mat.dispose();
    };
  }, [tutti, sorprendenti]);

  useEffect(() => {
    return () => {
      attivi.geom.dispose();
      attivi.mat.dispose();
    };
  }, [attivi]);

  return (
    <group>
      {filamenti && (
        <lineSegments geometry={tutti.geom} material={tutti.mat} frustumCulled={false} />
      )}
      <lineSegments
        geometry={sorprendenti.geom}
        material={sorprendenti.mat}
        frustumCulled={false}
      />
      {attivi.geom.getAttribute("position")?.count > 0 && (
        <lineSegments geometry={attivi.geom} material={attivi.mat} frustumCulled={false} />
      )}
    </group>
  );
}
