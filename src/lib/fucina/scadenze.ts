/**
 * Calcolo delle scadenze `ogni` delle skill: "HH:MM" giornaliero oppure
 * "lun HH:MM" settimanale, in ora locale. Modulo puro: niente alias @/,
 * niente fs, importabile direttamente da node --test.
 */

const GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

export interface Ogni {
  /** 0 = domenica ... 6 = sabato; null = ogni giorno */
  giorno: number | null;
  ore: number;
  minuti: number;
}

export function parseOgni(testo: string): Ogni | null {
  const m = /^(?:([a-z]{3})\s+)?(\d{1,2}):(\d{2})$/.exec(testo.trim().toLowerCase());
  if (!m) return null;
  const giorno = m[1] ? GIORNI.indexOf(m[1]) : null;
  if (giorno === -1) return null;
  const ore = Number(m[2]);
  const minuti = Number(m[3]);
  if (ore > 23 || minuti > 59) return null;
  return { giorno, ore, minuti };
}

/** L'occorrenza piu recente <= riferimento (null se `ogni` e malformato). */
export function ultimaOccorrenza(ogni: string, riferimento: Date): Date | null {
  const o = parseOgni(ogni);
  if (!o) return null;
  const d = new Date(riferimento);
  d.setHours(o.ore, o.minuti, 0, 0);
  if (o.giorno == null) {
    if (d > riferimento) d.setDate(d.getDate() - 1);
    return d;
  }
  const indietro = (d.getDay() - o.giorno + 7) % 7;
  d.setDate(d.getDate() - indietro);
  if (d > riferimento) d.setDate(d.getDate() - 7);
  return d;
}

/** "YYYY-MM-DD HH:MM" -> Date locale (null se malformata). */
function parseQuando(s?: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

/**
 * true se la scadenza piu recente non e ancora stata onorata. Un'ultima
 * esecuzione assente o malformata conta come "mai girata": al primo tick
 * utile parte (e questo da gratis il catch-up all'avvio di space).
 */
export function daRieseguire(
  skill: { ogni?: string; ultimaEsecuzione?: string },
  adesso: Date
): boolean {
  if (!skill.ogni) return false;
  const scadenza = ultimaOccorrenza(skill.ogni, adesso);
  if (!scadenza) return false;
  const ultima = parseQuando(skill.ultimaEsecuzione);
  return !ultima || ultima < scadenza;
}

/** Timestamp runtime "YYYY-MM-DD HH:MM" in ora locale. */
export function adessoStr(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}
