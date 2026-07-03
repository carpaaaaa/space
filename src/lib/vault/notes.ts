import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import {
  AreaKey,
  areaDaPath,
  cartelleEscluse,
  prefissiEsclusi,
  vaultPath,
} from "./config";
import { memoPerVersione } from "./watcher";

export interface Heading {
  livello: number;
  testo: string;
}

export interface NotaMeta {
  /** Percorso relativo al vault, con estensione .md */
  rel: string;
  titolo: string;
  areaKey: AreaKey;
  tipo?: string;
  stato?: string;
  creata?: string;
  aggiornata?: string;
  tags: string[];
  /** nome, aliases e concept-originale dal frontmatter (per risolvere rinomini) */
  aliases: string[];
  estratto: string;
  /** Target dei wikilink in uscita (raw, senza alias/ancora). */
  wikilinks: string[];
  headings: Heading[];
  parole: number;
  mtimeMs: number;
}

export interface VaultSnapshot {
  notes: NotaMeta[];
  /** titolo lowercased -> nota (per risolvere i wikilink) */
  perTitolo: Map<string, NotaMeta>;
  perRel: Map<string, NotaMeta>;
  /** rel -> body markdown (senza frontmatter) */
  bodies: Map<string, string>;
  costruitoIl: number;
}

const RE_WIKILINK = /(?<!!)\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\|[^\[\]]*)?\]\]/g;
const RE_HEADING = /^(#{1,6})\s+(.+?)\s*$/;

/** Rimuove i blocchi di codice recintati (```...```): niente wikilink o task lì dentro. */
export function senzaCodeFence(md: string): string {
  return md.replace(/```[\s\S]*?```/g, "");
}

function normalizzaData(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s || undefined;
}

function normalizzaTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function estraiEstratto(body: string): string {
  const pulito = senzaCodeFence(body);
  for (const rigaRaw of pulito.split("\n")) {
    const riga = rigaRaw.trim();
    if (!riga) continue;
    if (riga.startsWith("#")) continue;
    if (riga.startsWith(">")) continue;
    if (riga.startsWith("|")) continue;
    if (riga.startsWith("---")) continue;
    const testo = riga
      .replace(RE_WIKILINK, (_m, t) => String(t))
      .replace(/[*_`]/g, "")
      .trim();
    if (testo.length < 3) continue;
    return testo.length > 220 ? testo.slice(0, 217) + "..." : testo;
  }
  return "";
}

async function* cammina(dir: string, root: string): AsyncGenerator<string> {
  const escluse = cartelleEscluse();
  const prefissi = prefissiEsclusi();
  const voci = await fs.readdir(dir, { withFileTypes: true });
  for (const voce of voci) {
    if (voce.name.startsWith(".")) continue;
    const assoluto = path.join(dir, voce.name);
    const relVoce = path.relative(root, assoluto).split(path.sep).join("/");
    if (voce.isDirectory()) {
      const top = relVoce.split("/")[0];
      if (escluse.has(top)) continue;
      if (prefissi.some((p) => (relVoce + "/").startsWith(p))) continue;
      yield* cammina(assoluto, root);
    } else if (voce.isFile() && voce.name.endsWith(".md")) {
      if (prefissi.some((p) => relVoce.startsWith(p))) continue;
      yield assoluto;
    }
  }
}

async function costruisci(): Promise<VaultSnapshot> {
  const root = vaultPath();
  const notes: NotaMeta[] = [];
  const bodies = new Map<string, string>();

  for await (const assoluto of cammina(root, root)) {
    const rel = path.relative(root, assoluto).split(path.sep).join("/");
    let raw: string;
    let mtimeMs = 0;
    try {
      raw = await fs.readFile(assoluto, "utf8");
      mtimeMs = (await fs.stat(assoluto)).mtimeMs;
    } catch {
      continue;
    }
    // strip BOM difensivo (il vault li vieta ma non ci affidiamo)
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    // normalizza CRLF/CR -> LF: le note scritte da Windows (Codex, sync)
    // altrimenti rompono i parser a riga (in JS "." e "$" non gestiscono \r)
    raw = raw.replace(/\r\n?/g, "\n");

    let fm: Record<string, unknown> = {};
    let body = raw;
    try {
      const m = matter(raw);
      fm = m.data as Record<string, unknown>;
      body = m.content;
    } catch {
      // frontmatter malformato: la nota resta consultabile senza metadati
    }

    const headings: Heading[] = [];
    for (const riga of senzaCodeFence(body).split("\n")) {
      const h = RE_HEADING.exec(riga);
      if (h) headings.push({ livello: h[1].length, testo: h[2] });
    }

    const wikilinks: string[] = [];
    const visto = new Set<string>();
    for (const m of senzaCodeFence(body).matchAll(RE_WIKILINK)) {
      const target = m[1].trim();
      const chiave = target.toLowerCase();
      if (!visto.has(chiave)) {
        visto.add(chiave);
        wikilinks.push(target);
      }
    }

    // chiavi italiane del vault Mind, con fallback alle chiavi inglesi
    // piu comuni nei vault Obsidian generici (template per altri utenti)
    const primo = (...vv: unknown[]) => vv.find((v) => v != null);
    notes.push({
      rel,
      titolo: path.basename(rel, ".md"),
      areaKey: areaDaPath(rel).key,
      tipo: primo(fm.tipo, fm.type) != null ? String(primo(fm.tipo, fm.type)) : undefined,
      stato:
        primo(fm.stato, fm.status) != null ? String(primo(fm.stato, fm.status)) : undefined,
      creata: normalizzaData(primo(fm.creata, fm.created, fm.date)),
      aggiornata: normalizzaData(primo(fm.aggiornata, fm.updated, fm.modified)),
      tags: normalizzaTags(fm.tags),
      aliases: [
        ...normalizzaTags(primo(fm.aliases, fm.alias)),
        ...(fm.nome ? [String(fm.nome)] : []),
        ...(fm["concept-originale"] ? [String(fm["concept-originale"])] : []),
      ],
      estratto: estraiEstratto(body),
      wikilinks,
      headings,
      parole: body.split(/\s+/).filter(Boolean).length,
      mtimeMs,
    });
    bodies.set(rel, body);
  }

  notes.sort((a, b) => a.rel.localeCompare(b.rel, "it"));
  const perTitolo = new Map<string, NotaMeta>();
  // prima gli alias, poi i titoli: in caso di collisione vince il titolo vero
  for (const n of notes) {
    for (const alias of n.aliases) perTitolo.set(alias.toLowerCase(), n);
  }
  for (const n of notes) perTitolo.set(n.titolo.toLowerCase(), n);
  const perRel = new Map(notes.map((n) => [n.rel, n]));
  return { notes, perTitolo, perRel, bodies, costruitoIl: Date.now() };
}

export const getSnapshot = memoPerVersione(costruisci);

/** Risolve un target di wikilink (titolo o percorso) in una nota, se esiste. */
export function risolviWikilink(
  snapshot: VaultSnapshot,
  target: string
): NotaMeta | undefined {
  const pulito = target.trim();
  const perTitolo = snapshot.perTitolo.get(path.basename(pulito, ".md").toLowerCase());
  if (perTitolo) return perTitolo;
  const conMd = pulito.endsWith(".md") ? pulito : pulito + ".md";
  return snapshot.perRel.get(conMd);
}
