import fs from "node:fs/promises";
import path from "node:path";
import { vaultPath } from "./config";

/**
 * Scritture sul vault che rispettano le regole di _CLAUDE.md:
 * UTF-8 senza BOM, log append-only in Logs/YYYY-MM-DD.md nel formato
 * `**HH:MM** - action | descrizione`, frontmatter a chiavi italiane.
 */

function oggiISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function oraHM(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function scriviUtf8(assoluto: string, contenuto: string): Promise<void> {
  // Node scrive UTF-8 senza BOM di default; nessun BOM va mai aggiunto.
  await fs.writeFile(assoluto, contenuto, "utf8");
}

/** Append di una entry al log del giorno (creandolo se manca). */
export async function appendLog(azione: string, descrizione: string): Promise<string> {
  const data = oggiISO();
  const rel = `Logs/${data}.md`;
  const assoluto = path.join(vaultPath(), rel);
  let contenuto: string;
  try {
    contenuto = await fs.readFile(assoluto, "utf8");
    if (contenuto.charCodeAt(0) === 0xfeff) contenuto = contenuto.slice(1);
  } catch {
    contenuto = `---\ntipo: log\ncreata: ${data}\nai-first: true\n---\n\n# Log ${data}\n`;
  }
  if (!contenuto.endsWith("\n")) contenuto += "\n";
  contenuto += `**${oraHM()}** - ${azione} | ${descrizione}\n`;
  await fs.mkdir(path.dirname(assoluto), { recursive: true });
  await scriviUtf8(assoluto, contenuto);
  return rel;
}

/** Aggiorna `aggiornata:` nel frontmatter senza riformattare il resto. */
function aggiornaFrontmatterData(raw: string, data: string): string {
  const m = /^---\n([\s\S]*?)\n---/.exec(raw);
  if (!m) return raw;
  let fm = m[1];
  if (/^aggiornata:/m.test(fm)) {
    fm = fm.replace(/^aggiornata:.*$/m, `aggiornata: ${data}`);
  } else if (/^creata:/m.test(fm)) {
    fm = fm.replace(/^(creata:.*)$/m, `$1\naggiornata: ${data}`);
  } else {
    fm = fm + `\naggiornata: ${data}`;
  }
  return raw.slice(0, m.index) + `---\n${fm}\n---` + raw.slice(m.index + m[0].length);
}

/**
 * Quick capture: appende un appunto grezzo in `00_INBOX/Note da sistemare.md`
 * sotto `## Note da sistemare` (auto-save consentito dalle regole del vault)
 * e logga l'operazione.
 */
export async function quickCapture(testo: string): Promise<{ rel: string; log: string }> {
  const pulito = testo.trim().replace(/\r\n/g, "\n");
  if (!pulito) throw new Error("Testo vuoto");
  const rel = "00_INBOX/Note da sistemare.md";
  const assoluto = path.join(vaultPath(), rel);
  let raw = await fs.readFile(assoluto, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  const riga = "- " + pulito.split("\n").join(" ").trim();
  const heading = "## Note da sistemare";
  const idx = raw.indexOf(heading);
  if (idx === -1) {
    // fallback: sezione mancante, la creiamo in fondo
    if (!raw.endsWith("\n")) raw += "\n";
    raw += `\n${heading}\n\n${riga}\n`;
  } else {
    // fine della sezione = prossimo heading di pari livello o fine file
    const dopoHeading = idx + heading.length;
    const prossimo = raw.slice(dopoHeading).search(/\n## /);
    const fineSezione = prossimo === -1 ? raw.length : dopoHeading + prossimo;
    let sezione = raw.slice(dopoHeading, fineSezione);
    // il placeholder "nessun appunto" viene sostituito dal primo appunto vero
    sezione = sezione.replace(/_Nessun appunto da sistemare\._\s*/g, "");
    if (!sezione.endsWith("\n")) sezione += "\n";
    if (!/\n$/.test(sezione)) sezione += "\n";
    sezione = sezione.replace(/\n+$/, "\n") + riga + "\n";
    raw = raw.slice(0, dopoHeading) + sezione + raw.slice(fineSezione);
  }

  raw = aggiornaFrontmatterData(raw, oggiISO());
  await scriviUtf8(assoluto, raw);
  const breve = pulito.length > 90 ? pulito.slice(0, 87) + "..." : pulito;
  const log = await appendLog(
    "ingest",
    `Quick capture da NUCLEO in [[Note da sistemare]]: "${breve}"`
  );
  return { rel, log };
}
