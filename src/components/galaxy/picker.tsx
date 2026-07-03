"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Galassia } from "@/lib/galassia";
import { useUI } from "@/state/store";

/**
 * Picking manuale in screen-space: proietta i candidati (note, concetti,
 * documenti, gap) e sceglie il piu vicino al puntatore. Con ~700 candidati
 * costa meno di un raycast configurato bene e da un controllo totale sul
 * raggio di tolleranza in pixel.
 */
export function Picker({ g }: { g: Galassia }) {
  const { camera, gl, size } = useThree();
  const setHover = useUI((s) => s.setHover);
  const setSelezione = useUI((s) => s.setSelezione);
  const apriNota = useUI((s) => s.apriNota);
  const vola = useUI((s) => s.vola);
  const hoverRef = useRef<number | null>(null);
  const raf = useRef(0);

  const candidati = useMemo(
    () => [...g.idxPrincipali, ...g.idxGap],
    [g]
  );

  useEffect(() => {
    const el = gl.domElement;
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3();

    const pick = (clientX: number, clientY: number): number | null => {
      const rect = el.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      let migliore: number | null = null;
      let miglioreD = Infinity;
      for (const i of candidati) {
        if (g.vis[i] === 0) continue;
        v.set(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]).applyMatrix4(m);
        if (v.z < -1 || v.z > 1) continue;
        const sx = ((v.x + 1) / 2) * size.width;
        const sy = ((1 - v.y) / 2) * size.height;
        const dx = sx - mx;
        const dy = sy - my;
        const d2 = dx * dx + dy * dy;
        const raggio = 7 + g.size[i] * 2.2;
        if (d2 < raggio * raggio && d2 < miglioreD) {
          miglioreD = d2;
          migliore = i;
        }
      }
      return migliore;
    };

    let ultimo: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      ultimo = { x: e.clientX, y: e.clientY };
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        if (!ultimo) return;
        const hit = pick(ultimo.x, ultimo.y);
        if (hit !== hoverRef.current) {
          hoverRef.current = hit;
          setHover(hit);
          el.style.cursor = hit != null ? "pointer" : "";
        }
      });
    };

    let giu: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => {
      giu = { x: e.clientX, y: e.clientY, t: Date.now() };
    };
    const onUp = (e: PointerEvent) => {
      if (!giu) return;
      const dx = e.clientX - giu.x;
      const dy = e.clientY - giu.y;
      const eraClick = dx * dx + dy * dy < 36 && Date.now() - giu.t < 400;
      giu = null;
      if (!eraClick) return;
      const hit = pick(e.clientX, e.clientY);
      setSelezione(hit);
      if (hit != null) {
        const rel = g.payload.stars.rel[hit];
        if (rel) apriNota(rel);
      }
    };
    const onDblClick = (e: MouseEvent) => {
      const hit = pick(e.clientX, e.clientY);
      if (hit != null) vola(hit);
    };
    const onLeave = () => {
      hoverRef.current = null;
      setHover(null);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("dblclick", onDblClick);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("dblclick", onDblClick);
      el.removeEventListener("pointerleave", onLeave);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [g, camera, gl, size, candidati, setHover, setSelezione, apriNota, vola]);

  return null;
}
