"use client";

import type { ProgettoScheda } from "@/lib/vault/progetti";
import { useUI } from "@/state/store";
import { ChipNotaLink, TestataPannello, VuotoCaldo, dataItaliana, useVaultJson } from "./comune";

function Scheda({ p }: { p: ProgettoScheda }) {
  const apriNota = useUI((s) => s.apriNota);
  const vola = useUI((s) => s.vola);
  const setSelezione = useUI((s) => s.setSelezione);
  const setPannello = useUI((s) => s.setPannello);
  const galassia = useUI((s) => s.galassia);
  const idx = galassia?.relToIdx.get(p.rel);

  return (
    <article
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--linea)", background: "var(--superficie-2)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <i
          className="h-[9px] w-[9px] flex-none self-center rounded-full"
          style={{ background: `var(--area-${p.areaKey})` }}
          aria-hidden
        />
        <h3 className="text-[17px] font-semibold leading-tight">
          <button type="button" onClick={() => apriNota(p.rel)} className="text-left hover:underline underline-offset-3">
            {p.titolo}
          </button>
        </h3>
        {p.stato && (
          <span
            className="text-[11px] font-medium"
            style={{ color: p.stato === "attivo" ? "var(--ok)" : "var(--inchiostro-2)" }}
          >
            {p.stato}
          </span>
        )}
        <span className="mono ml-auto text-[10.5px]" style={{ color: "var(--inchiostro-3)" }}>
          {dataItaliana(p.aggiornata ?? p.creata)}
        </span>
      </div>

      {p.obiettivo && (
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--inchiostro-2)" }}>
          {p.obiettivo}
        </p>
      )}

      {p.prossimeAzioni.length > 0 && (
        <div className="mt-3">
          <h4 className="text-[11.5px] font-semibold" style={{ color: "var(--oro)" }}>
            Prossime azioni
          </h4>
          <ul className="mt-1 flex flex-col gap-0.5">
            {p.prossimeAzioni.map((a, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-snug">
                <span aria-hidden style={{ color: "var(--inchiostro-3)" }}>·</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.decisioni.length > 0 && (
        <div className="mt-3">
          <h4 className="text-[11.5px] font-semibold" style={{ color: "var(--inchiostro-2)" }}>
            Ultime decisioni
          </h4>
          <ul className="mt-1 flex flex-col gap-0.5">
            {p.decisioni.map((d, i) => (
              <li key={i} className="text-[12.5px] leading-snug" style={{ color: "var(--inchiostro-2)" }}>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.taskAperte.length > 0 && (
        <p className="mono mt-3 text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
          {p.nTaskAperte} task aperte{p.taskAperte[0] ? ` · prossima: ${p.taskAperte[0].testo.slice(0, 60)}` : ""}
        </p>
      )}

      {p.vicini.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {p.vicini.slice(0, 6).map((v) => (
            <ChipNotaLink key={v.rel} {...v} />
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button type="button" className="bottone-secondario text-[12px]" onClick={() => apriNota(p.rel)}>
          Apri scheda
        </button>
        {idx != null && (
          <button
            type="button"
            className="bottone-secondario text-[12px]"
            onClick={() => {
              setSelezione(idx);
              vola(idx);
              setPannello("galassia");
            }}
          >
            Vedi nella galassia
          </button>
        )}
      </div>
    </article>
  );
}

export function PannelloProgetti() {
  const { dati, errore } = useVaultJson<ProgettoScheda[]>("/api/progetti");
  const attivi = (dati ?? []).filter((p) => p.stato === "attivo");
  const altri = (dati ?? []).filter((p) => p.stato !== "attivo");

  return (
    <div>
      <TestataPannello
        titolo="Progetti"
        sotto={dati ? `${attivi.length} attivi · ${altri.length} in altre fasi` : "Leggo le note progetto…"}
      />
      {errore && <VuotoCaldo>{errore}</VuotoCaldo>}
      <div className="grid gap-4 xl:grid-cols-2">
        {attivi.map((p) => (
          <Scheda key={p.rel} p={p} />
        ))}
      </div>
      {altri.length > 0 && (
        <>
          <h3 className="mb-3 mt-8 text-[13px] font-semibold" style={{ color: "var(--inchiostro-2)" }}>
            Planning, on hold e conclusi
          </h3>
          <div className="grid gap-4 xl:grid-cols-2">
            {altri.map((p) => (
              <Scheda key={p.rel} p={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
