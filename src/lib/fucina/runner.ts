import fs from "node:fs/promises";
import path from "node:path";
import {
  agenteOccupato,
  eseguiComando,
  type EventoAgente,
} from "@/lib/agent/sessione";
import { skillsConfig, vaultPath } from "@/lib/vault/config";
import { conEsito, type SkillDef } from "./skillNota";
import { adessoStr } from "./scadenze";

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

/** Accoda un run. false = saltato (limite giornaliero o gia in coda). */
export function accodaRun(skill: SkillDef, origine: OrigineRun): boolean {
  const s = stato();
  resetSeNuovoGiorno(s);
  if (s.inEsecuzione === skill.rel || s.coda.some((r) => r.skill.rel === skill.rel)) {
    return false; // gia in corso o in attesa
  }
  if (origine !== "manuale" && s.runOggi + s.coda.length >= skillsConfig().maxRunGiorno) {
    s.saltatiOggi += 1;
    return false;
  }
  s.coda.push({ skill, origine });
  void lavora();
  return true;
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
