import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/vault/notes";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await getSnapshot();
    return NextResponse.json(
      snap.notes.map((n) => ({
        rel: n.rel,
        titolo: n.titolo,
        areaKey: n.areaKey,
        tipo: n.tipo,
        stato: n.stato,
        creata: n.creata,
        aggiornata: n.aggiornata,
        estratto: n.estratto,
        parole: n.parole,
        nLink: n.wikilinks.length,
      }))
    );
  } catch (err) {
    return NextResponse.json(
      { errore: err instanceof Error ? err.message : "Errore notes" },
      { status: 500 }
    );
  }
}
