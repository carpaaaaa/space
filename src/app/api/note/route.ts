import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { vaultName, vaultPath } from "@/lib/vault/config";
import { getSnapshot, risolviWikilink } from "@/lib/vault/notes";
import { mdToHtml } from "@/lib/vault/markdown";
import { getGalaxy, KIND } from "@/lib/vault/graph";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const rel = req.nextUrl.searchParams.get("rel");
    const titolo = req.nextUrl.searchParams.get("titolo");
    const snap = await getSnapshot();

    let nota = rel ? snap.perRel.get(rel) : undefined;
    if (!nota && titolo) nota = risolviWikilink(snap, titolo);
    if (!nota) return NextResponse.json({ errore: "Nota non trovata" }, { status: 404 });

    // difesa da traversal: la nota deve stare dentro il vault
    const assoluto = path.resolve(vaultPath(), nota.rel);
    if (!assoluto.startsWith(vaultPath())) {
      return NextResponse.json({ errore: "Percorso non valido" }, { status: 400 });
    }

    const body = snap.bodies.get(nota.rel) ?? "";
    const html = await mdToHtml(body);

    const backlinks = snap.notes
      .filter((n) =>
        n.rel !== nota.rel &&
        n.wikilinks.some((w) => risolviWikilink(snap, w)?.rel === nota.rel)
      )
      .map((n) => ({ rel: n.rel, titolo: n.titolo, areaKey: n.areaKey }));

    const inUscita = nota.wikilinks
      .map((w) => risolviWikilink(snap, w))
      .filter((n): n is NonNullable<typeof n> => n != null && n.rel !== nota.rel)
      .map((n) => ({ rel: n.rel, titolo: n.titolo, areaKey: n.areaKey }));

    // vicini nella galassia: concetti estratti da questa nota + note collegate via grafo
    const galaxy = await getGalaxy();
    const concetti: string[] = [];
    const viciniSemantici = new Map<string, string>();
    const idxDellaNota = new Set<number>();
    galaxy.stars.rel.forEach((r, i) => {
      if (r === nota.rel && galaxy.stars.kind[i] === KIND.concetto) {
        idxDellaNota.add(i);
        concetti.push(galaxy.stars.label[i]);
      }
    });
    for (const e of galaxy.edges) {
      const dentro = idxDellaNota.has(e.a) ? e.a : idxDellaNota.has(e.b) ? e.b : null;
      if (dentro == null) continue;
      const altro = dentro === e.a ? e.b : e.a;
      const relAltro = galaxy.stars.rel[altro];
      if (relAltro && relAltro !== nota.rel) {
        viciniSemantici.set(relAltro, galaxy.stars.label[altro]);
      }
    }
    const vicini = [...viciniSemantici.keys()]
      .map((r) => snap.perRel.get(r))
      .filter((n): n is NonNullable<typeof n> => n != null)
      .filter((n) => !backlinks.some((b) => b.rel === n.rel) && !inUscita.some((o) => o.rel === n.rel))
      .slice(0, 12)
      .map((n) => ({ rel: n.rel, titolo: n.titolo, areaKey: n.areaKey }));

    const senzaMd = nota.rel.replace(/\.md$/, "");
    const obsidianUri = `obsidian://open?vault=${encodeURIComponent(
      vaultName()
    )}&file=${encodeURIComponent(senzaMd)}`;

    return NextResponse.json({
      meta: {
        rel: nota.rel,
        titolo: nota.titolo,
        areaKey: nota.areaKey,
        tipo: nota.tipo,
        stato: nota.stato,
        creata: nota.creata,
        aggiornata: nota.aggiornata,
        tags: nota.tags,
        parole: nota.parole,
      },
      html,
      backlinks,
      inUscita,
      vicini,
      concetti: concetti.slice(0, 24),
      obsidianUri,
    });
  } catch (err) {
    return NextResponse.json(
      { errore: err instanceof Error ? err.message : "Errore nota" },
      { status: 500 }
    );
  }
}
