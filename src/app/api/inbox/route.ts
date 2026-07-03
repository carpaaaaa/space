import { NextRequest, NextResponse } from "next/server";
import { quickCapture } from "@/lib/vault/scrivi";
import { getSnapshot } from "@/lib/vault/notes";
import { mdToHtml } from "@/lib/vault/markdown";

export const dynamic = "force-dynamic";

/** Contenuto corrente dell'inbox (Note da sistemare). */
export async function GET() {
  try {
    const snap = await getSnapshot();
    const rel = "00_INBOX/Note da sistemare.md";
    const body = snap.bodies.get(rel);
    if (body == null) {
      return NextResponse.json({ errore: "Inbox non trovata" }, { status: 404 });
    }
    return NextResponse.json({ rel, html: await mdToHtml(body), raw: body });
  } catch (err) {
    return NextResponse.json(
      { errore: err instanceof Error ? err.message : "Errore inbox" },
      { status: 500 }
    );
  }
}

/** Quick capture: appende un appunto grezzo (auto-save) e logga. */
export async function POST(req: NextRequest) {
  try {
    const { testo } = (await req.json()) as { testo?: string };
    if (!testo || !testo.trim()) {
      return NextResponse.json({ errore: "Testo vuoto" }, { status: 400 });
    }
    const esito = await quickCapture(testo);
    return NextResponse.json({ ok: true, ...esito });
  } catch (err) {
    return NextResponse.json(
      { errore: err instanceof Error ? err.message : "Errore capture" },
      { status: 500 }
    );
  }
}
