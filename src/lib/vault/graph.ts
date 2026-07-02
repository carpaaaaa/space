import fs from "node:fs/promises";
import path from "node:path";
import { AREE, AreaDef, areaPerKey, graphJsonPath, graphReportPath } from "./config";
import { NotaMeta, getSnapshot, risolviWikilink } from "./notes";
import { memoPerVersione } from "./watcher";

/* ------------------------------------------------------------------ */
/* Tipi payload galassia (formato colonnare compatto per il client)    */
/* ------------------------------------------------------------------ */

export const KIND = { nota: 0, concetto: 1, sezione: 2, gap: 3, documento: 4 } as const;
export const FLAG = { god: 1, gap: 2, polvere: 4 } as const;
export const EDGE_TIPO = { wikilink: 0, semantico: 1, contenimento: 2, irrisolto: 3 } as const;

export interface GalaxyStars {
  id: string[];
  label: string[];
  kind: number[];
  /** indice in aree[] */
  area: number[];
  /** xyz appiattito */
  pos: number[];
  size: number[];
  deg: number[];
  flag: number[];
  /** nota associata (rel) per aprire il pannello; null per i gap */
  rel: (string | null)[];
  /** indici in tipi[] / stati[] (solo note, altrimenti -1) */
  tipo: number[];
  stato: number[];
  /** id community Graphify (-1 se nessuna) */
  community: number[];
}

export interface GalaxyEdge {
  a: number;
  b: number;
  tipo: number;
  relazione?: string;
  sorprendente?: boolean;
}

export interface ReportInfo {
  godNodes: { label: string; edges: number; star: number | null }[];
  sorprendenti: { a: string; relazione: string; b: string }[];
  nodiIsolati: number;
  domande: string[];
  totNodi?: number;
  totEdge?: number;
  totCommunity?: number;
  dataReport?: string;
}

export interface GalaxyPayload {
  versione: number;
  aree: (AreaDef & { indice: number })[];
  tipi: string[];
  stati: string[];
  community: { id: number; nome: string; membri: number }[];
  stars: GalaxyStars;
  edges: GalaxyEdge[];
  report: ReportInfo;
  conteggi: {
    note: number;
    concetti: number;
    sezioni: number;
    gap: number;
    documenti: number;
    edges: number;
  };
  graphJsonTrovato: boolean;
}

/* ------------------------------------------------------------------ */
/* RNG deterministico: layout stabile tra reload                       */
/* ------------------------------------------------------------------ */

function hash53(str: string, seed = 7): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function rngDa(seedStr: string): () => number {
  let a = hash53(seedStr) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gaussiana approssimata (media 0, sigma 1). */
function gauss(rnd: () => number): number {
  return (rnd() + rnd() + rnd() + rnd() - 2) / 1.0;
}

/* ------------------------------------------------------------------ */
/* graph.json + GRAPH_REPORT.md                                        */
/* ------------------------------------------------------------------ */

interface GNode {
  id: string;
  label: string;
  file_type?: string;
  source_file?: string;
  path?: string;
  community?: number;
  community_name?: string;
}
interface GLink {
  source: string;
  target: string;
  relation?: string;
  confidence?: string;
  confidence_score?: number;
}

async function leggiGraphJson(): Promise<{ nodes: GNode[]; links: GLink[] } | null> {
  try {
    const raw = await fs.readFile(graphJsonPath(), "utf8");
    const g = JSON.parse(raw);
    return { nodes: g.nodes ?? [], links: g.links ?? g.edges ?? [] };
  } catch {
    return null;
  }
}

async function leggiReport(): Promise<ReportInfo> {
  const info: ReportInfo = { godNodes: [], sorprendenti: [], nodiIsolati: 0, domande: [] };
  let testo = "";
  try {
    testo = await fs.readFile(graphReportPath(), "utf8");
  } catch {
    return info;
  }
  const mData = /Graph Report[^(]*\((\d{4}-\d{2}-\d{2})\)/.exec(testo);
  if (mData) info.dataReport = mData[1];
  const mSum = /(\d+)\s+nodes\s*·\s*(\d+)\s+edges\s*·\s*(\d+)\s+communities/.exec(testo);
  if (mSum) {
    info.totNodi = Number(mSum[1]);
    info.totEdge = Number(mSum[2]);
    info.totCommunity = Number(mSum[3]);
  }
  for (const m of testo.matchAll(/^\d+\.\s+`(.+?)`\s+-\s+(\d+)\s+edges/gm)) {
    info.godNodes.push({ label: m[1], edges: Number(m[2]), star: null });
  }
  for (const m of testo.matchAll(/^-\s+`(.+?)`\s+--(.+?)-->\s+`(.+?)`/gm)) {
    info.sorprendenti.push({ a: m[1], relazione: m[2].trim(), b: m[3] });
  }
  const mIso = /\*\*(\d+)\s+isolated node/.exec(testo);
  if (mIso) info.nodiIsolati = Number(mIso[1]);
  const sezDomande = testo.split(/## Suggested Questions/)[1];
  if (sezDomande) {
    for (const m of sezDomande.matchAll(/^-\s+\*\*(.+?)\*\*/gm)) info.domande.push(m[1]);
  }
  return info;
}

/* ------------------------------------------------------------------ */
/* Layout: disco galattico flocculento (reference NGC 4414)            */
/* ------------------------------------------------------------------ */

const R_CORE = 9;
const R_MAX = 95;
const TWIST = 2.7; // torsione della spirale in radianti dal centro al bordo
const N_BRACCI = 10;

function slotAngolo(slot: number): number {
  return (slot / N_BRACCI) * Math.PI * 2;
}

/** Punto lungo il braccio `slot` con parametro radiale t in [0,1]. */
function puntoBraccio(
  slot: number,
  t: number,
  rnd: () => number,
  spessore = 1
): [number, number, number] {
  const raggio = R_CORE + Math.pow(t, 0.9) * (R_MAX - R_CORE);
  // flocculenza: grumi lungo il braccio + dispersione crescente col raggio
  const angolo =
    slotAngolo(slot) +
    t * TWIST +
    gauss(rnd) * (0.06 + 0.22 * t) +
    (rnd() < 0.18 ? gauss(rnd) * 0.35 : 0); // ciuffi fuori-braccio
  const rJitter = raggio + gauss(rnd) * (1.2 + 5.5 * t);
  const y = gauss(rnd) * (0.9 + 1.6 * (1 - t)) * spessore;
  return [Math.cos(angolo) * rJitter, y, Math.sin(angolo) * rJitter];
}

function puntoBulge(rnd: () => number): [number, number, number] {
  const angolo = rnd() * Math.PI * 2;
  const raggio = Math.pow(rnd(), 1.6) * R_CORE;
  return [Math.cos(angolo) * raggio, gauss(rnd) * 2.2, Math.sin(angolo) * raggio];
}

function puntoAlone(rnd: () => number): [number, number, number] {
  const angolo = rnd() * Math.PI * 2;
  const raggio = R_MAX * (1.04 + rnd() * 0.34);
  return [Math.cos(angolo) * raggio, gauss(rnd) * 5, Math.sin(angolo) * raggio];
}

/* ------------------------------------------------------------------ */
/* Costruzione                                                         */
/* ------------------------------------------------------------------ */

function normLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/[`"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function costruisci(): Promise<GalaxyPayload> {
  const snap = await getSnapshot();
  const gjson = await leggiGraphJson();
  const report = await leggiReport();

  const stars: GalaxyStars = {
    id: [],
    label: [],
    kind: [],
    area: [],
    pos: [],
    size: [],
    deg: [],
    flag: [],
    rel: [],
    tipo: [],
    stato: [],
    community: [],
  };
  const edges: GalaxyEdge[] = [];

  const areaIndice = new Map(AREE.map((a, i) => [a.key, i]));
  const tipi: string[] = [];
  const stati: string[] = [];
  const idxTipo = (v?: string) => {
    if (!v) return -1;
    let i = tipi.indexOf(v);
    if (i === -1) {
      tipi.push(v);
      i = tipi.length - 1;
    }
    return i;
  };
  const idxStato = (v?: string) => {
    if (!v) return -1;
    let i = stati.indexOf(v);
    if (i === -1) {
      stati.push(v);
      i = stati.length - 1;
    }
    return i;
  };

  function aggiungiStar(s: {
    id: string;
    label: string;
    kind: number;
    areaKey: NotaMeta["areaKey"];
    pos: [number, number, number];
    size: number;
    deg: number;
    flag: number;
    rel: string | null;
    tipo?: string;
    stato?: string;
    community?: number;
  }): number {
    stars.id.push(s.id);
    stars.label.push(s.label);
    stars.kind.push(s.kind);
    stars.area.push(areaIndice.get(s.areaKey) ?? areaIndice.get("sistema")!);
    stars.pos.push(
      Math.round(s.pos[0] * 100) / 100,
      Math.round(s.pos[1] * 100) / 100,
      Math.round(s.pos[2] * 100) / 100
    );
    stars.size.push(Math.round(s.size * 100) / 100);
    stars.deg.push(s.deg);
    stars.flag.push(s.flag);
    stars.rel.push(s.rel);
    stars.tipo.push(idxTipo(s.tipo));
    stars.stato.push(idxStato(s.stato));
    stars.community.push(s.community ?? -1);
    return stars.id.length - 1;
  }

  /* ---- 1. gradi delle note dai wikilink ---- */
  const gradoNota = new Map<string, number>(); // rel -> grado
  const linkNota: Array<[string, string]> = []; // [relA, relB]
  const irrisolti = new Map<string, string[]>(); // target norm -> [rel note che lo citano]
  for (const nota of snap.notes) {
    for (const target of nota.wikilinks) {
      const dest = risolviWikilink(snap, target);
      if (dest && dest.rel !== nota.rel) {
        linkNota.push([nota.rel, dest.rel]);
        gradoNota.set(nota.rel, (gradoNota.get(nota.rel) ?? 0) + 1);
        gradoNota.set(dest.rel, (gradoNota.get(dest.rel) ?? 0) + 1);
      } else if (!dest) {
        const chiave = normLabel(target);
        const arr = irrisolti.get(chiave) ?? [];
        arr.push(nota.rel);
        irrisolti.set(chiave, arr);
      }
    }
  }

  /* ---- 2. graph.json: entita e merge dei nodi documento sulle note ---- */
  const gNodes = gjson?.nodes ?? [];
  const gLinks = gjson?.links ?? [];
  const gradoEntita = new Map<string, number>();
  for (const l of gLinks) {
    gradoEntita.set(l.source, (gradoEntita.get(l.source) ?? 0) + 1);
    gradoEntita.set(l.target, (gradoEntita.get(l.target) ?? 0) + 1);
  }

  const notaPerBasename = new Map<string, NotaMeta>();
  for (const n of snap.notes) notaPerBasename.set(path.basename(n.rel).toLowerCase(), n);

  function notaDaSourceFile(sf?: string): NotaMeta | undefined {
    if (!sf) return undefined;
    const base = sf.split(/[\\/]/).pop() ?? "";
    if (!base.toLowerCase().endsWith(".md")) return undefined;
    return notaPerBasename.get(base.toLowerCase());
  }

  const entitaSuNota = new Map<string, string>(); // entityId -> nota rel (merge doc)
  const concetti: GNode[] = [];
  const documenti: GNode[] = [];
  for (const gn of gNodes) {
    if (gn.file_type === "document") {
      const nota = notaDaSourceFile(gn.source_file ?? gn.path);
      if (nota) {
        entitaSuNota.set(gn.id, nota.rel);
        gradoNota.set(nota.rel, (gradoNota.get(nota.rel) ?? 0) + (gradoEntita.get(gn.id) ?? 0));
        continue;
      }
      documenti.push(gn);
    } else {
      concetti.push(gn);
    }
  }

  /* ---- 3. stelle nota, per area, t dal grado (piu connessa = piu al centro) ---- */
  const starPerRel = new Map<string, number>();
  const perArea = new Map<string, NotaMeta[]>();
  for (const n of snap.notes) {
    const arr = perArea.get(n.areaKey) ?? [];
    arr.push(n);
    perArea.set(n.areaKey, arr);
  }

  const SLOT_POLVERE: Record<string, number> = { logs: 3.5, archivio: 8.5 };

  for (const [areaKey, note] of perArea) {
    const area = areaPerKey(areaKey as never);
    const ordinate = [...note].sort(
      (a, b) => (gradoNota.get(b.rel) ?? 0) - (gradoNota.get(a.rel) ?? 0)
    );
    ordinate.forEach((nota, rank) => {
      const rnd = rngDa("nota:" + nota.rel);
      const deg = gradoNota.get(nota.rel) ?? 0;
      let pos: [number, number, number];
      let flag = 0;
      if (areaKey === "sistema") {
        pos = puntoBulge(rnd);
      } else if (areaKey === "logs" || areaKey === "archivio") {
        // corsie di polvere tra i bracci
        const slot = SLOT_POLVERE[areaKey];
        const t =
          areaKey === "logs"
            ? // log recenti verso il centro
              Math.min(0.95, 0.15 + (rank / Math.max(1, ordinate.length - 1)) * 0.8)
            : 0.2 + rnd() * 0.75;
        pos = puntoBraccio(slot, t, rnd, 0.6);
        flag |= FLAG.polvere;
      } else {
        const t =
          ordinate.length === 1
            ? 0.35
            : 0.12 + 0.82 * (rank / (ordinate.length - 1));
        pos = puntoBraccio(area.braccio ?? 0, t, rnd);
      }
      if (deg === 0) flag |= FLAG.gap;
      const size = 1.15 + Math.min(3.2, Math.sqrt(deg) * 0.55);
      const idx = aggiungiStar({
        id: "nota:" + nota.rel,
        label: nota.titolo,
        kind: KIND.nota,
        areaKey: nota.areaKey,
        pos,
        size,
        deg,
        flag,
        rel: nota.rel,
        tipo: nota.tipo,
        stato: nota.stato,
      });
      starPerRel.set(nota.rel, idx);
    });
  }

  /* ---- 4. god nodes dal report ---- */
  const perNorm = new Map<string, number>(); // norm label -> star idx (note prima)
  /** tutte le stelle per label normalizzata (per le surprising connections) */
  const multiPerNorm = new Map<string, number[]>();
  const registraMulti = (label: string, idx: number) => {
    const chiave = normLabel(label);
    const arr = multiPerNorm.get(chiave) ?? [];
    if (!arr.includes(idx)) arr.push(idx);
    multiPerNorm.set(chiave, arr);
  };
  snap.notes.forEach((n) => {
    const idx = starPerRel.get(n.rel);
    if (idx == null) return;
    perNorm.set(normLabel(n.titolo), idx);
    registraMulti(n.titolo, idx);
    for (const alias of n.aliases) {
      if (!perNorm.has(normLabel(alias))) perNorm.set(normLabel(alias), idx);
      registraMulti(alias, idx);
    }
    const h1 = n.headings.find((h) => h.livello === 1);
    if (h1 && !perNorm.has(normLabel(h1.testo))) perNorm.set(normLabel(h1.testo), idx);
  });

  /* ---- 5. stelle concetto attorno alla nota sorgente ---- */
  const starPerEntita = new Map<string, number>();
  for (const [id, rel] of entitaSuNota) {
    const idx = starPerRel.get(rel);
    if (idx != null) starPerEntita.set(id, idx);
  }
  const communityConteggio = new Map<number, { nome: string; membri: number }>();

  for (const gn of concetti) {
    const rnd = rngDa("concetto:" + gn.id);
    const parent = notaDaSourceFile(gn.source_file ?? gn.path);
    const deg = gradoEntita.get(gn.id) ?? 0;
    let pos: [number, number, number];
    let areaKey: NotaMeta["areaKey"] = "sistema";
    if (parent) {
      const pIdx = starPerRel.get(parent.rel)!;
      const base: [number, number, number] = [
        stars.pos[pIdx * 3],
        stars.pos[pIdx * 3 + 1],
        stars.pos[pIdx * 3 + 2],
      ];
      const rLoc = 1.6 + rnd() * 3.4;
      const a = rnd() * Math.PI * 2;
      pos = [
        base[0] + Math.cos(a) * rLoc,
        base[1] + gauss(rnd) * 0.8,
        base[2] + Math.sin(a) * rLoc,
      ];
      areaKey = parent.areaKey;
    } else {
      pos = puntoAlone(rnd);
    }
    let flag = 0;
    if (deg <= 1) flag |= FLAG.gap;
    if (gn.community != null) {
      const c = communityConteggio.get(gn.community) ?? {
        nome: gn.community_name ?? String(gn.community),
        membri: 0,
      };
      c.membri += 1;
      communityConteggio.set(gn.community, c);
    }
    const idx = aggiungiStar({
      id: "c:" + gn.id,
      label: gn.label,
      kind: KIND.concetto,
      areaKey,
      pos,
      size: 0.45 + Math.min(1.6, Math.sqrt(deg) * 0.3),
      deg,
      flag,
      rel: parent?.rel ?? null,
      community: gn.community,
    });
    starPerEntita.set(gn.id, idx);
    if (!perNorm.has(normLabel(gn.label))) perNorm.set(normLabel(gn.label), idx);
    registraMulti(gn.label, idx);
    // le entita frontmatter tipo "progetto: X" rispondono anche a "X"
    const mPrefisso = /^[\w-]+:\s*(.+)$/.exec(gn.label);
    if (mPrefisso) registraMulti(mPrefisso[1], idx);
  }

  /* ---- 6. documenti non-md (brochure, allegati citati dal grafo) ---- */
  for (const gn of documenti) {
    const rnd = rngDa("doc:" + gn.id);
    const deg = gradoEntita.get(gn.id) ?? 0;
    const idx = aggiungiStar({
      id: "d:" + gn.id,
      label: gn.label,
      kind: KIND.documento,
      areaKey: "archivio",
      pos: puntoBraccio(8.5, 0.3 + rnd() * 0.6, rnd, 0.6),
      size: 0.6 + Math.min(1.2, Math.sqrt(deg) * 0.25),
      deg,
      flag: FLAG.polvere,
      rel: null,
      community: gn.community,
    });
    starPerEntita.set(gn.id, idx);
  }

  /* ---- 7. micro-stelle sezione (LOD, solo heading 2-3) ---- */
  let sezioni = 0;
  for (const nota of snap.notes) {
    if (nota.areaKey === "logs") continue;
    const pIdx = starPerRel.get(nota.rel);
    if (pIdx == null) continue;
    const base: [number, number, number] = [
      stars.pos[pIdx * 3],
      stars.pos[pIdx * 3 + 1],
      stars.pos[pIdx * 3 + 2],
    ];
    nota.headings
      .filter((h) => h.livello >= 2 && h.livello <= 3)
      .forEach((h, i) => {
        const rnd = rngDa("sez:" + nota.rel + "#" + i);
        const rLoc = 0.6 + rnd() * 1.5;
        const a = rnd() * Math.PI * 2;
        const idxSez = aggiungiStar({
          id: "s:" + nota.rel + "#" + i,
          label: h.testo,
          kind: KIND.sezione,
          areaKey: nota.areaKey,
          pos: [
            base[0] + Math.cos(a) * rLoc,
            base[1] + gauss(rnd) * 0.35,
            base[2] + Math.sin(a) * rLoc,
          ],
          size: 0.22 + rnd() * 0.14,
          deg: 0,
          flag: 0,
          rel: nota.rel,
        });
        registraMulti(h.testo, idxSez);
        sezioni += 1;
      });
  }

  /* ---- 8. stelle di campo: wikilink irrisolti (knowledge gap reali) ---- */
  let gapCount = 0;
  for (const [chiave, citanti] of irrisolti) {
    const rnd = rngDa("gap:" + chiave);
    const idx = aggiungiStar({
      id: "gap:" + chiave,
      label: citanti.length ? chiave : chiave,
      kind: KIND.gap,
      areaKey: "sistema",
      pos: puntoAlone(rnd),
      size: 0.35 + Math.min(0.5, citanti.length * 0.12),
      deg: citanti.length,
      flag: FLAG.gap,
      rel: null,
    });
    gapCount += 1;
    for (const rel of citanti) {
      const aIdx = starPerRel.get(rel);
      if (aIdx != null) edges.push({ a: aIdx, b: idx, tipo: EDGE_TIPO.irrisolto });
    }
  }

  /* ---- 9. edge ---- */
  const vistiEdge = new Set<string>();
  for (const [ra, rb] of linkNota) {
    const a = starPerRel.get(ra);
    const b = starPerRel.get(rb);
    if (a == null || b == null) continue;
    const chiave = a < b ? a + ":" + b : b + ":" + a;
    if (vistiEdge.has("w" + chiave)) continue;
    vistiEdge.add("w" + chiave);
    edges.push({ a, b, tipo: EDGE_TIPO.wikilink });
  }
  const coppieSorprendenti = new Set(
    report.sorprendenti.map((s) => normLabel(s.a) + "|" + normLabel(s.b))
  );
  for (const l of gLinks) {
    const a = starPerEntita.get(l.source);
    const b = starPerEntita.get(l.target);
    if (a == null || b == null || a === b) continue;
    const chiave = a < b ? a + ":" + b : b + ":" + a;
    if (vistiEdge.has("g" + chiave)) continue;
    vistiEdge.add("g" + chiave);
    const na = normLabel(stars.label[a]);
    const nb = normLabel(stars.label[b]);
    const sorprendente =
      l.confidence === "INFERRED" ||
      coppieSorprendenti.has(na + "|" + nb) ||
      coppieSorprendenti.has(nb + "|" + na);
    edges.push({
      a,
      b,
      tipo: EDGE_TIPO.semantico,
      relazione: l.relation,
      sorprendente: sorprendente || undefined,
    });
  }
  // contenimento concetto -> nota sorgente (filamenti brevi, visibili in zoom)
  for (const gn of concetti) {
    const cIdx = starPerEntita.get(gn.id);
    const parent = notaDaSourceFile(gn.source_file ?? gn.path);
    if (cIdx == null || !parent) continue;
    const pIdx = starPerRel.get(parent.rel);
    if (pIdx == null) continue;
    edges.push({ a: pIdx, b: cIdx, tipo: EDGE_TIPO.contenimento });
  }

  /* ---- 10. surprising connections del report (sintetizzate se assenti dal grafo) ---- */
  const chiaveEdge = (a: number, b: number) => (a < b ? a + ":" + b : b + ":" + a);
  const esisteEdge = (a: number, b: number) =>
    vistiEdge.has("w" + chiaveEdge(a, b)) ||
    vistiEdge.has("g" + chiaveEdge(a, b)) ||
    vistiEdge.has("x" + chiaveEdge(a, b));
  for (const s of report.sorprendenti) {
    const na = normLabel(s.a);
    const nb = normLabel(s.b);
    const setA = multiPerNorm.get(na) ?? [];
    const setB = multiPerNorm.get(nb) ?? [];
    const coppie: Array<[number, number]> = [];
    if (na === nb) {
      // stessa label in punti diversi del vault: colleghiamo le occorrenze
      for (let i = 0; i < setA.length && coppie.length < 6; i++) {
        for (let j = i + 1; j < setA.length && coppie.length < 6; j++) {
          if (stars.rel[setA[i]] !== stars.rel[setA[j]]) coppie.push([setA[i], setA[j]]);
        }
      }
    } else {
      for (const a of setA.slice(0, 3)) {
        for (const b of setB.slice(0, 3)) {
          if (a !== b && coppie.length < 4) coppie.push([a, b]);
        }
      }
    }
    for (const [a, b] of coppie) {
      if (esisteEdge(a, b)) continue;
      vistiEdge.add("x" + chiaveEdge(a, b));
      edges.push({
        a,
        b,
        tipo: EDGE_TIPO.semantico,
        relazione: s.relazione,
        sorprendente: true,
      });
    }
  }

  /* ---- 11. god flag dal report (match esatto, poi fuzzy sulle note) ---- */
  for (const god of report.godNodes) {
    const godNorm = normLabel(god.label);
    let idx = perNorm.get(godNorm);
    if (idx == null) {
      let migliore: { idx: number; len: number } | null = null;
      for (const n of snap.notes) {
        const sIdx = starPerRel.get(n.rel);
        if (sIdx == null) continue;
        const candidati = [n.titolo, ...n.aliases].map(normLabel);
        for (const cand of candidati) {
          if (!cand) continue;
          if (cand.includes(godNorm) || godNorm.includes(cand)) {
            if (!migliore || cand.length > migliore.len) {
              migliore = { idx: sIdx, len: cand.length };
            }
          }
        }
      }
      idx = migliore?.idx;
    }
    if (idx != null) {
      god.star = idx;
      stars.flag[idx] |= FLAG.god;
      stars.size[idx] = Math.max(stars.size[idx], 3.4 + Math.min(1.6, god.edges / 30));
    }
  }

  const { vaultVersion } = await import("./watcher");
  return {
    versione: vaultVersion(),
    aree: AREE.map((a, i) => ({ ...a, indice: i })),
    tipi,
    stati,
    community: [...communityConteggio.entries()]
      .map(([id, c]) => ({ id, nome: c.nome, membri: c.membri }))
      .sort((x, y) => y.membri - x.membri),
    stars,
    edges,
    report,
    conteggi: {
      note: snap.notes.length,
      concetti: concetti.length,
      sezioni,
      gap: gapCount,
      documenti: documenti.length,
      edges: edges.length,
    },
    graphJsonTrovato: gjson != null,
  };
}

export const getGalaxy = memoPerVersione(costruisci);
