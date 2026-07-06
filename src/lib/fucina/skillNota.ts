/**
 * Il contratto della nota-skill (spec 2026-07-05): frontmatter = trigger e
 * stato, corpo = playbook per l'agente. Modulo puro: l'estensione .ts negli
 * import relativi serve al type-stripping di node --test.
 */
import matter from "gray-matter";
import { parseOgni } from "./scadenze.ts";

export type StatoSkill = "proposta" | "attiva" | "pausa";
export type TriggerSkill = "comando" | "ogni" | "evento";

export interface SkillDef {
  /** percorso relativo alla radice del vault */
  rel: string;
  /** nome file senza estensione */
  nome: string;
  stato: StatoSkill;
  trigger: TriggerSkill[];
  comando?: string;
  ogni?: string;
  evento?: "nuova-nota";
  dove?: string;
  /** nota del vault che la skill mantiene: Space la mostra inline nel pannello */
  output?: string;
  motivazione?: string;
  /** "YYYY-MM-DD HH:MM", scritta dal runtime */
  ultimaEsecuzione?: string;
  esito?: "ok" | "errore";
  corpo: string;
}

export interface SkillScartata {
  rel: string;
  motivo: string;
}

const STATI: StatoSkill[] = ["proposta", "attiva", "pausa"];
const TRIGGERS: TriggerSkill[] = ["comando", "ogni", "evento"];

export function parseSkillNota(
  raw: string,
  rel: string
): { skill?: SkillDef; scartata?: SkillScartata } {
  const scarta = (motivo: string) => ({ scartata: { rel, motivo } });
  let fm: Record<string, unknown>;
  let corpo: string;
  try {
    const m = matter(raw.replace(/\r\n?/g, "\n"));
    fm = m.data as Record<string, unknown>;
    corpo = m.content.trim();
  } catch {
    return scarta("frontmatter illeggibile");
  }
  if (fm.tipo !== "skill") return scarta("manca `tipo: skill`");
  const stato = String(fm.stato ?? "");
  if (!STATI.includes(stato as StatoSkill)) {
    return scarta("`stato` deve essere proposta, attiva o pausa");
  }
  const triggerRaw = Array.isArray(fm.trigger) ? fm.trigger : [fm.trigger];
  const trigger = triggerRaw.map(String) as TriggerSkill[];
  if (trigger.length === 0 || trigger.some((t) => !TRIGGERS.includes(t))) {
    return scarta("`trigger` deve essere comando, ogni o evento (o una lista)");
  }
  const comando = fm.comando != null ? String(fm.comando) : undefined;
  const ogni = fm.ogni != null ? String(fm.ogni) : undefined;
  const dove = fm.dove != null ? String(fm.dove) : undefined;
  const output =
    fm.output != null && String(fm.output).trim() ? String(fm.output).trim() : undefined;
  if (trigger.includes("comando")) {
    if (!comando || !/^[a-z0-9][a-z0-9-]*$/.test(comando)) {
      return scarta("trigger `comando` richiede uno slug (minuscole e trattini)");
    }
  }
  if (trigger.includes("ogni")) {
    if (!ogni || !parseOgni(ogni)) {
      return scarta('trigger `ogni` richiede "HH:MM" o "lun HH:MM"');
    }
  }
  if (trigger.includes("evento")) {
    if (fm.evento !== "nuova-nota") {
      return scarta("unico evento supportato: nuova-nota");
    }
    if (!dove) return scarta("trigger `evento` richiede `dove:` (prefisso cartella)");
  }
  if (!corpo) return scarta("playbook vuoto");
  const nome = rel.split("/").pop()!.replace(/\.md$/i, "");
  return {
    skill: {
      rel,
      nome,
      stato: stato as StatoSkill,
      trigger,
      comando,
      ogni,
      evento: trigger.includes("evento") ? "nuova-nota" : undefined,
      dove,
      output,
      motivazione: fm.motivazione != null ? String(fm.motivazione) : undefined,
      ultimaEsecuzione:
        fm["ultima-esecuzione"] != null ? String(fm["ultima-esecuzione"]) : undefined,
      esito: fm.esito === "ok" || fm.esito === "errore" ? fm.esito : undefined,
      corpo,
    },
  };
}

/** Riscrive solo i campi runtime nel frontmatter, preservando il resto. */
export function conEsito(
  raw: string,
  r: { quando: string; esito: "ok" | "errore" }
): string {
  const m = matter(raw.replace(/\r\n?/g, "\n"));
  const dati = { ...m.data, "ultima-esecuzione": r.quando, esito: r.esito };
  return matter.stringify(m.content, dati);
}

/** Cambia lo stato nel frontmatter (approvazione/pausa dal pannello). */
export function conStato(raw: string, stato: StatoSkill): string {
  const m = matter(raw.replace(/\r\n?/g, "\n"));
  return matter.stringify(m.content, { ...m.data, stato });
}
