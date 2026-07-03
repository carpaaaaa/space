"use client";

import { MutableRefObject, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Galassia } from "@/lib/galassia";
import { F_GAP, F_GOD, K_CONCETTO, K_DOCUMENTO, K_GAP, K_NOTA, K_SEZIONE } from "@/lib/galassia";
import { useUI } from "@/state/store";

export type MappaEtichette = Map<string, HTMLDivElement>;

/**
 * Dentro il canvas: proietta le posizioni 3D e muove direttamente i div
 * delle etichette (niente setState per frame).
 */
export function PonteEtichette({
  g,
  refs,
}: {
  g: Galassia;
  refs: MutableRefObject<MappaEtichette>;
}) {
  const { camera, size } = useThree();
  const m = useRef(new THREE.Matrix4());
  const v = useRef(new THREE.Vector3());
  const frame = useRef(0);

  useFrame(() => {
    frame.current += 1;
    if (frame.current % 2 !== 0) return; // 30fps bastano per le etichette
    m.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const distCam = camera.position.length();

    for (const [chiave, el] of refs.current) {
      const [tipo, resto] = chiave.split("|", 2);
      let x = 0;
      let y = 0;
      let z = 0;
      let opacita = 0;
      if (tipo === "area") {
        const i = Number(resto);
        const a = g.ancoreAree[i];
        if (a) {
          [x, y, z] = a.pos;
          // i nomi area vivono nella vista panoramica
          opacita = THREE.MathUtils.clamp((distCam - 70) / 60, 0, 1) * 0.9;
        }
      } else {
        const i = Number(resto);
        x = g.pos[i * 3];
        y = g.pos[i * 3 + 1];
        z = g.pos[i * 3 + 2];
        if (g.vis[i] > 0) {
          const dStella = camera.position.distanceTo(new THREE.Vector3(x, y, z));
          const god = (g.flag[i] & F_GOD) !== 0;
          const vicino = THREE.MathUtils.clamp((190 - dStella) / 80, 0, 1);
          opacita = god ? Math.max(0.55, vicino) : vicino * 0.9;
        }
      }
      v.current.set(x, y, z).applyMatrix4(m.current);
      if (v.current.z < -1 || v.current.z > 1) opacita = 0;
      const sx = ((v.current.x + 1) / 2) * size.width;
      const sy = ((1 - v.current.y) / 2) * size.height;
      el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      el.style.opacity = opacita.toFixed(2);
      el.style.visibility = opacita <= 0.01 ? "hidden" : "visible";
    }
  });

  return null;
}

/** Overlay DOM delle etichette (fuori dal canvas). */
export function EtichetteOverlay({
  g,
  refs,
}: {
  g: Galassia;
  refs: MutableRefObject<MappaEtichette>;
}) {
  const vola = useUI((s) => s.vola);
  const apriNota = useUI((s) => s.apriNota);
  const setSelezione = useUI((s) => s.setSelezione);

  const registra = (chiave: string) => (el: HTMLDivElement | null) => {
    if (el) refs.current.set(chiave, el);
    else refs.current.delete(chiave);
  };

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: "var(--z-hud)" }}
    >
      {g.ancoreAree.map((a, i) => (
        <div
          key={"area" + i}
          ref={registra("area|" + i)}
          className="absolute left-0 top-0 select-none whitespace-nowrap"
          style={{ willChange: "transform, opacity" }}
        >
          <span
            className="block -translate-x-1/2 -translate-y-1/2 text-[12.5px] font-medium tracking-wide"
            style={{ color: a.colore, textShadow: "0 1px 8px rgba(0,0,0,.9)" }}
          >
            {a.nome}
          </span>
        </div>
      ))}
      {g.etichetteFisse.map((e) => (
        <div
          key={"e" + e.idx}
          ref={registra("stella|" + e.idx)}
          className="absolute left-0 top-0 whitespace-nowrap"
          style={{ willChange: "transform, opacity" }}
        >
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setSelezione(e.idx);
              vola(e.idx);
              const rel = g.payload.stars.rel[e.idx];
              if (rel) apriNota(rel);
            }}
            className="pointer-events-auto block translate-x-2 -translate-y-1/2 cursor-pointer text-left"
            style={{
              color: e.god ? "var(--oro)" : "var(--inchiostro-2)",
              fontSize: e.god ? 13 : 11.5,
              fontWeight: e.god ? 600 : 400,
              textShadow: "0 1px 10px rgba(0,0,0,.95)",
              maxWidth: 240,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {e.testo}
          </button>
        </div>
      ))}
    </div>
  );
}

const NOME_KIND: Record<number, string> = {
  [K_NOTA]: "nota",
  [K_CONCETTO]: "concetto",
  [K_SEZIONE]: "sezione",
  [K_GAP]: "wikilink irrisolto",
  [K_DOCUMENTO]: "documento",
};

/** Tooltip che segue il puntatore quando una stella e in hover. */
export function TooltipStella({ g }: { g: Galassia }) {
  const hover = useUI((s) => s.hover);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: -9999, y: -9999 });
  const raf = useRef(0);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        setPos({ x: e.clientX, y: e.clientY });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  if (hover == null) return null;
  const s = g.payload.stars;
  const area = g.payload.aree[s.area[hover]];
  const tipo = s.tipo[hover] >= 0 ? g.payload.tipi[s.tipo[hover]] : null;
  const stato = s.stato[hover] >= 0 ? g.payload.stati[s.stato[hover]] : null;
  const god = (g.flag[hover] & F_GOD) !== 0;
  const gap = (g.flag[hover] & F_GAP) !== 0;
  const kind = g.kind[hover];

  const sotto = pos.y > (typeof window !== "undefined" ? window.innerHeight : 800) - 180;
  const aDestra = pos.x > (typeof window !== "undefined" ? window.innerWidth : 1200) - 320;

  return (
    <div
      className="pannello-superficie pointer-events-none fixed max-w-[300px] px-3.5 py-2.5"
      style={{
        left: pos.x + (aDestra ? -14 : 14),
        top: pos.y + (sotto ? -14 : 14),
        transform: `translate(${aDestra ? "-100%" : "0"}, ${sotto ? "-100%" : "0"})`,
        zIndex: "var(--z-tooltip)",
        borderColor: area ? area.colore + "55" : undefined,
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[13.5px] font-semibold leading-snug">
          {s.label[hover]}
        </span>
        {god && (
          <span className="text-[10.5px] font-semibold" style={{ color: "var(--oro-2)" }}>
            god node
          </span>
        )}
      </div>
      <div className="mono mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]" style={{ color: "var(--inchiostro-2)" }}>
        <span style={{ color: area?.colore }}>{area?.nome}</span>
        <span>{NOME_KIND[kind]}</span>
        {tipo && <span>tipo: {tipo}</span>}
        {stato && <span>stato: {stato}</span>}
        <span>{s.deg[hover]} conn.</span>
      </div>
      {kind === K_GAP && (
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--inchiostro-2)" }}>
          Citata da {s.deg[hover]} note ma non esiste ancora: un vuoto da colmare.
        </p>
      )}
      {gap && kind !== K_GAP && (
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--inchiostro-2)" }}>
          Nodo quasi isolato nella galassia.
        </p>
      )}
    </div>
  );
}
