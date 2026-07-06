"use client";

import { create } from "zustand";
import { applicaFiltri, type Galassia } from "@/lib/galassia";
import type { EventoAgente } from "@/lib/agent/sessione";

/** Evento client-only: il comando dell'utente nel feed della console. */
export type EventoConsole = EventoAgente | { t: "comando"; testo: string };

export type Pannello =
  | "galassia"
  | "oggi"
  | "progetti"
  | "finanze"
  | "inbox"
  | "log"
  | "ricerca"
  | "skills"
  | "aspetto"
  | "comando";

export interface Aspetto {
  tema: string;
  /** moltiplicatore dimensione stelle (0.5 - 2) */
  scalaStelle: number;
  /** moltiplicatore intensita glow (0.4 - 1.6) */
  glow: number;
  /** durezza del bordo stella (1 morbida - 4 netta) */
  durezza: number;
  coloreMode: "area" | "mono" | "community";
  autoRotazione: boolean;
}

export const ASPETTO_DEFAULT: Aspetto = {
  tema: "ngc4414",
  scalaStelle: 1,
  glow: 1,
  durezza: 2.4,
  coloreMode: "area",
  autoRotazione: true,
};

function leggiLocale<T>(chiave: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(chiave);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function salvaLocale(chiave: string, valore: unknown): void {
  try {
    window.localStorage.setItem(chiave, JSON.stringify(valore));
  } catch {
    // storage pieno o negato: pazienza
  }
}

export interface InfoModello {
  id: string;
  etichetta: string;
  provider: "claude" | "openai";
}

export interface Filtri {
  /** area key -> visibile */
  aree: Record<string, boolean>;
  soloGod: boolean;
  soloGap: boolean;
  filamenti: boolean;
  sezioni: boolean;
  /** etichette fisse (god nodes + note significative + nomi area) */
  etichette: boolean;
}

/** la skill il cui risultato e' aperto nel pannello Skills: da' contesto alla command bar. */
export interface SkillInFuoco {
  rel: string;
  nome: string;
  output: string;
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

  /** modelli agente configurati e scelta corrente */
  modelli: InfoModello[];
  setModelli: (m: InfoModello[]) => void;
  modelloScelto: string | null;
  setModelloScelto: (id: string) => void;

  /** aspetto: tema + resa della galassia (persistito in localStorage) */
  aspetto: Aspetto;
  aspettoVersione: number;
  setAspetto: (a: Partial<Aspetto>) => void;

  /** skill il cui risultato e' aperto nel pannello Skills (null = nessuna) */
  skillInFuoco: SkillInFuoco | null;
  setSkillInFuoco: (s: SkillInFuoco | null) => void;

  /** console dell'agente */
  consoleAperta: boolean;
  agenteInEsecuzione: boolean;
  feed: EventoConsole[];
  apriConsole: () => void;
  chiudiConsole: () => void;
  pushFeed: (e: EventoConsole) => void;
  svuotaFeed: () => void;
  setAgenteInEsecuzione: (v: boolean) => void;
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
    etichette: true,
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

  modelli: [],
  setModelli: (m) => set({ modelli: m }),
  modelloScelto:
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem("space.modello"),
  setModelloScelto: (id) => {
    try {
      window.localStorage.setItem("space.modello", id);
    } catch {
      // ignora
    }
    set({ modelloScelto: id });
  },

  aspetto: leggiLocale("space.aspetto", ASPETTO_DEFAULT),
  aspettoVersione: 0,
  setAspetto: (a) =>
    set((s) => {
      const aspetto = { ...s.aspetto, ...a };
      salvaLocale("space.aspetto", aspetto);
      return { aspetto, aspettoVersione: s.aspettoVersione + 1 };
    }),

  skillInFuoco: null,
  setSkillInFuoco: (s) => set({ skillInFuoco: s }),

  consoleAperta: false,
  agenteInEsecuzione: false,
  feed: [],
  apriConsole: () => set({ consoleAperta: true }),
  chiudiConsole: () => set({ consoleAperta: false }),
  // cap: il feed non cresce all'infinito nelle sessioni lunghe
  pushFeed: (e) => set((s) => ({ feed: [...s.feed.slice(-499), e] })),
  svuotaFeed: () => set({ feed: [] }),
  setAgenteInEsecuzione: (v) => set({ agenteInEsecuzione: v }),
}));
