import fs from "node:fs/promises";
import path from "node:path";
import { skillsConfig, skillsDir } from "@/lib/vault/config";
import { onVaultEvent } from "@/lib/vault/watcher";
import { caricaSkills } from "@/lib/vault/skills";
import { daRieseguire } from "./scadenze";
import { accodaRun, runInCorso } from "./runner";
import { FUCINA_DEFAULT, NOME_FILE_FUCINA, SLUG_FUCINA } from "./fucinaSkillDefault";

/**
 * Il battito della fucina: un tick al minuto onora le scadenze `ogni`
 * (il primo tick dopo l'avvio fa da catch-up se space era chiuso),
 * il watcher del vault fa scattare le skill a evento, e al primo avvio
 * viene seminata la skill di sistema Fucina.
 */

const G = globalThis as unknown as { __fucinaScheduler?: { avviato: boolean } };
const DEBOUNCE_EVENTO_MS = 30_000;
// rel skill -> ts dell'ultimo trigger a evento (debounce per burst di file)
const ultimoEvento = new Map<string, number>();

async function bootstrapFucina(): Promise<void> {
  const { skills } = await caricaSkills();
  if (skills.some((s) => s.comando === SLUG_FUCINA)) return;
  const file = path.join(skillsDir(), NOME_FILE_FUCINA);
  try {
    await fs.access(file);
    return; // il file esiste ma non parsa: non sovrascrivere mai
  } catch {
    // assente: semina
  }
  await fs.mkdir(skillsDir(), { recursive: true });
  await fs.writeFile(file, FUCINA_DEFAULT, "utf8");
  console.log(`[fucina] skill di sistema creata: ${file}`);
}

async function tick(): Promise<void> {
  const adesso = new Date();
  const { skills } = await caricaSkills();
  for (const s of skills) {
    if (s.stato !== "attiva" || !s.trigger.includes("ogni")) continue;
    if (s.comando === SLUG_FUCINA && !skillsConfig().fucinaPeriodica) continue;
    if (daRieseguire(s, adesso)) accodaRun(s, "ogni");
  }
}

function agganciaEventi(): void {
  onVaultEvent((e) => {
    if (e.tipo !== "add" || !e.rel.endsWith(".md")) return;
    const rel = e.rel.split(path.sep).join("/");
    // guardie anti-loop: mai auto-trigger dalla cartella skills,
    // mai trigger dalle scritture di un run automatico in corso
    if (rel.startsWith(skillsConfig().cartella + "/")) return;
    if (runInCorso()) return;
    void caricaSkills().then(({ skills }) => {
      const adesso = Date.now();
      for (const s of skills) {
        if (s.stato !== "attiva" || !s.trigger.includes("evento") || !s.dove) continue;
        if (!rel.startsWith(s.dove)) continue;
        if (adesso - (ultimoEvento.get(s.rel) ?? 0) < DEBOUNCE_EVENTO_MS) continue;
        ultimoEvento.set(s.rel, adesso);
        accodaRun(s, "evento");
      }
    });
  });
}

export function avviaScheduler(): void {
  if (G.__fucinaScheduler?.avviato) return; // HMR o doppio register
  G.__fucinaScheduler = { avviato: true };
  void bootstrapFucina().catch((e) => console.error("[fucina] bootstrap:", e));
  agganciaEventi();
  const t = () => void tick().catch((e) => console.error("[fucina] tick:", e));
  setInterval(t, 60_000);
  // il primo tick poco dopo l'avvio e il catch-up delle scadenze perse
  setTimeout(t, 5_000);
  console.log("[fucina] scheduler avviato");
}
