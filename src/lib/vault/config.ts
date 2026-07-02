import os from "node:os";
import path from "node:path";

/**
 * Percorso del vault Mind. Configurabile via env MIND_VAULT_PATH
 * (default ~/Documents/Mind). Supporta la tilde.
 */
export function vaultPath(): string {
  const raw = process.env.MIND_VAULT_PATH || "~/Documents/Mind";
  const espanso = raw.startsWith("~")
    ? path.join(os.homedir(), raw.slice(1))
    : raw;
  return path.resolve(espanso);
}

/** Nome del vault per gli URI obsidian:// (env MIND_VAULT_NAME). */
export function vaultName(): string {
  return process.env.MIND_VAULT_NAME || "Mind";
}

export type AreaKey =
  | "inbox"
  | "design"
  | "finanze"
  | "archviz"
  | "content"
  | "pc"
  | "casa"
  | "idee"
  | "ai"
  | "archivio"
  | "logs"
  | "sistema";

export interface AreaDef {
  key: AreaKey;
  cartella: string; // cartella root nel vault ("" = file a root)
  nome: string;
  /** Colore Flexoki dell'area, allineato ai gruppi del Graph di Obsidian
   *  (fonte: Mind - Configurazione visuale.md). */
  colore: string;
  /** Indice del braccio a spirale (null = non è un braccio: nucleo o polvere). */
  braccio: number | null;
}

export const AREE: AreaDef[] = [
  { key: "inbox", cartella: "00_INBOX", nome: "Inbox", colore: "#E8B84A", braccio: 0 },
  { key: "design", cartella: "01_DESIGN", nome: "Design", colore: "#D97757", braccio: 1 },
  { key: "finanze", cartella: "02_FINANZE", nome: "Finanze", colore: "#D6A53A", braccio: 2 },
  { key: "archviz", cartella: "03_ARCHVIZ", nome: "Archviz", colore: "#4FA3A5", braccio: 3 },
  { key: "content", cartella: "04_CONTENT_CREATION", nome: "Content", colore: "#C77B91", braccio: 4 },
  { key: "pc", cartella: "05_PC_SETUP", nome: "PC Setup", colore: "#6487B6", braccio: 5 },
  { key: "casa", cartella: "06_CASA", nome: "Casa", colore: "#7D9D78", braccio: 6 },
  { key: "idee", cartella: "07_IDEE", nome: "Idee", colore: "#9886B8", braccio: 7 },
  { key: "ai", cartella: "08_AI", nome: "AI", colore: "#B07AA1", braccio: 8 },
  { key: "archivio", cartella: "99_ARCHIVIO", nome: "Archivio", colore: "#77736B", braccio: 9 },
  { key: "logs", cartella: "Logs", nome: "Logs", colore: "#979293", braccio: null },
  { key: "sistema", cartella: "", nome: "Sistema", colore: "#E8D5A8", braccio: null },
];

const perCartella = new Map(AREE.filter((a) => a.cartella).map((a) => [a.cartella, a]));
const perKey = new Map(AREE.map((a) => [a.key, a]));

export function areaDaPath(rel: string): AreaDef {
  const top = rel.split("/")[0];
  return perCartella.get(top) ?? perKey.get("sistema")!;
}

export function areaPerKey(key: AreaKey): AreaDef {
  return perKey.get(key)!;
}

/** Cartelle mai attraversate dal walker e mai osservate dal watcher. */
export const CARTELLE_ESCLUSE = new Set([
  ".obsidian",
  ".git",
  ".trash",
  "Attachments",
  "graphify-out",
  "_Templates",
]);

/** Sottoalberi esclusi dalle note (artefatti derivati, non conoscenza primaria). */
export const PREFISSI_ESCLUSI = ["08_AI/graphify/output/"];

/** Percorsi Graphify dentro il vault. */
export function graphJsonPath(): string {
  return path.join(vaultPath(), "08_AI/graphify/output/current/graph.json");
}
export function graphReportPath(): string {
  return path.join(vaultPath(), "08_AI/graphify/output/current/GRAPH_REPORT.md");
}
