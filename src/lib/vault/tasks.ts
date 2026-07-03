import { AreaKey, areaPerKey } from "./config";
import { NotaMeta, getSnapshot, senzaCodeFence } from "./notes";
import { memoPerVersione } from "./watcher";

export interface TaskItem {
  /** Testo senza i metadati del plugin Tasks. */
  testo: string;
  completata: boolean;
  due?: string;
  fatta?: string;
  /** 0 = nessuna, 1 lowest ... 5 highest (emoji del plugin Tasks) */
  priorita: number;
  tags: string[];
  notaRel: string;
  notaTitolo: string;
  areaKey: AreaKey;
}

export interface TaskBuckets {
  scadute: TaskItem[];
  oggi: TaskItem[];
  prossimi7: TaskItem[];
  senzaData: TaskItem[];
  tutteAperte: TaskItem[];
  completateRecenti: TaskItem[];
  perArea: Partial<Record<AreaKey, TaskItem[]>>;
  oggiISO: string;
}

const RE_TASK = /^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/;
const RE_DUE = /📅\s*(\d{4}-\d{2}-\d{2})/;
const RE_DONE = /✅\s*(\d{4}-\d{2}-\d{2})/;
const RE_TAG = /#[\p{L}\p{N}_\/-]+/gu;
const PRIORITA: Array<[string, number]> = [
  ["🔺", 5],
  ["⏫", 4],
  ["🔼", 3],
  ["🔽", 2],
  ["⏬", 1],
];

function pulisciTesto(raw: string): string {
  let t = raw;
  t = t.replace(RE_DUE, "").replace(RE_DONE, "");
  t = t.replace(/[⏳🛫]\s*\d{4}-\d{2}-\d{2}/gu, "");
  t = t.replace(/🔁\s*[^📅✅⏳🛫#]*/gu, "");
  for (const [emoji] of PRIORITA) t = t.replaceAll(emoji, "");
  // wikilink e enfasi diventano testo semplice nella UI
  t = t.replace(/\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\|([^\[\]]*))?\]\]/g, (_m, target, alias) =>
    String(alias || target).trim()
  );
  t = t.replace(/\*\*/g, "");
  return t.replace(/\s{2,}/g, " ").trim();
}

function parseTask(riga: string, nota: NotaMeta): TaskItem | null {
  const m = RE_TASK.exec(riga);
  if (!m) return null;
  const corpo = m[2];
  let priorita = 0;
  for (const [emoji, val] of PRIORITA) {
    if (corpo.includes(emoji)) {
      priorita = val;
      break;
    }
  }
  return {
    testo: pulisciTesto(corpo),
    completata: m[1] !== " ",
    due: RE_DUE.exec(corpo)?.[1],
    fatta: RE_DONE.exec(corpo)?.[1],
    priorita,
    tags: corpo.match(RE_TAG) ?? [],
    notaRel: nota.rel,
    notaTitolo: nota.titolo,
    areaKey: nota.areaKey,
  };
}

function isoOggi(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoTraGiorni(giorni: number): string {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parsing puro delle task (memoizzato sulla versione del vault). */
async function parseTutte(): Promise<TaskItem[]> {
  const snap = await getSnapshot();
  const tutte: TaskItem[] = [];
  for (const nota of snap.notes) {
    // i registri (log) non sono liste operative
    if (areaPerKey(nota.areaKey).polvere && /log/i.test(nota.areaKey)) continue;
    const body = snap.bodies.get(nota.rel);
    if (!body) continue;
    for (const riga of senzaCodeFence(body).split("\n")) {
      const t = parseTask(riga, nota);
      if (t && t.testo) tutte.push(t);
    }
  }
  return tutte;
}

const getTutteMemo = memoPerVersione(parseTutte);

/**
 * Bucket calcolati a ogni richiesta con la data DI OGGI: se il vault non
 * cambia per giorni, "scadute/oggi/prossimi 7" restano comunque corretti.
 */
async function costruisci(): Promise<TaskBuckets> {
  const tutte = await getTutteMemo();

  const oggi = isoOggi();
  const limite7 = isoTraGiorni(7);
  const aperte = tutte.filter((t) => !t.completata);
  const perDue = (a: TaskItem, b: TaskItem) =>
    (a.due ?? "9999").localeCompare(b.due ?? "9999") || b.priorita - a.priorita;

  const buckets: TaskBuckets = {
    scadute: aperte.filter((t) => t.due && t.due < oggi).sort(perDue),
    oggi: aperte.filter((t) => t.due === oggi).sort((a, b) => b.priorita - a.priorita),
    prossimi7: aperte.filter((t) => t.due && t.due > oggi && t.due <= limite7).sort(perDue),
    senzaData: aperte
      .filter((t) => !t.due)
      .sort((a, b) => a.notaRel.localeCompare(b.notaRel, "it")),
    tutteAperte: aperte.sort(perDue),
    completateRecenti: tutte
      .filter((t) => t.completata)
      .sort((a, b) => (b.fatta ?? "").localeCompare(a.fatta ?? ""))
      .slice(0, 20),
    perArea: {},
    oggiISO: oggi,
  };
  for (const t of aperte) {
    (buckets.perArea[t.areaKey] ??= []).push(t);
  }
  return buckets;
}

export const getTasks = costruisci;
