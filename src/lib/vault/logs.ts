import { getSnapshot } from "./notes";
import { memoPerVersione } from "./watcher";

export interface LogEntry {
  data: string; // YYYY-MM-DD
  ora: string; // HH:MM
  azione: string; // create | update | ingest | decision | ...
  testo: string; // markdown con wikilink
}

export interface LogGiorno {
  data: string;
  rel: string;
  entries: LogEntry[];
}

const RE_ENTRY = /^\*\*(\d{1,2}:\d{2})\*\*\s*-\s*([\w-]+)\s*\|\s*(.+)$/;

async function costruisci(): Promise<LogGiorno[]> {
  const snap = await getSnapshot();
  const giorni: LogGiorno[] = [];
  for (const nota of snap.notes) {
    if (nota.areaKey !== "logs") continue;
    const data = nota.titolo; // Logs/YYYY-MM-DD.md
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    const body = snap.bodies.get(nota.rel) ?? "";
    const entries: LogEntry[] = [];
    for (const riga of body.split("\n")) {
      const m = RE_ENTRY.exec(riga.trim());
      if (m) entries.push({ data, ora: m[1], azione: m[2].toLowerCase(), testo: m[3] });
    }
    giorni.push({ data, rel: nota.rel, entries });
  }
  giorni.sort((a, b) => b.data.localeCompare(a.data));
  return giorni;
}

export const getLogs = memoPerVersione(costruisci);
