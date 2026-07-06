import fs from "node:fs/promises";
import path from "node:path";
import {
  agenteOccupato,
  eseguiComando,
  type EventoAgente,
} from "@/lib/agent/sessione";
import { skillsConfig, skillsDir, vaultPath } from "@/lib/vault/config";
import { conEsito, conStato, parseSkillNota, type SkillDef } from "./skillNota";
import { adessoStr } from "./scadenze";
import { SLUG_FUCINA } from "./fucinaSkillDefault";

/**
 * Esegue le skill senza utente davanti: coda FIFO, un run alla volta,
 * precedenza ai comandi manuali, esito scritto nel frontmatter della nota
 * (lo scrive il server direttamente, fuori dal perimetro dell'agente).
 */

export type OrigineRun = "ogni" | "evento" | "manuale";

interface RunInCoda {
  skill: SkillDef;
  origine: OrigineRun;
}

interface StatoRunner {
  coda: RunInCoda[];
  /** rel della skill in esecuzione, o null */
  inEsecuzione: string | null;
  /** "YYYY-MM-DD" a cui si riferiscono i contatori */
  giorno: string;
  runOggi: number;
  saltatiOggi: number;
  /** worker loop gia avviato */
  attivo: boolean;
}

// Singleton su globalThis: sopravvive all'HMR di Next in dev.
const G = globalThis as unknown as { __fucinaRunner?: StatoRunner };

function stato(): StatoRunner {
  if (!G.__fucinaRunner) {
    G.__fucinaRunner = {
      coda: [],
      inEsecuzione: null,
      giorno: adessoStr().slice(0, 10),
      runOggi: 0,
      saltatiOggi: 0,
      attivo: false,
    };
  }
  return G.__fucinaRunner;
}

/** true mentre un run automatico e in corso (guardia anti-loop del watcher). */
export function runInCorso(): boolean {
  return stato().inEsecuzione != null;
}

export function statoRunner(): {
  inEsecuzione: string | null;
  inCoda: number;
  runOggi: number;
  saltatiOggi: number;
} {
  const s = stato();
  resetSeNuovoGiorno(s);
  return {
    inEsecuzione: s.inEsecuzione,
    inCoda: s.coda.length,
    runOggi: s.runOggi,
    saltatiOggi: s.saltatiOggi,
  };
}

function resetSeNuovoGiorno(s: StatoRunner): void {
  const oggi = adessoStr().slice(0, 10);
  if (s.giorno !== oggi) {
    s.giorno = oggi;
    s.runOggi = 0;
    s.saltatiOggi = 0;
  }
}

export interface EsitoAccoda {
  accodato: boolean;
  /** messaggio leggibile per la UI (perche' e' stato accodato o no) */
  motivo: string;
}

/** Accoda un run e spiega l'esito (per un feedback onesto nella UI). */
export function accodaRun(skill: SkillDef, origine: OrigineRun): EsitoAccoda {
  const s = stato();
  resetSeNuovoGiorno(s);
  if (s.inEsecuzione === skill.rel) {
    return { accodato: false, motivo: "già in esecuzione" };
  }
  if (s.coda.some((r) => r.skill.rel === skill.rel)) {
    return { accodato: false, motivo: "già in coda" };
  }
  if (origine !== "manuale" && s.runOggi + s.coda.length >= skillsConfig().maxRunGiorno) {
    s.saltatiOggi += 1;
    return { accodato: false, motivo: "limite giornaliero raggiunto" };
  }
  s.coda.push({ skill, origine });
  void lavora();
  return { accodato: true, motivo: s.inEsecuzione ? "in coda" : "in esecuzione" };
}

async function mtimeSkills(): Promise<Map<string, number>> {
  const dir = skillsDir();
  const mappa = new Map<string, number>();
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
    for (const f of files) {
      try {
        mappa.set(f, (await fs.stat(path.join(dir, f))).mtimeMs);
      } catch {
        // sparito tra readdir e stat: ignora
      }
    }
  } catch {
    // cartella assente
  }
  return mappa;
}

/**
 * Rete di sicurezza indipendente dal modello: l'osservatorio puo' SOLO
 * proporre. Qualsiasi nota nuova o modificata nella cartella skills durante
 * il suo run (tranne la sua stessa nota) che non abbia stato "proposta"
 * viene forzata a "proposta". Cosi', anche se il modello sbaglia scrivendo
 * un altro stato, nessuna automazione parte senza approvazione esplicita.
 */
async function blindaProposteOsservatorio(
  prima: Map<string, number>,
  relOsservatorio: string
): Promise<void> {
  const dir = skillsDir();
  const root = vaultPath();
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
  } catch {
    return;
  }
  for (const f of files) {
    const assoluto = path.join(dir, f);
    const rel = path.relative(root, assoluto).split(path.sep).join("/");
    if (rel === relOsservatorio) continue;
    let mtime: number;
    try {
      mtime = (await fs.stat(assoluto)).mtimeMs;
    } catch {
      continue;
    }
    const mtimePrima = prima.get(f);
    if (mtimePrima != null && mtime <= mtimePrima) continue; // non toccata in questo run
    try {
      const raw = await fs.readFile(assoluto, "utf8");
      const parsed = parseSkillNota(raw, rel);
      if (parsed.skill && parsed.skill.stato !== "proposta") {
        await fs.writeFile(assoluto, conStato(raw, "proposta"), "utf8");
        console.warn(
          `[fucina] "${parsed.skill.nome}" creata/modificata dall'osservatorio con stato ` +
            `"${parsed.skill.stato}": forzata a "proposta" (l'osservatorio non attiva mai da solo)`
        );
      }
    } catch (e) {
      console.error(`[fucina] blindatura fallita su ${rel}:`, e);
    }
  }
}

async function scriviEsito(rel: string, esito: "ok" | "errore"): Promise<void> {
  const assoluto = path.join(vaultPath(), rel);
  try {
    const raw = await fs.readFile(assoluto, "utf8");
    await fs.writeFile(assoluto, conEsito(raw, { quando: adessoStr(), esito }), "utf8");
  } catch (e) {
    // nota sparita o illeggibile: l'esito resta almeno nel log del server
    console.error(`[fucina] esito non scrivibile su ${rel}:`, e);
  }
}

async function eseguiUno(run: RunInCoda): Promise<void> {
  const s = stato();
  s.inEsecuzione = run.skill.rel;
  s.runOggi += 1;
  console.log(`[fucina] run ${run.origine}: ${run.skill.nome}`);
  // l'osservatorio puo' creare skill: fotografia "prima" per la blindatura
  const eOsservatorio = run.skill.comando === SLUG_FUCINA;
  const mtimePrima = eOsservatorio ? await mtimeSkills() : null;
  let ok = false;
  try {
    const prompt =
      `Esegui questa skill del vault (origine: ${run.origine}; nessun utente presente: ` +
      `niente domande, fai le scelte ragionevoli e registra nel log come da regole).\n\n` +
      run.skill.corpo;
    const stream = eseguiComando({ comando: prompt, unattended: true });
    const reader = stream.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const riga = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (!riga.trim()) continue;
        try {
          const e = JSON.parse(riga) as EventoAgente;
          if (e.t === "fine") ok = e.ok;
          if (e.t === "errore") console.error(`[fucina] ${run.skill.nome}:`, e.messaggio);
        } catch {
          // riga non-JSON: ignora
        }
      }
    }
  } catch (e) {
    console.error(`[fucina] run fallito ${run.skill.nome}:`, e);
    ok = false;
  } finally {
    if (eOsservatorio && mtimePrima) {
      await blindaProposteOsservatorio(mtimePrima, run.skill.rel);
    }
    await scriviEsito(run.skill.rel, ok ? "ok" : "errore");
    s.inEsecuzione = null;
    console.log(`[fucina] fine ${run.skill.nome}: ${ok ? "ok" : "errore"}`);
  }
}

async function lavora(): Promise<void> {
  const s = stato();
  if (s.attivo) return;
  s.attivo = true;
  try {
    while (s.coda.length > 0) {
      // precedenza all'utente: se l'agente sta servendo un comando manuale, aspetta
      if (agenteOccupato()) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      const run = s.coda.shift()!;
      await eseguiUno(run);
    }
  } finally {
    s.attivo = false;
  }
}
