import { NextRequest, NextResponse } from "next/server";
import { risolviPermesso } from "@/lib/agent/sessione";

export const dynamic = "force-dynamic";

/** POST { id, esito: "allow" | "deny", messaggio? } */
export async function POST(req: NextRequest) {
  const { id, esito, messaggio } = (await req.json()) as {
    id?: string;
    esito?: "allow" | "deny";
    messaggio?: string;
  };
  if (!id || (esito !== "allow" && esito !== "deny")) {
    return NextResponse.json({ errore: "Richiesta non valida" }, { status: 400 });
  }
  const trovato = risolviPermesso(id, esito, messaggio);
  if (!trovato) {
    return NextResponse.json({ errore: "Permesso non in attesa" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
