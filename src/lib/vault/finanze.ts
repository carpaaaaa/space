import { getSnapshot } from "./notes";
import { memoPerVersione } from "./watcher";

/** Importo con valuta separata: le valute non si sommano mai tra loro. */
export interface Importo {
  valore: number;
  valuta: string;
}

export interface RigaRicorrente {
  voce: string;
  importo?: Importo;
  frequenza?: string;
  mensile?: Importo;
  note?: string;
}

export interface SpesaVariabile {
  data: string;
  categoria: string;
  descrizione: string;
  importo?: Importo;
  metodo?: string;
  note?: string;
  entrata: boolean;
}

export interface MeseRiepilogo {
  mese: string; // YYYY-MM
  totale: Record<string, number>; // per valuta (solo spese)
  perCategoria: Record<string, Record<string, number>>;
  entrate: Record<string, number>;
}

export interface CryptoAsset {
  asset: string;
  quantita?: number;
  costo?: Importo;
  note?: string;
}

export interface FinanzeData {
  trovato: boolean;
  abbonamenti: {
    rel?: string;
    aggiornata?: string;
    entrate: RigaRicorrente[];
    spese: RigaRicorrente[];
    totaleMensile: Record<string, number>;
    entrateMensili: Record<string, number>;
    margineMensile: Record<string, number>;
    note: string[];
  };
  variabili: {
    rel?: string;
    registro: SpesaVariabile[];
    mesi: MeseRiepilogo[];
  };
  crypto: {
    rel?: string;
    snapshotData?: string;
    assets: CryptoAsset[];
  };
}

const RE_IMPORTO = /(-?\d[\d'.,]*)\s*(CHF|EUR|USD|USDT|GBP)/;

export function parseImporto(cella: string): Importo | undefined {
  const m = RE_IMPORTO.exec(cella);
  if (!m) return undefined;
  const numero = m[1].replace(/'/g, "").replace(/,(?=\d{3}\b)/g, "");
  const valore = Number.parseFloat(numero);
  if (Number.isNaN(valore)) return undefined;
  return { valore, valuta: m[2] };
}

interface Tabella {
  headers: string[];
  righe: string[][];
}

/** Estrae le tabelle markdown di una sezione (## Titolo ... fino al prossimo ##). */
function tabelleDellaSezione(body: string, titoloSezione: string): Tabella[] {
  const righe = body.split("\n");
  const inizio = righe.findIndex((r) =>
    r.replace(/^#+\s*/, "").trim().toLowerCase().startsWith(titoloSezione.toLowerCase())
  );
  if (inizio === -1) return [];
  const tabelle: Tabella[] = [];
  let corrente: string[][] = [];
  for (let i = inizio + 1; i < righe.length; i++) {
    const r = righe[i].trim();
    if (/^#{1,6}\s/.test(r)) break;
    if (r.startsWith("|")) {
      const celle = r
        .slice(1, r.endsWith("|") ? -1 : undefined)
        .split("|")
        .map((c) => c.trim());
      if (celle.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separatore
      corrente.push(celle);
    } else if (corrente.length) {
      tabelle.push({ headers: corrente[0], righe: corrente.slice(1) });
      corrente = [];
    }
  }
  if (corrente.length) tabelle.push({ headers: corrente[0], righe: corrente.slice(1) });
  return tabelle;
}

function somma(acc: Record<string, number>, imp?: Importo, segno = 1) {
  if (!imp) return;
  acc[imp.valuta] = Math.round(((acc[imp.valuta] ?? 0) + segno * imp.valore) * 100) / 100;
}

async function costruisci(): Promise<FinanzeData> {
  const snap = await getSnapshot();
  const dati: FinanzeData = {
    trovato: false,
    abbonamenti: {
      entrate: [],
      spese: [],
      totaleMensile: {},
      entrateMensili: {},
      margineMensile: {},
      note: [],
    },
    variabili: { registro: [], mesi: [] },
    crypto: { assets: [] },
  };

  // --- Abbonamenti e spese ricorrenti ---
  const notaAbb = snap.notes.find(
    (n) => n.areaKey === "finanze" && n.titolo.toLowerCase().startsWith("abbonamenti")
  );
  if (notaAbb) {
    dati.trovato = true;
    dati.abbonamenti.rel = notaAbb.rel;
    dati.abbonamenti.aggiornata = notaAbb.aggiornata ?? notaAbb.creata;
    const body = snap.bodies.get(notaAbb.rel) ?? "";

    for (const t of tabelleDellaSezione(body, "Entrate")) {
      for (const r of t.righe) {
        const riga: RigaRicorrente = {
          voce: r[0] ?? "",
          importo: parseImporto(r[1] ?? ""),
          frequenza: r[2],
          note: r[3],
        };
        dati.abbonamenti.entrate.push(riga);
        somma(dati.abbonamenti.entrateMensili, riga.importo);
      }
    }
    for (const t of tabelleDellaSezione(body, "Spese ricorrenti")) {
      for (const r of t.righe) {
        const riga: RigaRicorrente = {
          voce: r[0] ?? "",
          importo: parseImporto(r[1] ?? ""),
          frequenza: r[2],
          mensile: parseImporto(r[3] ?? ""),
          note: r[4],
        };
        dati.abbonamenti.spese.push(riga);
        somma(dati.abbonamenti.totaleMensile, riga.mensile ?? riga.importo);
      }
    }
    for (const [valuta, entrata] of Object.entries(dati.abbonamenti.entrateMensili)) {
      dati.abbonamenti.margineMensile[valuta] =
        Math.round((entrata - (dati.abbonamenti.totaleMensile[valuta] ?? 0)) * 100) / 100;
    }
    const mNote = /## Note\n([\s\S]*?)(?=\n## |$)/.exec(body);
    if (mNote) {
      dati.abbonamenti.note = mNote[1]
        .split("\n")
        .map((r) => r.replace(/^-\s*/, "").trim())
        .filter(Boolean);
    }
  }

  // --- Spese variabili ---
  const notaVar = snap.notes.find(
    (n) => n.areaKey === "finanze" && n.titolo.toLowerCase().startsWith("spese variabili")
  );
  if (notaVar) {
    dati.trovato = true;
    dati.variabili.rel = notaVar.rel;
    const body = snap.bodies.get(notaVar.rel) ?? "";
    for (const t of tabelleDellaSezione(body, "Registro")) {
      for (const r of t.righe) {
        if (r.length < 4) continue;
        const importo = parseImporto(r[3] ?? "");
        const categoria = r[1] ?? "";
        dati.variabili.registro.push({
          data: r[0] ?? "",
          categoria,
          descrizione: r[2] ?? "",
          importo,
          metodo: r[4],
          note: r[5],
          entrata:
            categoria.toLowerCase() === "entrata" || (importo ? importo.valore < 0 : false),
        });
      }
    }
    // riepilogo mensile calcolato dal registro, valute separate
    const perMese = new Map<string, MeseRiepilogo>();
    for (const s of dati.variabili.registro) {
      const mese = s.data.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(mese)) continue;
      const m =
        perMese.get(mese) ??
        ({ mese, totale: {}, perCategoria: {}, entrate: {} } as MeseRiepilogo);
      perMese.set(mese, m);
      if (s.entrata) {
        somma(m.entrate, s.importo, -1); // le entrate sono negative nel registro
      } else {
        somma(m.totale, s.importo);
        m.perCategoria[s.categoria] ??= {};
        somma(m.perCategoria[s.categoria], s.importo);
      }
    }
    dati.variabili.mesi = [...perMese.values()].sort((a, b) => a.mese.localeCompare(b.mese));
  }

  // --- Portfolio crypto ---
  const notaCry = snap.notes.find(
    (n) => n.areaKey === "finanze" && n.titolo.toLowerCase().startsWith("portfolio crypto")
  );
  if (notaCry) {
    dati.trovato = true;
    dati.crypto.rel = notaCry.rel;
    const body = snap.bodies.get(notaCry.rel) ?? "";
    const mData = /Data snapshot:\s*(\d{4}-\d{2}-\d{2})/.exec(body);
    if (mData) dati.crypto.snapshotData = mData[1];
    for (const t of tabelleDellaSezione(body, "Snapshot attuale")) {
      for (const r of t.righe) {
        const quantita = Number.parseFloat((r[1] ?? "").replace(/'/g, ""));
        const costoNum = Number.parseFloat((r[2] ?? "").replace(/'/g, ""));
        dati.crypto.assets.push({
          asset: r[0] ?? "",
          quantita: Number.isNaN(quantita) ? undefined : quantita,
          costo: Number.isNaN(costoNum) ? undefined : { valore: costoNum, valuta: r[3] ?? "" },
          note: r[4],
        });
      }
    }
  }

  return dati;
}

export const getFinanze = memoPerVersione(costruisci);
