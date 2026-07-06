import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { vaultPath } from "@/lib/vault/config";
import { caricaSkills } from "@/lib/vault/skills";
import { conStato } from "@/lib/fucina/skillNota";
import { accodaRun, statoRunner } from "@/lib/fucina/runner";

export const dynamic = "force-dynamic";

/** GET: elenco skill del vault (senza corpo integrale) + scartate + runner. */
export async function GET() {
  const { skills, scartate } = await caricaSkills();
  return Response.json({
    skills: skills.map(({ corpo, ...resto }) => ({
      ...resto,
      estratto: corpo.slice(0, 200),
    })),
    scartate,
    runner: statoRunner(),
  });
}

/**
 * POST { azione: "stato", rel, stato } — approva/pausa una skill
 * POST { azione: "esegui", rel }      — la accoda subito (run unattended)
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    azione?: "stato" | "esegui";
    rel?: string;
    stato?: "proposta" | "attiva" | "pausa";
  };
  const { skills } = await caricaSkills();
  const skill = skills.find((s) => s.rel === body.rel);
  if (!skill) {
    return Response.json({ errore: "Skill non trovata" }, { status: 404 });
  }

  if (body.azione === "stato") {
    if (!body.stato || !["proposta", "attiva", "pausa"].includes(body.stato)) {
      return Response.json({ errore: "Stato non valido" }, { status: 400 });
    }
    const assoluto = path.join(vaultPath(), skill.rel);
    const raw = await fs.readFile(assoluto, "utf8");
    await fs.writeFile(assoluto, conStato(raw, body.stato), "utf8");
    return Response.json({ ok: true });
  }

  if (body.azione === "esegui") {
    const esito = accodaRun(skill, "manuale");
    return Response.json({ ok: esito.accodato, motivo: esito.motivo, runner: statoRunner() });
  }

  return Response.json({ errore: "Azione sconosciuta" }, { status: 400 });
}
