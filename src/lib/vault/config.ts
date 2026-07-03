import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Configurazione di space.
 *
 * Tutto cio che e personale (percorso del vault, aree, colori, modelli)
 * vive in `space.config.json` (gitignored). Senza config, space funziona
 * comunque: scopre le aree dalle cartelle top-level del vault e genera una
 * palette. Vedi `space.config.example.json` per lo schema completo.
 */

export type AreaKey = string;

export interface AreaDef {
  key: AreaKey;
  cartella: string; // cartella root nel vault ("" = file a root)
  nome: string;
  colore: string;
  /** Indice del braccio a spirale (null = nucleo o corsia di polvere). */
  braccio: number | null;
  /** true = renderizzata come corsia di polvere (log, archivio). */
  polvere?: boolean;
}

export interface ModelloAgente {
  id: string;
  etichetta: string;
  provider: "claude" | "openai";
  /** solo provider openai-compatibile (Ollama, LM Studio, vLLM...) */
  baseUrl?: string;
  /** nome della variabile d'ambiente con la chiave (mai la chiave in chiaro) */
  chiaveEnv?: string;
}

export interface SpaceConfig {
  vault: { path: string; nome: string };
  /** vuoto = auto-scoperta dalle cartelle top-level */
  aree: Array<{
    cartella: string;
    nome?: string;
    colore?: string;
    braccio?: number | null;
    polvere?: boolean;
  }>;
  escludi: string[];
  escludiPrefissi: string[];
  agente: {
    /** file di regole del vault per il system prompt (relativi al vault) */
    regole: string[];
    /** file che l'agente puo toccare solo con conferma */
    protetti: string[];
    modelli: ModelloAgente[];
  };
  graphify: { graphJson: string; report: string };
}

const CONFIG_DEFAULT: SpaceConfig = {
  vault: { path: "", nome: "Vault" },
  aree: [],
  escludi: [],
  escludiPrefissi: [],
  agente: {
    regole: [],
    protetti: [],
    modelli: [
      { id: "claude-opus-4-8", etichetta: "Claude Opus 4.8", provider: "claude" },
      { id: "claude-sonnet-5", etichetta: "Claude Sonnet 5", provider: "claude" },
      { id: "claude-haiku-4-5", etichetta: "Claude Haiku 4.5", provider: "claude" },
    ],
  },
  graphify: {
    graphJson: "08_AI/graphify/output/current/graph.json",
    report: "08_AI/graphify/output/current/GRAPH_REPORT.md",
  },
};

/** Cartelle mai indicizzate, oltre a quelle in config. */
const ESCLUSE_SEMPRE = [".obsidian", ".git", ".trash", ".stfolder", "node_modules"];
/** Nomi tipici di cartelle allegati/template: esclusi anche senza config. */
const ESCLUSE_TIPICHE = [
  "Attachments",
  "attachments",
  "assets",
  "_Templates",
  "templates",
  "graphify-out",
];

/** Palette per vault senza config: calda, desaturata, leggibile su scuro. */
const PALETTE_AUTO = [
  "#E8B84A", "#D97757", "#4FA3A5", "#9886B8", "#7D9D78", "#C77B91",
  "#6487B6", "#B07AA1", "#D6A53A", "#8A9A5B", "#C08552", "#7A9CC6",
];

function espandi(p: string): string {
  if (!p) return p;
  return path.resolve(p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);
}

function slug(cartella: string): string {
  return (
    cartella
      .replace(/^\d+[_\-\s]*/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "area"
  );
}

function nomeLeggibile(cartella: string): string {
  return cartella.replace(/^\d+[_\-\s]*/, "").replace(/[_-]+/g, " ").trim() || cartella;
}

/* ------------------------------------------------------------------ */
/* Caricamento (sincrono, memoizzato sul mtime del file di config)     */
/* ------------------------------------------------------------------ */

interface Risolta {
  config: SpaceConfig;
  vaultPath: string;
  aree: AreaDef[];
  mtime: number;
}

let memo: Risolta | null = null;

function fileConfig(): string {
  return path.join(process.cwd(), "space.config.json");
}

function leggiConfig(): SpaceConfig {
  try {
    const raw = fs.readFileSync(fileConfig(), "utf8");
    const utente = JSON.parse(raw) as Partial<SpaceConfig>;
    return {
      ...CONFIG_DEFAULT,
      ...utente,
      vault: { ...CONFIG_DEFAULT.vault, ...utente.vault },
      aree: utente.aree ?? [],
      escludi: utente.escludi ?? [],
      escludiPrefissi: utente.escludiPrefissi ?? [],
      agente: {
        regole: utente.agente?.regole ?? [],
        protetti: utente.agente?.protetti ?? [],
        modelli: utente.agente?.modelli?.length
          ? utente.agente.modelli
          : CONFIG_DEFAULT.agente.modelli,
      },
      graphify: { ...CONFIG_DEFAULT.graphify, ...utente.graphify },
    };
  } catch {
    return CONFIG_DEFAULT;
  }
}

function pareCartellaPolvere(cartella: string): boolean {
  const pulita = cartella.replace(/^\d+[_\-\s]*/, "");
  return /^(logs?|archiv|journal|daily)/i.test(pulita);
}

/** Auto-scoperta aree: le cartelle top-level del vault diventano bracci. */
function scopriAree(root: string, cfg: SpaceConfig): AreaDef[] {
  let cartelle: string[] = [];
  try {
    cartelle = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter(
        (n) =>
          !n.startsWith(".") &&
          !ESCLUSE_SEMPRE.includes(n) &&
          !ESCLUSE_TIPICHE.includes(n) &&
          !cfg.escludi.includes(n)
      )
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
  let braccio = 0;
  return cartelle.map((cartella) => {
    const polvere = pareCartellaPolvere(cartella);
    const def: AreaDef = {
      key: slug(cartella),
      cartella,
      nome: nomeLeggibile(cartella),
      colore: PALETTE_AUTO[(polvere ? 9 : braccio) % PALETTE_AUTO.length],
      braccio: polvere ? null : braccio % 10,
      polvere,
    };
    if (!polvere) braccio += 1;
    return def;
  });
}

function risolvi(): Risolta {
  let mtime = 0;
  try {
    mtime = fs.statSync(fileConfig()).mtimeMs;
  } catch {
    mtime = -1; // nessun file di config: default + auto-scoperta
  }
  if (memo && memo.mtime === mtime) return memo;

  const config = leggiConfig();
  const root = risolviVaultPathInterno(config);

  let aree: AreaDef[];
  if (config.aree.length > 0) {
    let braccio = 0;
    aree = config.aree.map((a) => {
      const polvere = a.polvere ?? false;
      const def: AreaDef = {
        key: slug(a.cartella),
        cartella: a.cartella,
        nome: a.nome ?? nomeLeggibile(a.cartella),
        colore: a.colore ?? PALETTE_AUTO[braccio % PALETTE_AUTO.length],
        braccio: polvere ? null : (a.braccio ?? braccio % 10),
        polvere,
      };
      if (!polvere) braccio += 1;
      return def;
    });
  } else {
    aree = scopriAree(root, config);
  }
  aree.push({ key: "sistema", cartella: "", nome: "Sistema", colore: "#E8D5A8", braccio: null });

  memo = { config, vaultPath: root, aree, mtime };
  return memo;
}

function risolviVaultPathInterno(cfg: SpaceConfig): string {
  const daEnv = process.env.SPACE_VAULT_PATH || process.env.MIND_VAULT_PATH;
  const scelto = daEnv || cfg.vault.path || "~/Documents/Mind";
  return espandi(scelto);
}

/* ------------------------------------------------------------------ */
/* API pubblica                                                        */
/* ------------------------------------------------------------------ */

export function spaceConfig(): SpaceConfig {
  return risolvi().config;
}

export function vaultPath(): string {
  return risolvi().vaultPath;
}

export function vaultName(): string {
  return (
    process.env.SPACE_VAULT_NAME ||
    process.env.MIND_VAULT_NAME ||
    risolvi().config.vault.nome
  );
}

export function getAree(): AreaDef[] {
  return risolvi().aree;
}

export function areaDaPath(rel: string): AreaDef {
  const top = rel.split("/")[0];
  const aree = getAree();
  return aree.find((a) => a.cartella === top) ?? aree.find((a) => a.key === "sistema")!;
}

export function areaPerKey(key: AreaKey): AreaDef {
  const aree = getAree();
  return aree.find((a) => a.key === key) ?? aree.find((a) => a.key === "sistema")!;
}

/** Cartelle mai attraversate dal walker e mai osservate dal watcher. */
export function cartelleEscluse(): Set<string> {
  return new Set([...ESCLUSE_SEMPRE, ...ESCLUSE_TIPICHE, ...spaceConfig().escludi]);
}

/** Sottoalberi esclusi dalle note (artefatti derivati, non conoscenza primaria). */
export function prefissiEsclusi(): string[] {
  const cfg = spaceConfig();
  // la cartella di output di graphify non e mai conoscenza primaria
  const outputGraphify = path.dirname(path.dirname(cfg.graphify.graphJson)) + "/";
  return [...new Set([...cfg.escludiPrefissi, outputGraphify])];
}

export function graphJsonPath(): string {
  return path.join(vaultPath(), spaceConfig().graphify.graphJson);
}
export function graphReportPath(): string {
  return path.join(vaultPath(), spaceConfig().graphify.report);
}

export function modelliAgente(): ModelloAgente[] {
  return spaceConfig().agente.modelli;
}

export function fileProtetti(): Set<string> {
  const daConfig = spaceConfig().agente.protetti;
  if (daConfig.length) return new Set(daConfig);
  // default sensato: i manuali degli agenti a root del vault
  return new Set(["CLAUDE.md", "_CLAUDE.md", "AGENTS.md", "CODEX.md", "GEMINI.md", "ANTIGRAVITY.md"]);
}

export function fileRegole(): string[] {
  const daConfig = spaceConfig().agente.regole;
  if (daConfig.length) return daConfig;
  // default: i manuali che esistono davvero nel vault
  const root = vaultPath();
  return ["_CLAUDE.md", "CLAUDE.md", "AGENTS.md", "index.md"].filter((f) => {
    try {
      fs.accessSync(path.join(root, f));
      return true;
    } catch {
      return false;
    }
  });
}
