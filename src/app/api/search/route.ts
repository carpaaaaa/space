import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { graphJsonPath, vaultPath } from "@/lib/vault/config";
import { getSnapshot, senzaCodeFence } from "@/lib/vault/notes";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

function graphifyBin(): string {
  return process.env.GRAPHIFY_BIN || "graphify";
}

async function graphify(args: string[]): Promise<{ testo: string } | { errore: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      graphifyBin(),
      [...args, "--graph", graphJsonPath()],
      { cwd: vaultPath(), timeout: 60_000, maxBuffer: 4 * 1024 * 1024 }
    );
    const testo = (stdout || "").trim() || (stderr || "").trim();
    return { testo: testo || "(nessun risultato)" };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    if (e.code === "ENOENT") {
      return { errore: "CLI graphify non trovata nel PATH (env GRAPHIFY_BIN per configurarla)" };
    }
    const out = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
    return out ? { testo: out } : { errore: e.message ?? "Errore graphify" };
  }
}

/** Ricerca locale su titoli, frontmatter e contenuto. */
async function ricercaLocale(q: string) {
  const snap = await getSnapshot();
  const query = q.toLowerCase();
  const parole = query.split(/\s+/).filter(Boolean);
  const risultati: Array<{
    rel: string;
    titolo: string;
    areaKey: string;
    tipo?: string;
    stato?: string;
    punteggio: number;
    estratto: string;
  }> = [];

  for (const n of snap.notes) {
    let punteggio = 0;
    const titolo = n.titolo.toLowerCase();
    if (titolo === query) punteggio += 100;
    else if (titolo.includes(query)) punteggio += 60;
    else if (parole.every((p) => titolo.includes(p))) punteggio += 40;

    const meta = [n.tipo, n.stato, ...n.tags].filter(Boolean).join(" ").toLowerCase();
    if (parole.some((p) => meta.includes(p))) punteggio += 15;

    const body = senzaCodeFence(snap.bodies.get(n.rel) ?? "").toLowerCase();
    let estratto = n.estratto;
    if (parole.length && parole.every((p) => body.includes(p))) {
      punteggio += 20;
      const pos = body.indexOf(parole[0]);
      if (pos >= 0) {
        const raw = (snap.bodies.get(n.rel) ?? "").slice(Math.max(0, pos - 60), pos + 160);
        estratto = raw.replace(/\s+/g, " ").trim();
      }
    }
    if (punteggio > 0) {
      risultati.push({
        rel: n.rel,
        titolo: n.titolo,
        areaKey: n.areaKey,
        tipo: n.tipo,
        stato: n.stato,
        punteggio,
        estratto,
      });
    }
  }
  risultati.sort((a, b) => b.punteggio - a.punteggio);
  return risultati.slice(0, 30);
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode = p.get("mode") ?? "local";
  const q = p.get("q") ?? "";
  try {
    if (mode === "local") {
      if (!q.trim()) return NextResponse.json([]);
      return NextResponse.json(await ricercaLocale(q));
    }
    if (mode === "graph") return NextResponse.json(await graphify(["query", q]));
    if (mode === "explain") return NextResponse.json(await graphify(["explain", q]));
    if (mode === "path") {
      const a = p.get("a") ?? "";
      const b = p.get("b") ?? "";
      if (!a || !b) {
        return NextResponse.json({ errore: "Servono i parametri a e b" }, { status: 400 });
      }
      return NextResponse.json(await graphify(["path", a, b]));
    }
    return NextResponse.json({ errore: "mode non valido" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { errore: err instanceof Error ? err.message : "Errore ricerca" },
      { status: 500 }
    );
  }
}
