"use client";

/**
 * I 5 temi di space. Ogni tema ridefinisce i token CSS della UI e le tinte
 * della galassia (nucleo, polvere, stelle). Il default e la reference NGC 4414.
 */

export interface TemaGalassia {
  /** i 4 sprite del nucleo (cuore, medio, alone largo, scintilla) */
  nucleo: [string, string, string, string];
  /** corsie di polvere: tinta chiara e scura */
  polvere: [string, string];
  /** bianco-stella verso cui virano le periferie */
  stella: string;
  /** tinta dei god node e delle connessioni sorprendenti */
  oro: string;
}

export interface Tema {
  id: string;
  nome: string;
  descrizione: string;
  vars: Record<string, string>;
  galassia: TemaGalassia;
}

export const TEMI: Tema[] = [
  {
    id: "ngc4414",
    nome: "NGC 4414",
    descrizione: "Caldo e fotografico: nucleo dorato, periferie azzurre.",
    vars: {
      "--fondo": "#05060a",
      "--fondo-2": "#0a0c14",
      "--superficie": "#100f14",
      "--superficie-2": "#16141c",
      "--linea": "rgba(190, 160, 110, 0.14)",
      "--linea-forte": "rgba(190, 160, 110, 0.28)",
      "--inchiostro": "#ece5d8",
      "--inchiostro-2": "#b0a795",
      "--inchiostro-3": "#837a6b",
      "--oro": "#f6e7c1",
      "--oro-2": "#ffd98a",
      "--ambra": "#ffbf69",
      "--polvere": "#8a6a44",
      "--polvere-2": "#6b4f34",
      "--stella": "#dfe9ff",
      "--stella-2": "#bcd3ff",
    },
    galassia: {
      nucleo: ["#f6e7c1", "#ffd98a", "#ffbf69", "#ffedcc"],
      polvere: ["#8a6a44", "#6b4f34"],
      stella: "#dfe9ff",
      oro: "#ffd98a",
    },
  },
  {
    id: "andromeda",
    nome: "Andromeda",
    descrizione: "Freddo e siderale: azzurri, ghiaccio, notte profonda.",
    vars: {
      "--fondo": "#04060c",
      "--fondo-2": "#090e1a",
      "--superficie": "#0d1017",
      "--superficie-2": "#12161f",
      "--linea": "rgba(130, 160, 210, 0.16)",
      "--linea-forte": "rgba(130, 160, 210, 0.3)",
      "--inchiostro": "#dfe6f2",
      "--inchiostro-2": "#98a5bd",
      "--inchiostro-3": "#6b7690",
      "--oro": "#cfe0ff",
      "--oro-2": "#9fc2ff",
      "--ambra": "#7aa5ec",
      "--polvere": "#54648a",
      "--polvere-2": "#3d4a68",
      "--stella": "#eaf2ff",
      "--stella-2": "#cfe0ff",
    },
    galassia: {
      nucleo: ["#eaf2ff", "#b8d2ff", "#84a9e8", "#ffffff"],
      polvere: ["#54648a", "#3d4a68"],
      stella: "#eaf2ff",
      oro: "#9fc2ff",
    },
  },
  {
    id: "nebulosa",
    nome: "Nebulosa",
    descrizione: "Viola e rosa: polveri di emissione, atmosfera sognante.",
    vars: {
      "--fondo": "#070510",
      "--fondo-2": "#100a1c",
      "--superficie": "#130e1c",
      "--superficie-2": "#1a1226",
      "--linea": "rgba(200, 150, 210, 0.16)",
      "--linea-forte": "rgba(200, 150, 210, 0.3)",
      "--inchiostro": "#ece2f0",
      "--inchiostro-2": "#af9dbd",
      "--inchiostro-3": "#7d6d8c",
      "--oro": "#f2d5ea",
      "--oro-2": "#e8a3c8",
      "--ambra": "#c88ce0",
      "--polvere": "#6b4468",
      "--polvere-2": "#4c2e4c",
      "--stella": "#f0e4ff",
      "--stella-2": "#d9c2f2",
    },
    galassia: {
      nucleo: ["#f2d5ea", "#e8a3c8", "#b482d8", "#ffe8f4"],
      polvere: ["#6b4468", "#4c2e4c"],
      stella: "#f0e4ff",
      oro: "#e8a3c8",
    },
  },
  {
    id: "supernova",
    nome: "Supernova",
    descrizione: "Fuoco e ambra: energia, contrasto, rosso profondo.",
    vars: {
      "--fondo": "#0a0505",
      "--fondo-2": "#140b08",
      "--superficie": "#160e0b",
      "--superficie-2": "#1e1310",
      "--linea": "rgba(220, 150, 100, 0.16)",
      "--linea-forte": "rgba(220, 150, 100, 0.3)",
      "--inchiostro": "#f2e4d8",
      "--inchiostro-2": "#bda392",
      "--inchiostro-3": "#8c7264",
      "--oro": "#ffd9b0",
      "--oro-2": "#ffb060",
      "--ambra": "#f28c4a",
      "--polvere": "#7a4a30",
      "--polvere-2": "#54301e",
      "--stella": "#ffe9d6",
      "--stella-2": "#ffcfa8",
    },
    galassia: {
      nucleo: ["#ffe9d6", "#ffb060", "#f2703a", "#fff2e0"],
      polvere: ["#7a4a30", "#54301e"],
      stella: "#ffe9d6",
      oro: "#ffb060",
    },
  },
  {
    id: "foresta",
    nome: "Foresta",
    descrizione: "Verde bamboo su notte calda: editoriale, quieto.",
    vars: {
      "--fondo": "#05080a",
      "--fondo-2": "#0a120e",
      "--superficie": "#0e1410",
      "--superficie-2": "#131a15",
      "--linea": "rgba(150, 190, 140, 0.16)",
      "--linea-forte": "rgba(150, 190, 140, 0.3)",
      "--inchiostro": "#e4ecdd",
      "--inchiostro-2": "#a3b598",
      "--inchiostro-3": "#71836a",
      "--oro": "#dcecc0",
      "--oro-2": "#b6d698",
      "--ambra": "#8fc072",
      "--polvere": "#4a5f42",
      "--polvere-2": "#34452e",
      "--stella": "#ecf4e4",
      "--stella-2": "#cfe4c0",
    },
    galassia: {
      nucleo: ["#ecf4e4", "#cfe4a8", "#a0c878", "#f6ffe8"],
      polvere: ["#4a5f42", "#34452e"],
      stella: "#ecf4e4",
      oro: "#b6d698",
    },
  },
];

export function temaPerId(id: string): Tema {
  return TEMI.find((t) => t.id === id) ?? TEMI[0];
}

/** Applica i token CSS del tema al documento. */
export function applicaTema(tema: Tema): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tema.vars)) {
    root.style.setProperty(k, v);
  }
}

/** Espone i colori delle aree del vault come CSS var (--area-<key>). */
export function applicaColoriAree(aree: Array<{ key: string; colore: string }>): void {
  const root = document.documentElement;
  for (const a of aree) {
    root.style.setProperty(`--area-${a.key}`, a.colore);
  }
}
