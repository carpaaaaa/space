"use client";

import { useEffect, useMemo, useRef } from "react";
import { useUI, type EventoConsole } from "@/state/store";
import { rispondiPermesso } from "@/lib/agenteClient";
import type { RigaDiff } from "@/lib/agent/sessione";

function Diff({ righe }: { righe: RigaDiff[] }) {
  return (
    <pre
      className="mono mt-2 max-h-[240px] overflow-auto rounded-md border p-2 text-[11px] leading-relaxed"
      style={{ borderColor: "var(--linea)", background: "var(--fondo-2)" }}
    >
      {righe.map((r, i) => (
        <div
          key={i}
          style={{
            color:
              r.k === "+" ? "var(--ok)" : r.k === "-" ? "var(--errore)" : "var(--inchiostro-3)",
            background:
              r.k === "+"
                ? "rgba(125,157,120,.08)"
                : r.k === "-"
                  ? "rgba(201,106,90,.08)"
                  : "transparent",
          }}
        >
          {r.k} {r.testo || " "}
        </div>
      ))}
    </pre>
  );
}

function Evento({ e, decisioni }: { e: EventoConsole; decisioni: Map<string, "allow" | "deny"> }) {
  switch (e.t) {
    case "comando":
      return (
        <div className="mt-3 flex items-baseline gap-2">
          <span aria-hidden className="text-[12px]" style={{ color: "var(--oro-2)" }}>
            ✦
          </span>
          <p className="text-[13.5px] font-medium">{e.testo}</p>
        </div>
      );
    case "init":
      return (
        <p className="mono mt-1 text-[10.5px]" style={{ color: "var(--inchiostro-3)" }}>
          agente attivo · {e.modello}
        </p>
      );
    case "testo":
      return (
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: "var(--inchiostro)" }}>
          {e.testo}
        </p>
      );
    case "tool":
      return (
        <p className="mono mt-1.5 text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
          {e.nome.toLowerCase()} {e.descr && <span style={{ color: "var(--inchiostro-2)" }}>{e.descr}</span>}
        </p>
      );
    case "scrittura":
      return (
        <p className="mono mt-1.5 text-[11.5px]" style={{ color: "var(--ok)" }}>
          {e.azione === "crea" ? "creata" : "aggiornata"} {e.percorso}
        </p>
      );
    case "permesso": {
      const decisione = decisioni.get(e.id);
      return (
        <div
          className="mt-2.5 rounded-lg border p-3"
          style={{ borderColor: "var(--linea-forte)", background: "var(--superficie-2)" }}
        >
          <p className="text-[13px] font-semibold" style={{ color: "var(--oro)" }}>
            Serve conferma: {e.titolo}
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--inchiostro-2)" }}>
            {e.motivo}
          </p>
          <Diff righe={e.diff} />
          {decisione == null ? (
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                className="bottone-primario text-[12.5px]"
                onClick={() => rispondiPermesso(e.id, "allow")}
              >
                Approva
              </button>
              <button
                type="button"
                className="bottone-secondario text-[12.5px]"
                onClick={() => rispondiPermesso(e.id, "deny", "L'utente ha negato dalla console NUCLEO")}
              >
                Nega
              </button>
            </div>
          ) : (
            <p
              className="mono mt-2 text-[11px]"
              style={{ color: decisione === "allow" ? "var(--ok)" : "var(--errore)" }}
            >
              {decisione === "allow" ? "approvata" : "negata"}
            </p>
          )}
        </div>
      );
    }
    case "fine":
      return (
        <p className="mono mt-2 border-t pt-2 text-[11px]" style={{ borderColor: "var(--linea)", color: "var(--inchiostro-3)" }}>
          {e.ok ? "fatto" : "interrotto"}
          {e.durataMs != null && ` · ${(e.durataMs / 1000).toFixed(1)}s`}
          {e.costoUsd != null && e.costoUsd > 0 && ` · $${e.costoUsd.toFixed(3)}`}
        </p>
      );
    case "errore":
      return (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--errore)" }}>
          {e.messaggio}
        </p>
      );
    default:
      return null;
  }
}

/** Console dell'agente: feed streaming dei comandi eseguiti sul vault. */
export function ConsoleAgente() {
  const aperta = useUI((s) => s.consoleAperta);
  const chiudi = useUI((s) => s.chiudiConsole);
  const svuota = useUI((s) => s.svuotaFeed);
  const feed = useUI((s) => s.feed);
  const inEsecuzione = useUI((s) => s.agenteInEsecuzione);
  const fondo = useRef<HTMLDivElement>(null);

  // decisioni gia prese (per disattivare i bottoni delle card permesso)
  const decisioni = useMemo(() => {
    const m = new Map<string, "allow" | "deny">();
    for (const e of feed) {
      if (e.t === "permesso_esito") m.set(e.id, e.esito);
    }
    return m;
  }, [feed]);

  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [feed.length]);

  if (!aperta) return null;

  return (
    <section
      className="pannello-enter absolute bottom-4 left-1/2 flex max-h-[52vh] w-[min(640px,92vw)] -translate-x-1/2 flex-col max-md:bottom-[64px]"
      style={{ zIndex: "var(--z-modal)" }}
      aria-label="Console dell'agente"
    >
      <div className="pannello-superficie flex min-h-0 flex-1 flex-col">
        <header
          className="flex items-center justify-between border-b px-4 py-2.5"
          style={{ borderColor: "var(--linea)" }}
        >
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--oro)" }}>
            Agente del nucleo
            {inEsecuzione && (
              <span className="ml-2 font-normal" style={{ color: "var(--inchiostro-2)" }}>
                al lavoro sul vault…
              </span>
            )}
          </h2>
          <div className="flex gap-2">
            {!inEsecuzione && feed.length > 0 && (
              <button
                type="button"
                onClick={svuota}
                className="text-[11.5px] underline-offset-2 hover:underline"
                style={{ color: "var(--inchiostro-3)" }}
              >
                pulisci
              </button>
            )}
            <button
              type="button"
              onClick={chiudi}
              aria-label="Chiudi console"
              className="bottone-secondario px-2 py-0.5 text-[12px]"
            >
              chiudi
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          {feed.length === 0 && (
            <p className="mt-3 text-[12.5px]" style={{ color: "var(--inchiostro-2)" }}>
              Scrivi un comando nella barra in alto: l&apos;agente lavora sulle note rispettando
              le regole del vault e ti chiede conferma prima delle operazioni sensibili.
            </p>
          )}
          {feed.map((e, i) => (
            <Evento key={i} e={e} decisioni={decisioni} />
          ))}
          <div ref={fondo} />
        </div>
      </div>
    </section>
  );
}
