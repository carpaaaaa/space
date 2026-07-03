"use client";

import { TEMI } from "@/lib/temi";
import { ASPETTO_DEFAULT, useUI } from "@/state/store";
import { TestataPannello } from "./comune";

function Cursore({
  etichetta,
  min,
  max,
  step,
  valore,
  onChange,
  formato,
}: {
  etichetta: string;
  min: number;
  max: number;
  step: number;
  valore: number;
  onChange: (v: number) => void;
  formato?: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[13px]">
        {etichetta}
        <span className="mono text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
          {formato ? formato(valore) : valore.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valore}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full"
        style={{ accentColor: "var(--oro-2)" }}
      />
    </label>
  );
}

export function PannelloAspetto() {
  const aspetto = useUI((s) => s.aspetto);
  const setAspetto = useUI((s) => s.setAspetto);

  return (
    <div>
      <TestataPannello
        titolo="Aspetto"
        sotto="Tema e resa della galassia. Le scelte restano su questo browser."
        azioni={
          <button
            type="button"
            className="bottone-secondario text-[12px]"
            onClick={() => setAspetto(ASPETTO_DEFAULT)}
          >
            Ripristina default
          </button>
        }
      />

      <section>
        <h3 className="mb-2 text-[13px] font-semibold">Tema</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TEMI.map((t) => {
            const attivo = aspetto.tema === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAspetto({ tema: t.id })}
                aria-pressed={attivo}
                className="rounded-xl border p-4 text-left transition-colors duration-150"
                style={{
                  borderColor: attivo ? "var(--oro-2)" : "var(--linea)",
                  background: t.vars["--superficie"],
                }}
              >
                <span
                  className="text-[14px] font-semibold"
                  style={{ color: t.vars["--inchiostro"] }}
                >
                  {t.nome}
                  {attivo && (
                    <span className="ml-2 text-[11px] font-normal" style={{ color: t.vars["--oro-2"] }}>
                      attivo
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-[12px]" style={{ color: t.vars["--inchiostro-2"] }}>
                  {t.descrizione}
                </span>
                <span className="mt-3 flex gap-1.5" aria-hidden>
                  {[t.galassia.nucleo[1], t.galassia.stella, t.vars["--oro-2"], t.galassia.polvere[0]].map(
                    (c, i) => (
                      <span
                        key={i}
                        className="h-[14px] w-[14px] rounded-full"
                        style={{ background: c }}
                      />
                    )
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <section className="flex flex-col gap-5">
          <h3 className="text-[13px] font-semibold">Stelle</h3>
          <Cursore
            etichetta="Dimensione"
            min={0.5}
            max={2}
            step={0.05}
            valore={aspetto.scalaStelle}
            onChange={(v) => setAspetto({ scalaStelle: v })}
            formato={(v) => `${Math.round(v * 100)}%`}
          />
          <Cursore
            etichetta="Intensita del glow"
            min={0.4}
            max={1.6}
            step={0.05}
            valore={aspetto.glow}
            onChange={(v) => setAspetto({ glow: v })}
            formato={(v) => `${Math.round(v * 100)}%`}
          />
          <Cursore
            etichetta="Durezza del bordo"
            min={1.2}
            max={4}
            step={0.1}
            valore={aspetto.durezza}
            onChange={(v) => setAspetto({ durezza: v })}
            formato={(v) => (v < 2 ? "morbida" : v < 3 ? "media" : "netta")}
          />
        </section>

        <section className="flex flex-col gap-5">
          <h3 className="text-[13px] font-semibold">Colore e comportamento</h3>
          <div>
            <p className="mb-1.5 text-[13px]">Colore delle stelle</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["area", "Per area"],
                  ["community", "Per community"],
                  ["mono", "Monocromo"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAspetto({ coloreMode: mode })}
                  aria-pressed={aspetto.coloreMode === mode}
                  className="rounded-full border px-3 py-1 text-[12.5px] transition-colors duration-150"
                  style={{
                    borderColor:
                      aspetto.coloreMode === mode ? "var(--linea-forte)" : "var(--linea)",
                    background:
                      aspetto.coloreMode === mode ? "rgba(255,217,138,.08)" : "transparent",
                    color:
                      aspetto.coloreMode === mode ? "var(--inchiostro)" : "var(--inchiostro-2)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--inchiostro-3)" }}>
              Per area usa i colori del vault; per community i gruppi del grafo semantico.
            </p>
          </div>

          <label className="flex items-center justify-between gap-4">
            <span className="text-[13px]">Rotazione lenta automatica</span>
            <input
              type="checkbox"
              checked={aspetto.autoRotazione}
              onChange={(e) => setAspetto({ autoRotazione: e.target.checked })}
              className="h-4 w-4"
              style={{ accentColor: "var(--oro-2)" }}
            />
          </label>
        </section>
      </div>
    </div>
  );
}
