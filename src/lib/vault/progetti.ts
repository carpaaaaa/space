import { AreaKey } from "./config";
import { getSnapshot, risolviWikilink, senzaCodeFence } from "./notes";
import { getTasks } from "./tasks";
import { memoPerVersione } from "./watcher";

export interface ProgettoScheda {
  rel: string;
  titolo: string;
  areaKey: AreaKey;
  stato?: string;
  creata?: string;
  aggiornata?: string;
  obiettivo?: string;
  statoTesto?: string;
  prossimeAzioni: string[];
  decisioni: string[];
  nTaskAperte: number;
  taskAperte: { testo: string; due?: string }[];
  vicini: { rel: string; titolo: string; areaKey: AreaKey }[];
}

/** Contenuto di una sezione `## <prefisso>...` fino al prossimo heading pari o superiore. */
function sezione(body: string, prefisso: string): string | null {
  const righe = senzaCodeFence(body).split("\n");
  const inizio = righe.findIndex((r) => {
    const m = /^(#{2,3})\s+(.+)$/.exec(r.trim());
    return m ? m[2].toLowerCase().startsWith(prefisso.toLowerCase()) : false;
  });
  if (inizio === -1) return null;
  const livello = (/^(#{2,3})/.exec(righe[inizio].trim())?.[1] ?? "##").length;
  const contenuto: string[] = [];
  for (let i = inizio + 1; i < righe.length; i++) {
    const m = /^(#{1,6})\s/.exec(righe[i].trim());
    if (m && m[1].length <= livello) break;
    contenuto.push(righe[i]);
  }
  return contenuto.join("\n").trim();
}

function pulisci(md: string): string {
  return md
    .replace(/\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\|([^\[\]]*))?\]\]/g, (_m, t, a) =>
      String(a || t).trim()
    )
    .replace(/[*_`]/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function vociLista(md: string | null, max: number, soloAperte = false): string[] {
  if (!md) return [];
  const voci: string[] = [];
  const taglia = (s: string) => (s.length > 180 ? s.slice(0, 177) + "..." : s);
  for (const riga of md.split("\n")) {
    const r = riga.trim();
    const task = /^[-*]\s+\[( |x|X)\]\s+(.+)$/.exec(r);
    if (task) {
      if (soloAperte && task[1] !== " ") continue;
      voci.push(taglia(pulisci(task[2])));
      continue;
    }
    if (soloAperte) continue;
    const punto = /^[-*]\s+(.+)$/.exec(r);
    if (punto) voci.push(taglia(pulisci(punto[1])));
  }
  return voci.filter(Boolean).slice(0, max);
}

function paragrafo(md: string | null, maxLen = 260): string | undefined {
  if (!md) return undefined;
  for (const blocco of md.split(/\n\s*\n/)) {
    const t = pulisci(blocco);
    if (t.length > 2) return t.length > maxLen ? t.slice(0, maxLen - 3) + "..." : t;
  }
  return undefined;
}

async function costruisci(): Promise<ProgettoScheda[]> {
  const snap = await getSnapshot();
  const tasks = await getTasks();
  const schede: ProgettoScheda[] = [];

  for (const nota of snap.notes) {
    const tipo = (nota.tipo ?? "").toLowerCase();
    if (tipo !== "progetto" && tipo !== "nota-progetto") continue;
    const body = snap.bodies.get(nota.rel) ?? "";

    const taskNota = tasks.tutteAperte.filter((t) => t.notaRel === nota.rel);

    // vicini: wikilink in uscita + backlink (solo conoscenza, niente logs/sistema)
    const rumore = (n: { areaKey: string }) =>
      n.areaKey === "logs" || n.areaKey === "sistema";
    const visti = new Set<string>([nota.rel]);
    const vicini: ProgettoScheda["vicini"] = [];
    for (const w of nota.wikilinks) {
      const dest = risolviWikilink(snap, w);
      if (dest && !visti.has(dest.rel) && !rumore(dest)) {
        visti.add(dest.rel);
        vicini.push({ rel: dest.rel, titolo: dest.titolo, areaKey: dest.areaKey });
      }
    }
    for (const altra of snap.notes) {
      if (visti.has(altra.rel) || rumore(altra)) continue;
      if (altra.wikilinks.some((w) => risolviWikilink(snap, w)?.rel === nota.rel)) {
        visti.add(altra.rel);
        vicini.push({ rel: altra.rel, titolo: altra.titolo, areaKey: altra.areaKey });
      }
    }

    schede.push({
      rel: nota.rel,
      titolo: nota.titolo,
      areaKey: nota.areaKey,
      stato: nota.stato,
      creata: nota.creata,
      aggiornata: nota.aggiornata,
      obiettivo: paragrafo(sezione(body, "Obiettivo")),
      statoTesto: paragrafo(sezione(body, "Stato")),
      prossimeAzioni: vociLista(sezione(body, "Prossime azioni"), 5),
      decisioni: vociLista(sezione(body, "Decisioni"), 3),
      nTaskAperte: taskNota.length,
      taskAperte: taskNota.slice(0, 4).map((t) => ({ testo: t.testo, due: t.due })),
      vicini: vicini.slice(0, 8),
    });
  }

  const pesoStato = (s?: string) =>
    s === "attivo" ? 0 : s === "planning" ? 1 : s === "on-hold" ? 2 : 3;
  schede.sort(
    (a, b) =>
      pesoStato(a.stato) - pesoStato(b.stato) ||
      (b.aggiornata ?? b.creata ?? "").localeCompare(a.aggiornata ?? a.creata ?? "")
  );
  return schede;
}

export const getProgetti = memoPerVersione(costruisci);
