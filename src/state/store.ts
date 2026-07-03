"use client";

import { create } from "zustand";
import { applicaFiltri, type Galassia } from "@/lib/galassia";

export type Pannello =
  | "galassia"
  | "oggi"
  | "progetti"
  | "finanze"
  | "inbox"
  | "log"
  | "ricerca"
  | "comando";

export interface Filtri {
  /** area key -> visibile */
  aree: Record<string, boolean>;
  soloGod: boolean;
  soloGap: boolean;
  filamenti: boolean;
  sezioni: boolean;
}

export interface VolaA {
  /** indice stella (o null per tornare a casa) */
  idx: number | null;
  /** contatore per ritriggerare l'effetto */
  n: number;
}

interface UIState {
  pannello: Pannello;
  setPannello: (p: Pannello) => void;

  notaAperta: string | null;
  apriNota: (rel: string) => void;
  chiudiNota: () => void;

  hover: number | null;
  setHover: (i: number | null) => void;
  selezione: number | null;
  setSelezione: (i: number | null) => void;

  filtri: Filtri;
  /** cresce a ogni cambio filtri: i layer risincronizzano la visibilita */
  filtriVersione: number;
  setFiltri: (f: Partial<Filtri>) => void;
  toggleArea: (key: string) => void;

  volaA: VolaA;
  vola: (idx: number | null) => void;

  vaultVersion: number;
  bumpVault: () => void;

  galassiaPronta: boolean;
  setGalassiaPronta: (v: boolean) => void;

  /** dataset caricato (per ricerca/vola-a fuori dal canvas) */
  galassia: Galassia | null;
  setGalassia: (g: Galassia | null) => void;
}

export const useUI = create<UIState>((set) => ({
  pannello: "galassia",
  setPannello: (p) => set({ pannello: p }),

  notaAperta: null,
  apriNota: (rel) => set({ notaAperta: rel }),
  chiudiNota: () => set({ notaAperta: null, selezione: null }),

  hover: null,
  setHover: (i) => set({ hover: i }),
  selezione: null,
  setSelezione: (i) => set({ selezione: i }),

  filtri: {
    aree: {},
    soloGod: false,
    soloGap: false,
    filamenti: false,
    sezioni: true,
  },
  filtriVersione: 0,
  setFiltri: (f) =>
    set((s) => {
      const filtri = { ...s.filtri, ...f };
      if (s.galassia) applicaFiltri(s.galassia, filtri);
      return { filtri, filtriVersione: s.filtriVersione + 1 };
    }),
  toggleArea: (key) =>
    set((s) => {
      const filtri = {
        ...s.filtri,
        aree: { ...s.filtri.aree, [key]: !(s.filtri.aree[key] ?? true) },
      };
      if (s.galassia) applicaFiltri(s.galassia, filtri);
      return { filtri, filtriVersione: s.filtriVersione + 1 };
    }),

  volaA: { idx: null, n: 0 },
  vola: (idx) => set((s) => ({ volaA: { idx, n: s.volaA.n + 1 } })),

  vaultVersion: 0,
  bumpVault: () => set((s) => ({ vaultVersion: s.vaultVersion + 1 })),

  galassiaPronta: false,
  setGalassiaPronta: (v) => set({ galassiaPronta: v }),

  galassia: null,
  setGalassia: (g) =>
    set((s) => {
      if (g) applicaFiltri(g, s.filtri);
      return { galassia: g, filtriVersione: s.filtriVersione + 1 };
    }),
}));
