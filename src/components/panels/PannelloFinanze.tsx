"use client";

import type { FinanzeData } from "@/lib/vault/finanze";
import { useUI } from "@/state/store";
import { TestataPannello, VuotoCaldo, dataItaliana, importoInValute, useVaultJson } from "./comune";

function Cifra({ v, valuta }: { v: number; valuta: string }) {
  return (
    <span className="mono">
      {v.toLocaleString("it-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
      <span style={{ color: "var(--inchiostro-3)" }}>{valuta}</span>
    </span>
  );
}

export function PannelloFinanze() {
  const { dati, errore } = useVaultJson<FinanzeData>("/api/finanze");
  const apriNota = useUI((s) => s.apriNota);

  if (errore) return <VuotoCaldo>{errore}</VuotoCaldo>;
  if (!dati) return <VuotoCaldo>Leggo i registri di 02_FINANZE…</VuotoCaldo>;

  const abb = dati.abbonamenti;
  const mesi = dati.variabili.mesi;
  const meseCorrente = mesi[mesi.length - 1];
  const registroRecente = [...dati.variabili.registro].reverse().slice(0, 10);

  return (
    <div>
      <TestataPannello
        titolo="Finanze"
        sotto="Letto dalle tabelle del vault. Tutto resta su questo Mac: nessun dato esce."
      />

      {/* riepilogo mensile: tre numeri che contano */}
      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--linea)" }}>
          <p className="text-[12px]" style={{ color: "var(--inchiostro-2)" }}>
            Entrate mensili
          </p>
          <p className="mt-1 text-[22px] font-semibold">
            {Object.entries(abb.entrateMensili).map(([val, v]) => (
              <Cifra key={val} v={v} valuta={val} />
            ))}
          </p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--linea)" }}>
          <p className="text-[12px]" style={{ color: "var(--inchiostro-2)" }}>
            Spese ricorrenti
          </p>
          <p className="mt-1 text-[22px] font-semibold">
            {Object.entries(abb.totaleMensile).map(([val, v]) => (
              <Cifra key={val} v={v} valuta={val} />
            ))}
          </p>
          <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--inchiostro-3)" }}>
            {abb.spese.length} voci · aggiornate {dataItaliana(abb.aggiornata)}
          </p>
        </div>
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--linea-forte)", background: "var(--superficie-2)" }}
        >
          <p className="text-[12px]" style={{ color: "var(--inchiostro-2)" }}>
            Margine dopo le ricorrenti
          </p>
          <p className="mt-1 text-[22px] font-semibold" style={{ color: "var(--oro)" }}>
            {Object.entries(abb.margineMensile).map(([val, v]) => (
              <Cifra key={val} v={v} valuta={val} />
            ))}
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-10 xl:grid-cols-[1.15fr_1fr]">
        <section>
          <div className="flex items-baseline justify-between">
            <h3 className="text-[15px] font-semibold">Abbonamenti e ricorrenti</h3>
            <button
              type="button"
              className="text-[12px] underline-offset-2 hover:underline"
              style={{ color: "var(--oro-2)" }}
              onClick={() => abb.rel && apriNota(abb.rel)}
            >
              Apri la nota
            </button>
          </div>
          <table className="mt-2 w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px]" style={{ color: "var(--inchiostro-2)" }}>
                <th className="py-1.5 font-medium">Voce</th>
                <th className="py-1.5 text-right font-medium">Mensile</th>
                <th className="py-1.5 pl-4 font-medium max-md:hidden">Nota</th>
              </tr>
            </thead>
            <tbody>
              {abb.spese.map((r, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--linea)" }}>
                  <td className="py-1.5 pr-3">{r.voce}</td>
                  <td className="py-1.5 text-right">
                    {r.mensile ? <Cifra v={r.mensile.valore} valuta={r.mensile.valuta} /> : ""}
                  </td>
                  <td
                    className="max-w-[260px] truncate py-1.5 pl-4 text-[12px] max-md:hidden"
                    style={{ color: "var(--inchiostro-3)" }}
                  >
                    {r.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="flex flex-col gap-8">
          <section>
            <h3 className="text-[15px] font-semibold">Mese per mese</h3>
            <p className="text-[11.5px]" style={{ color: "var(--inchiostro-3)" }}>
              Spese variabili calcolate dal registro, valute separate.
            </p>
            <ul className="mt-2">
              {mesi.map((m) => {
                const massimo = Math.max(
                  ...mesi.map((x) => Object.values(x.totale).reduce((a, b) => a + b, 0)),
                  1
                );
                const somma = Object.values(m.totale).reduce((a, b) => a + b, 0);
                return (
                  <li key={m.mese} className="flex items-center gap-3 py-1.5">
                    <span className="mono w-[64px] flex-none text-[12px]" style={{ color: "var(--inchiostro-2)" }}>
                      {m.mese}
                    </span>
                    <span
                      aria-hidden
                      className="h-[6px] flex-none rounded-full"
                      style={{
                        width: `${Math.max(3, (somma / massimo) * 160)}px`,
                        background: "linear-gradient(90deg, var(--polvere), var(--oro-2))",
                      }}
                    />
                    <span className="mono ml-auto text-[12.5px]">{importoInValute(m.totale)}</span>
                  </li>
                );
              })}
            </ul>
            {meseCorrente && Object.keys(meseCorrente.entrate).length > 0 && (
              <p className="mt-1 text-[11.5px]" style={{ color: "var(--ok)" }}>
                Entrate extra {meseCorrente.mese}: {importoInValute(meseCorrente.entrate)}
              </p>
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <h3 className="text-[15px] font-semibold">Portfolio crypto</h3>
              <span className="mono text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
                snapshot {dataItaliana(dati.crypto.snapshotData)}
              </span>
            </div>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {dati.crypto.assets.map((a) => (
                  <tr key={a.asset} className="border-t" style={{ borderColor: "var(--linea)" }}>
                    <td className="py-1.5 font-medium">{a.asset}</td>
                    <td className="mono py-1.5 text-right">{a.quantita}</td>
                    <td className="py-1.5 text-right">
                      {a.costo && <Cifra v={a.costo.valore} valuta={a.costo.valuta} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              className="mt-2 text-[12px] underline-offset-2 hover:underline"
              style={{ color: "var(--oro-2)" }}
              onClick={() => dati.crypto.rel && apriNota(dati.crypto.rel)}
            >
              Apri la nota
            </button>
          </section>

          <section>
            <h3 className="text-[15px] font-semibold">Spese recenti</h3>
            <ul className="mt-2">
              {registroRecente.map((s, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-3 border-t py-1.5 text-[12.5px]"
                  style={{ borderColor: "var(--linea)" }}
                >
                  <span className="mono flex-none text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
                    {dataItaliana(s.data)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.descrizione}</span>
                  <span className="flex-none text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
                    {s.categoria}
                  </span>
                  <span
                    className="mono flex-none"
                    style={{ color: s.entrata ? "var(--ok)" : "var(--inchiostro)" }}
                  >
                    {s.importo && <Cifra v={s.importo.valore} valuta={s.importo.valuta} />}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
