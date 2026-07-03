"use client";

import { TestataPannello, VuotoCaldo, useVaultJson } from "./comune";
import { useUI } from "@/state/store";

interface InboxDati {
  rel: string;
  html: string;
  raw: string;
}

export function PannelloInbox({
  onSmista,
  agentePronto = false,
}: {
  onSmista?: () => void;
  agentePronto?: boolean;
}) {
  const { dati, errore } = useVaultJson<InboxDati>("/api/inbox");
  const apriNota = useUI((s) => s.apriNota);

  // conta gli appunti grezzi (righe non vuote fuori dalle sezioni note)
  const daSmistare = (() => {
    if (!dati) return 0;
    const sez = dati.raw.split(/^## /m);
    let conta = 0;
    for (const blocco of sez) {
      if (blocco.startsWith("Note da sistemare")) {
        conta += blocco
          .split("\n")
          .slice(1)
          .filter((r) => r.trim() && !r.trim().startsWith("_Nessun appunto")).length;
      }
    }
    // appunti scritti sopra le sezioni (capture manuali di corsa)
    const primaParte = dati.raw.split(/^## /m)[0] ?? "";
    conta += primaParte
      .split("\n")
      .filter((r) => r.trim() && !r.startsWith("---") && !/^(tipo|area|creata|aggiornata|stato):/.test(r.trim()))
      .length;
    return conta;
  })();

  return (
    <div>
      <TestataPannello
        titolo="Inbox"
        sotto={
          daSmistare > 0
            ? `${daSmistare} appunti grezzi in attesa di una casa`
            : "Inbox pulita"
        }
        azioni={
          <button
            type="button"
            className="bottone-primario text-[12.5px]"
            disabled={!agentePronto || daSmistare === 0}
            onClick={onSmista}
            title={
              agentePronto
                ? "L'agente classifica gli appunti secondo le regole del vault"
                : "Disponibile quando il layer agente e attivo"
            }
          >
            Smista con l&apos;agente
          </button>
        }
      />
      {errore && <VuotoCaldo>{errore}</VuotoCaldo>}
      {dati && (
        <>
          <article
            className="prosa pannello-enter text-[14px]"
            dangerouslySetInnerHTML={{ __html: dati.html }}
          />
          <button
            type="button"
            onClick={() => apriNota(dati.rel)}
            className="mt-4 text-[12px] underline-offset-2 hover:underline"
            style={{ color: "var(--oro-2)" }}
          >
            Apri come nota
          </button>
        </>
      )}
    </div>
  );
}
