"use client";

import { useUI } from "@/state/store";
import type { EventoAgente } from "@/lib/agent/sessione";

/**
 * Invia un comando all'agente e riversa gli eventi NDJSON nel feed della console.
 * Il vault si aggiorna da solo via watcher/SSE quando l'agente scrive.
 */
export async function inviaComando(testo: string, continua = true): Promise<void> {
  const ui = useUI.getState();
  if (ui.agenteInEsecuzione) return;
  ui.apriConsole();
  ui.pushFeed({ t: "comando", testo });
  ui.setAgenteInEsecuzione(true);

  try {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comando: testo,
        continua,
        modello: ui.modelloScelto ?? undefined,
      }),
    });

    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      useUI.getState().pushFeed({
        t: "errore",
        messaggio: (j as { errore?: string }).errore ?? `Errore ${res.status}`,
      });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const righe = buffer.split("\n");
      buffer = righe.pop() ?? "";
      for (const riga of righe) {
        if (!riga.trim()) continue;
        try {
          useUI.getState().pushFeed(JSON.parse(riga) as EventoAgente);
        } catch {
          // riga spezzata: ignora
        }
      }
    }
  } catch (e) {
    useUI.getState().pushFeed({
      t: "errore",
      messaggio: e instanceof Error ? e.message : "Connessione interrotta",
    });
  } finally {
    useUI.getState().setAgenteInEsecuzione(false);
  }
}

export async function rispondiPermesso(
  id: string,
  esito: "allow" | "deny",
  messaggio?: string
): Promise<void> {
  await fetch("/api/agent/permesso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, esito, messaggio }),
  }).catch(() => {});
}
