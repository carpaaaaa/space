"use client";

import type { GalaxyPayload } from "@/lib/vault/graph";
import type { Filtri } from "@/state/store";

/** Bit dei flag (specchia FLAG del server). */
export const F_GOD = 1;
export const F_GAP = 2;
export const F_POLVERE = 4;
/** Kind (specchia KIND del server). */
export const K_NOTA = 0;
export const K_CONCETTO = 1;
export const K_SEZIONE = 2;
export const K_GAP = 3;
export const K_DOCUMENTO = 4;

export interface Galassia {
  payload: GalaxyPayload;
  n: number;
  pos: Float32Array;
  size: Float32Array;
  color: Float32Array;
  vis: Float32Array;
  kind: Uint8Array;
  flag: Uint8Array;
  areaIdx: Uint8Array;
  /** indici per layer */
  idxPrincipali: number[]; // note + concetti + documenti (pickabili, additive)
  idxSezioni: number[];
  idxGap: number[];
  idxPolvere: number[];
  /** rel nota -> indice stella nota */
  relToIdx: Map<string, number>;
  /** ancore etichette area sul braccio */
  ancoreAree: { nome: string; colore: string; pos: [number, number, number] }[];
  /** etichette fisse: god nodes + note piu grandi */
  etichetteFisse: { idx: number; testo: string; colore: string; god: boolean }[];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const GRIGIO_GAP = hexToRgb("#9aa3b5");

export async function caricaGalassia(): Promise<Galassia> {
  const res = await fetch("/api/galaxy");
  if (!res.ok) throw new Error("Impossibile leggere la galassia dal vault");
  const payload = (await res.json()) as GalaxyPayload;
  const s = payload.stars;
  const n = s.id.length;

  const pos = new Float32Array(s.pos);
  const size = new Float32Array(s.size);
  const color = new Float32Array(n * 3);
  const vis = new Float32Array(n).fill(1);
  const kind = new Uint8Array(s.kind);
  const flag = new Uint8Array(s.flag);
  const areaIdx = new Uint8Array(s.area);

  const idxPrincipali: number[] = [];
  const idxSezioni: number[] = [];
  const idxGap: number[] = [];
  const idxPolvere: number[] = [];

  for (let i = 0; i < n; i++) {
    if (flag[i] & F_POLVERE) idxPolvere.push(i);
    else if (kind[i] === K_GAP) idxGap.push(i);
    else if (kind[i] === K_SEZIONE) idxSezioni.push(i);
    else idxPrincipali.push(i);
  }

  const relToIdx = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (kind[i] === K_NOTA && s.rel[i]) relToIdx.set(s.rel[i]!, i);
  }

  // ancore etichette area: baricentro delle note dell'area a raggio medio
  const somma = new Map<number, { x: number; y: number; z: number; k: number }>();
  for (const i of idxPrincipali) {
    if (kind[i] !== K_NOTA) continue;
    const a = areaIdx[i];
    const acc = somma.get(a) ?? { x: 0, y: 0, z: 0, k: 0 };
    acc.x += pos[i * 3];
    acc.y += pos[i * 3 + 1];
    acc.z += pos[i * 3 + 2];
    acc.k += 1;
    somma.set(a, acc);
  }
  const ancoreAree: Galassia["ancoreAree"] = [];
  for (const [aIdx, acc] of somma) {
    const area = payload.aree[aIdx];
    if (!area || area.braccio == null || acc.k < 2) continue;
    ancoreAree.push({
      nome: area.nome,
      colore: area.colore,
      pos: [(acc.x / acc.k) * 1.28, acc.y / acc.k + 2.5, (acc.z / acc.k) * 1.28],
    });
  }

  // etichette fisse: god + note piu connesse
  const etichetteFisse: Galassia["etichetteFisse"] = [];
  const usati = new Set<number>();
  for (const g of payload.report.godNodes) {
    if (g.star != null && !usati.has(g.star)) {
      usati.add(g.star);
      etichetteFisse.push({
        idx: g.star,
        testo: s.label[g.star],
        colore: payload.aree[areaIdx[g.star]]?.colore ?? "#ffd98a",
        god: true,
      });
    }
  }
  // ogni nota ha il suo nome: nessuna quota, nessun tetto. Il toggle
  // "nomi" nei filtri resta la valvola per un vault che cresce molto.
  const tutteLeNote = idxPrincipali
    .filter((i) => kind[i] === K_NOTA && !usati.has(i))
    .sort((a, b) => size[b] - size[a]);
  for (const i of tutteLeNote) {
    etichetteFisse.push({
      idx: i,
      testo: s.label[i],
      colore: payload.aree[areaIdx[i]]?.colore ?? "#dfe9ff",
      god: false,
    });
  }

  const g: Galassia = {
    payload,
    n,
    pos,
    size,
    color,
    vis,
    kind,
    flag,
    areaIdx,
    idxPrincipali,
    idxSezioni,
    idxGap,
    idxPolvere,
    relToIdx,
    ancoreAree,
    etichetteFisse,
  };
  ricoloraGalassia(g, OPZIONI_COLORE_DEFAULT);
  return g;
}

/** Applica i filtri al vettore vis (1 visibile, 0 nascosta). */
export function applicaFiltri(g: Galassia, filtri: Filtri): void {
  const areaOn = g.payload.aree.map((a) => filtri.aree[a.key] ?? true);
  for (let i = 0; i < g.n; i++) {
    let v = 1;
    if (!areaOn[g.areaIdx[i]]) v = 0;
    if (v && filtri.soloGod && !(g.flag[i] & F_GOD)) v = 0;
    if (v && filtri.soloGap && !(g.flag[i] & F_GAP)) v = 0;
    if (v && !filtri.sezioni && g.kind[i] === K_SEZIONE) v = 0;
    g.vis[i] = v;
  }
}

/* ------------------------------------------------------------------ */
/* Ricolorazione (tema + modalita colore, dal pannello Aspetto)        */
/* ------------------------------------------------------------------ */

export interface OpzioniColore {
  /** bianco-stella del tema */
  stella: string;
  /** tinta god node / accento del tema */
  oro: string;
  /** corsie di polvere: [chiara, scura] */
  polvere: [string, string];
  mode: "area" | "mono" | "community";
}

export const OPZIONI_COLORE_DEFAULT: OpzioniColore = {
  stella: "#dfe9ff",
  oro: "#ffd98a",
  polvere: ["#8a6a44", "#6b4f34"],
  mode: "area",
};

function hslToRgb(h: number, sat: number, lum: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lum, 1 - lum);
  const f = (n: number) => lum - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** Ricalcola i colori delle stelle in-place (poi i layer risincronizzano). */
export function ricoloraGalassia(g: Galassia, opz: OpzioniColore): void {
  const { payload, n, pos, kind, flag, areaIdx, color } = g;
  const coloriAree = payload.aree.map((a) => hexToRgb(a.colore));
  const STELLA = hexToRgb(opz.stella);
  const ORO_T = hexToRgb(opz.oro);
  const POLV_A = hexToRgb(opz.polvere[0]);
  const POLV_B = hexToRgb(opz.polvere[1]);
  const R_MAX = 95;

  const basePer = (i: number): [number, number, number] => {
    if (opz.mode === "mono") return ORO_T;
    if (opz.mode === "community") {
      const c = payload.stars.community[i];
      if (c >= 0) return hslToRgb((c * 137.5) % 360, 0.42, 0.68);
    }
    return coloriAree[areaIdx[i]] ?? STELLA;
  };

  for (let i = 0; i < n; i++) {
    const r = Math.hypot(pos[i * 3], pos[i * 3 + 2]) / R_MAX;
    let c: [number, number, number];
    if (flag[i] & F_POLVERE) {
      c = mix(POLV_A, POLV_B, Math.min(1, r));
    } else if (kind[i] === K_GAP) {
      c = GRIGIO_GAP;
    } else if (kind[i] === K_SEZIONE) {
      c = mix(basePer(i), STELLA, 0.45 + 0.3 * Math.min(1, r));
    } else {
      c = mix(basePer(i), STELLA, 0.18 + 0.35 * Math.min(1, r));
      if (flag[i] & F_GOD) c = mix(c, ORO_T, 0.55);
      if (kind[i] === K_CONCETTO) c = mix(c, STELLA, 0.2);
    }
    color[i * 3] = c[0];
    color[i * 3 + 1] = c[1];
    color[i * 3 + 2] = c[2];
  }
}
