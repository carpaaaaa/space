import { NextRequest } from "next/server";
import { agenteOccupato, eseguiComando, ultimaSessione } from "@/lib/agent/sessione";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * POST { comando, continua?: boolean, modello?: string }
 * Risponde con NDJSON in streaming: un EventoAgente per riga.
 */
export async function POST(req: NextRequest) {
  const { comando, continua, modello } = (await req.json()) as {
    comando?: string;
    continua?: boolean;
    modello?: string;
  };
  if (!comando || !comando.trim()) {
    return Response.json({ errore: "Comando vuoto" }, { status: 400 });
  }
  if (agenteOccupato()) {
    return Response.json(
      { errore: "L'agente sta gia eseguendo un comando" },
      { status: 409 }
    );
  }
  const stream = eseguiComando({
    comando: comando.trim(),
    sessione: continua ? ultimaSessione() : null,
    modello,
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
