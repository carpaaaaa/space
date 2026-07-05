import fs from "node:fs/promises";
import path from "node:path";
import { skillsDir, vaultPath } from "./config";
import { memoPerVersione } from "./watcher";
import {
  parseSkillNota,
  type SkillDef,
  type SkillScartata,
} from "@/lib/fucina/skillNota";

/**
 * Lettura delle note-skill dalla cartella configurata del vault.
 * La cache si invalida da sola quando il vault cambia su disco.
 */

export interface ElencoSkills {
  skills: SkillDef[];
  scartate: SkillScartata[];
}

async function leggi(): Promise<ElencoSkills> {
  const dir = skillsDir();
  const root = vaultPath();
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
  } catch {
    return { skills: [], scartate: [] }; // cartella assente: nessuna skill
  }
  const skills: SkillDef[] = [];
  const scartate: SkillScartata[] = [];
  for (const f of files.sort()) {
    const assoluto = path.join(dir, f);
    const rel = path.relative(root, assoluto).split(path.sep).join("/");
    try {
      const raw = await fs.readFile(assoluto, "utf8");
      const r = parseSkillNota(raw, rel);
      if (r.skill) skills.push(r.skill);
      else if (r.scartata) scartate.push(r.scartata);
    } catch {
      scartate.push({ rel, motivo: "file illeggibile" });
    }
  }
  return { skills, scartate };
}

export const caricaSkills = memoPerVersione(leggi);

/** La skill attiva che risponde a /slug, se esiste. */
export async function skillPerComando(slug: string): Promise<SkillDef | null> {
  const { skills } = await caricaSkills();
  return (
    skills.find(
      (s) => s.stato === "attiva" && s.trigger.includes("comando") && s.comando === slug
    ) ?? null
  );
}
