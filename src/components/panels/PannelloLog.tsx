"use client";

import { useMemo, useState } from "react";
import type { LogGiorno } from "@/lib/vault/logs";
import { useUI } from "@/state/store";
import { TestataPannello, VuotoCaldo, dataItaliana, useVaultJson } from "./comune";

/** testo con [[wikilink]] cliccabili */
function TestoLog({ testo }: { testo: string }) {
  const apriNota = useUI((s) => s.apriNota);
  const parti = testo.split(/(\[\[[^\]]+\]\])/g);
  return (
    <span className="min-w-0 leading-relaxed" style={{ color: "var(--inchiostro-2)" }}>
      {parti.map((p, i) => {
        const m = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(p);
        if (!m) {
          return <span key={i}>{p.replace(/\*\*/g, "")}</span>;
        }
        const target = m[1];
        const alias = m[2] ?? m[1];
        return (
          <button
            key={i}
            type="button"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--oro-2)" }}
            onClick={() => {
              fetch(`/api/note?titolo=${encodeURIComponent(target)}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => d && apriNota(d.meta.rel))
                .catch(() => {});
            }}
          >
            {alias}
          </button>
        );
      })}
    </span>
  );
}

const COLORI_AZIONE: Record<string, string> = {
  create: "var(--ok)",
  update: "var(--oro-2)",
  decision: "var(--area-idee)",
  ingest: "var(--area-inbox)",
  build: "var(--area-pc)",
  health: "var(--area-archviz)",
  archive: "var(--area-archivio)",
  delete: "var(--errore)",
};

export function PannelloLog() {
  const { dati, errore } = useVaultJson<LogGiorno[]>("/api/logs?limit=30");
  const [filtro, setFiltro] = useState<string | null>(null);

  const azioni = useMemo(() => {
    const conta = new Map<string, number>();
    for (const g of dati ?? []) {
      for (const e of g.entries) conta.set(e.azione, (conta.get(e.azione) ?? 0) + 1);
    }
    return [...conta.entries()].sort((a, b) => b[1] - a[1]);
  }, [dati]);

  return (
    <div>
      <TestataPannello
        titolo="Log"
        sotto="Il diario operativo del vault, append-only"
        azioni={
          <div className="flex flex-wrap gap-1.5">
            {azioni.map(([a, n]) => (
              <button
                key={a}
                type="button"
                onClick={() => setFiltro(filtro === a ? null : a)}
                aria-pressed={filtro === a}
                className="chip-area transition-opacity"
                style={{ opacity: !filtro || filtro === a ? 1 : 0.4 }}
              >
                <i style={{ background: COLORI_AZIONE[a] ?? "var(--inchiostro-3)" }} aria-hidden />
                {a} <span className="mono">{n}</span>
              </button>
            ))}
          </div>
        }
      />
      {errore && <VuotoCaldo>{errore}</VuotoCaldo>}
      {dati?.length === 0 && <VuotoCaldo>Nessun log ancora: il vault e giovane.</VuotoCaldo>}

      <div className="flex flex-col gap-7">
        {(dati ?? []).map((giorno) => {
          const entries = filtro
            ? giorno.entries.filter((e) => e.azione === filtro)
            : giorno.entries;
          if (entries.length === 0) return null;
          return (
            <section key={giorno.data}>
              <h3 className="mb-2 text-[13.5px] font-semibold">
                {dataItaliana(giorno.data)}
                <span className="mono ml-2 text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
                  {entries.length} operazioni
                </span>
              </h3>
              <ul className="flex flex-col">
                {entries.map((e, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[44px_74px_1fr] gap-3 border-t py-2 text-[12.5px]"
                    style={{ borderColor: "var(--linea)" }}
                  >
                    <span className="mono text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
                      {e.ora}
                    </span>
                    <span
                      className="mono text-[11px] font-medium"
                      style={{ color: COLORI_AZIONE[e.azione] ?? "var(--inchiostro-2)" }}
                    >
                      {e.azione}
                    </span>
                    <TestoLog testo={e.testo} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
