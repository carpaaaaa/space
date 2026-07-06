"use client";

import { MutableRefObject, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Galassia } from "@/lib/galassia";
import { F_GAP, F_GOD, K_CONCETTO, K_DOCUMENTO, K_GAP, K_NOTA, K_SEZIONE } from "@/lib/galassia";
import { useUI } from "@/state/store";

export type MappaEtichette = Map<string, HTMLDivElement>;

// temp module-level: un solo thread rAF, niente allocazioni per frame
const M_TEMP = new THREE.Matrix4();
const V_TEMP = new THREE.Vector3();

// stima larghezza carattere (px) per box di collisione, senza leggere il DOM
// (offsetWidth forzerebbe un reflow per ogni etichetta a ogni frame). I god
// node sono in grassetto 13px (piu larghi), le note 11.5px, le aree 12.5px.
const CHAR_W_GOD = 7.6;
const CHAR_W_NOTA = 6.3;
const CHAR_W_AREA = 6.9;
const RIGA_H = 16;
const PAD_COLLISIONE = 3; // margine perche' i nomi non si tocchino

// priorita: area > god > note (queste ordinate per dimensione stella)
const P_AREA = 3;
const P_GOD = 2;
const P_NOTA = 1;

interface Candidato {
  el: HTMLDivElement;
  prio: number;
  peso: number; // dimensione stella (per ordinare le note fra loro)
  sx: number;
  sy: number;
  // box schermo [sinistra, alto, destra, basso]
  l: number;
  t: number;
  r: number;
  b: number;
}

// lunghezza testo cache-ata per elemento (il testo non cambia mai)
const LUNGHEZZE = new WeakMap<HTMLDivElement, number>();
function lunghezzaTesto(el: HTMLDivElement): number {
  let n = LUNGHEZZE.get(el);
  if (n == null) {
    n = (el.textContent ?? "").trim().length;
    LUNGHEZZE.set(el, n);
  }
  return n;
}

function sovrappone(c: Candidato, occupati: Candidato[]): boolean {
  for (const o of occupati) {
    if (c.l < o.r && c.r > o.l && c.t < o.b && c.b > o.t) return true;
  }
  return false;
}

/**
 * Dentro il canvas: proietta le posizioni 3D, muove direttamente i div delle
 * etichette e le declutter-a. Ogni nota ha un'etichetta, ma a ogni frame ne
 * mostro solo quante ne stanno senza sovrapporsi (area e god node hanno la
 * precedenza, le note fra loro per dimensione). Avvicinandosi a una zona i
 * suoi nomi si distanziano sullo schermo e altri emergono: cosi' nessun nome
 * e' perso e la vista d'insieme resta leggibile.
 */
export function PonteEtichette({
  g,
  refs,
}: {
  g: Galassia;
  refs: MutableRefObject<MappaEtichette>;
}) {
  const { camera, size } = useThree();
  const frame = useRef(0);

  // useFrame gira nel loop rAF, non nel render: la mutazione diretta degli
  // stili DOM e il punto di questo componente (niente setState a 30fps).
  useFrame(() => {
    frame.current += 1;
    if (frame.current % 2 !== 0) return; // 30fps bastano per le etichette
    M_TEMP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    const nascondi = (el: HTMLDivElement) => {
      el.style.opacity = "0";
      el.style.visibility = "hidden";
    };

    // 1. raccogli i candidati visibili (dentro schermo, non filtrati) con box
    const candidati: Candidato[] = [];
    for (const [chiave, el] of refs.current) {
      const [tipo, resto] = chiave.split("|", 2);
      let x = 0;
      let y = 0;
      let z = 0;
      let prio = P_NOTA;
      let peso = 0;
      if (tipo === "area") {
        const a = g.ancoreAree[Number(resto)];
        if (!a) {
          nascondi(el);
          continue;
        }
        [x, y, z] = a.pos;
        prio = P_AREA;
      } else {
        const i = Number(resto);
        if (g.vis[i] <= 0) {
          nascondi(el);
          continue;
        }
        x = g.pos[i * 3];
        y = g.pos[i * 3 + 1];
        z = g.pos[i * 3 + 2];
        prio = g.flag[i] & F_GOD ? P_GOD : P_NOTA;
        peso = g.size[i];
      }
      V_TEMP.set(x, y, z).applyMatrix4(M_TEMP);
      if (V_TEMP.z < -1 || V_TEMP.z > 1) {
        nascondi(el);
        continue;
      }
      const sx = ((V_TEMP.x + 1) / 2) * size.width;
      const sy = ((1 - V_TEMP.y) / 2) * size.height;
      const charW =
        prio === P_AREA ? CHAR_W_AREA : prio === P_GOD ? CHAR_W_GOD : CHAR_W_NOTA;
      const w = lunghezzaTesto(el) * charW;
      // area: centrata sul punto; nota: a destra del punto, centrata in verticale
      const cx = tipo === "area" ? sx : sx + 8 + w / 2;
      candidati.push({
        el,
        prio,
        peso,
        sx,
        sy,
        l: cx - w / 2 - PAD_COLLISIONE,
        r: cx + w / 2 + PAD_COLLISIONE,
        t: sy - RIGA_H / 2 - PAD_COLLISIONE,
        b: sy + RIGA_H / 2 + PAD_COLLISIONE,
      });
    }

    // 2. ordina per priorita, poi per dimensione (le note grandi vincono)
    candidati.sort((a, b) => b.prio - a.prio || b.peso - a.peso);

    // 3. piazza in ordine: i nomi area sono ancore, sempre visibili; god e
    // note passano dalla collisione (i god vincono per priorita, ma non si
    // accavallano piu tra loro ne coprono le note)
    const occupati: Candidato[] = [];
    for (const c of candidati) {
      const sempre = c.prio === P_AREA;
      if (sempre || !sovrappone(c, occupati)) {
        occupati.push(c);
        c.el.style.transform = `translate(${c.sx.toFixed(1)}px, ${c.sy.toFixed(1)}px)`;
        c.el.style.opacity = c.prio === P_GOD ? "1" : c.prio === P_AREA ? "0.9" : "0.85";
        c.el.style.visibility = "visible";
      } else {
        nascondi(c.el);
      }
    }
  });

  return null;
}

/** Overlay DOM delle etichette (fuori dal canvas). */
export function EtichetteOverlay({
  g,
  refs,
  soloGod = false,
}: {
  g: Galassia;
  refs: MutableRefObject<MappaEtichette>;
  /** su mobile mostriamo solo i god nodes e i nomi area */
  soloGod?: boolean;
}) {
  const vola = useUI((s) => s.vola);
  const apriNota = useUI((s) => s.apriNota);
  const setSelezione = useUI((s) => s.setSelezione);
  const etichette = soloGod ? g.etichetteFisse.filter((e) => e.god) : g.etichetteFisse;

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
          style={{ willChange: "transform, opacity", opacity: 0, visibility: "hidden" }}
        >
          <span
            className="block -translate-x-1/2 -translate-y-1/2 text-[12.5px] font-medium tracking-wide"
            style={{ color: a.colore, textShadow: "0 1px 8px rgba(0,0,0,.9)" }}
          >
            {a.nome}
          </span>
        </div>
      ))}
      {etichette.map((e) => (
        <div
          key={"e" + e.idx}
          ref={registra("stella|" + e.idx)}
          className="absolute left-0 top-0 whitespace-nowrap"
          style={{ willChange: "transform, opacity", opacity: 0, visibility: "hidden" }}
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
              // il nome porta il colore della sua area (e.colore); i god node
              // restano oro come accento di importanza
              color: e.god ? "var(--oro)" : e.colore,
              fontSize: e.god ? 13 : 11.5,
              fontWeight: e.god ? 600 : 500,
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
        // stacca il tooltip dalla galassia illuminata dal bloom
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
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
        <span>{s.deg[hover] === 1 ? "1 collegamento" : `${s.deg[hover]} collegamenti`}</span>
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
