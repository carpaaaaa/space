"use client";

import { useState } from "react";
import { useUI } from "@/state/store";
import { TestataPannello, VuotoCaldo } from "./comune";

type Modo = "note" | "grafo" | "percorso" | "concetto";

interface RisultatoLocale {
  rel: string;
  titolo: string;
  areaKey: string;
  tipo?: string;
  stato?: string;
  estratto: string;
}

export function PannelloRicerca() {
  const [modo, setModo] = useState<Modo>("note");
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [locali, setLocali] = useState<RisultatoLocale[] | null>(null);
  const [testoGrafo, setTestoGrafo] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const galassia = useUI((s) => s.galassia);
  const apriNota = useUI((s) => s.apriNota);
  const vola = useUI((s) => s.vola);
  const setSelezione = useUI((s) => s.setSelezione);
  const setPannello = useUI((s) => s.setPannello);
  const setFiltri = useUI((s) => s.setFiltri);

  const domande = galassia?.payload.report.domande ?? [];
  const god = (galassia?.payload.report.godNodes ?? []).filter((g) => g.star != null);
  const nodiIsolati = galassia?.payload.report.nodiIsolati ?? 0;

  const cerca = async (modoRichiesto?: Modo, testoRichiesto?: string) => {
    const m = modoRichiesto ?? modo;
    const testo = (testoRichiesto ?? q).trim();
    setErrore(null);
    setLocali(null);
    setTestoGrafo(null);
    setCaricamento(true);
    try {
      if (m === "note") {
        if (!testo) return;
        const r = await fetch(`/api/search?mode=local&q=${encodeURIComponent(testo)}`);
        setLocali((await r.json()) as RisultatoLocale[]);
      } else if (m === "percorso") {
        if (!a.trim() || !b.trim()) {
          setErrore("Servono due estremi: da dove a dove.");
          return;
        }
        const r = await fetch(
          `/api/search?mode=path&a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`
        );
        const j = await r.json();
        if (j.errore) setErrore(j.errore);
        else setTestoGrafo(j.testo);
      } else {
        if (!testo) return;
        const modeApi = m === "concetto" ? "explain" : "graph";
        const r = await fetch(`/api/search?mode=${modeApi}&q=${encodeURIComponent(testo)}`);
        const j = await r.json();
        if (j.errore) setErrore(j.errore);
        else setTestoGrafo(j.testo);
      }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore di ricerca");
    } finally {
      setCaricamento(false);
    }
  };

  const volaANota = (rel: string) => {
    apriNota(rel);
    const idx = galassia?.relToIdx.get(rel);
    if (idx != null) {
      setSelezione(idx);
      vola(idx);
      setPannello("galassia");
    }
  };

  const MODI: { key: Modo; label: string; hint: string }[] = [
    { key: "note", label: "Note", hint: "titoli, frontmatter e contenuto" },
    { key: "grafo", label: "Grafo", hint: "graphify query sul grafo semantico" },
    { key: "percorso", label: "Percorso", hint: "cosa collega due concetti" },
    { key: "concetto", label: "Concetto", hint: "graphify explain, sottografo focalizzato" },
  ];

  return (
    <div>
      <TestataPannello
        titolo="Ricerca"
        sotto="Il vault e il suo grafo, interrogabili"
      />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Modalita di ricerca">
        {MODI.map((m) => (
          <button
            key={m.key}
            role="tab"
            aria-selected={modo === m.key}
            type="button"
            onClick={() => {
              setModo(m.key);
              setErrore(null);
            }}
            className="rounded-full border px-3 py-1 text-[12.5px] transition-colors duration-150"
            style={{
              borderColor: modo === m.key ? "var(--linea-forte)" : "var(--linea)",
              background: modo === m.key ? "rgba(255,217,138,.08)" : "transparent",
              color: modo === m.key ? "var(--inchiostro)" : "var(--inchiostro-2)",
            }}
            title={m.hint}
          >
            {m.label}
          </button>
        ))}
      </div>

      {modo !== "percorso" ? (
        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && cerca()}
            placeholder={
              modo === "note"
                ? "es. crypto, brochure, wallpaper…"
                : modo === "concetto"
                  ? "es. Opera Prima I, Carpa, Graphify…"
                  : "es. god node dell'area design, note isolate in 07_IDEE…"
            }
            className="h-10 w-full rounded-md border bg-transparent px-3.5 text-[13.5px] outline-none"
            style={{ borderColor: "var(--linea-forte)" }}
            aria-label="Testo di ricerca"
          />
          <button type="button" onClick={() => cerca()} className="bottone-primario flex-none text-[13px]">
            {caricamento ? "Cerco…" : "Cerca"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="da… (es. Kept)"
            className="h-10 w-[220px] rounded-md border bg-transparent px-3.5 text-[13.5px] outline-none"
            style={{ borderColor: "var(--linea-forte)" }}
            aria-label="Primo estremo"
          />
          <span style={{ color: "var(--inchiostro-3)" }}>fino a</span>
          <input
            value={b}
            onChange={(e) => setB(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && cerca()}
            placeholder="a… (es. Sito Carpa)"
            className="h-10 w-[220px] rounded-md border bg-transparent px-3.5 text-[13.5px] outline-none"
            style={{ borderColor: "var(--linea-forte)" }}
            aria-label="Secondo estremo"
          />
          <button type="button" onClick={() => cerca()} className="bottone-primario flex-none text-[13px]">
            {caricamento ? "Cerco…" : "Trova il percorso"}
          </button>
        </div>
      )}

      {errore && <p className="mt-3 text-[13px]" style={{ color: "var(--errore)" }}>{errore}</p>}

      {/* risultati locali */}
      {locali && (
        <ul className="mt-5 flex flex-col">
          {locali.length === 0 && <VuotoCaldo>Nessuna nota trovata.</VuotoCaldo>}
          {locali.map((r) => (
            <li key={r.rel} className="border-t" style={{ borderColor: "var(--linea)" }}>
              <button
                type="button"
                onClick={() => volaANota(r.rel)}
                className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 px-1 py-2.5 text-left transition-colors hover:bg-[color:var(--superficie-2)]"
              >
                <i
                  className="h-[8px] w-[8px] flex-none translate-y-[-1px] rounded-full"
                  style={{ background: `var(--area-${r.areaKey})` }}
                  aria-hidden
                />
                <span className="text-[14px] font-medium">{r.titolo}</span>
                {r.tipo && (
                  <span className="text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
                    {r.tipo}
                  </span>
                )}
                <span className="w-full pl-5 text-[12.5px]" style={{ color: "var(--inchiostro-2)" }}>
                  {r.estratto}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* output del grafo */}
      {testoGrafo && (
        <pre
          className="mono mt-5 max-h-[46vh] overflow-auto whitespace-pre-wrap rounded-lg border p-4 text-[12px] leading-relaxed"
          style={{ borderColor: "var(--linea)", background: "var(--superficie-2)", color: "var(--inchiostro-2)" }}
        >
          {testoGrafo}
        </pre>
      )}

      {/* scorciatoie dal report */}
      {!locali && !testoGrafo && (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section>
            <h3 className="text-[13px] font-semibold">Il grafo suggerisce di chiedere</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {domande.slice(0, 6).map((d, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setModo("grafo");
                      setQ(d);
                      cerca("grafo", d);
                    }}
                    className="w-full rounded-md border px-3 py-2 text-left text-[12.5px] leading-snug transition-colors hover:bg-[color:var(--superficie-2)]"
                    style={{ borderColor: "var(--linea)", color: "var(--inchiostro-2)" }}
                  >
                    {d}
                  </button>
                </li>
              ))}
              {domande.length === 0 && (
                <VuotoCaldo>Nessun report Graphify trovato: rigenera il grafo.</VuotoCaldo>
              )}
            </ul>
          </section>

          <section>
            <h3 className="text-[13px] font-semibold">Scorciatoie</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                className="bottone-secondario text-[12px]"
                onClick={() => {
                  setFiltri({ soloGap: true, soloGod: false });
                  setPannello("galassia");
                }}
              >
                Mostra i gap in galassia
              </button>
              <button
                type="button"
                className="bottone-secondario text-[12px]"
                onClick={() => {
                  setFiltri({ soloGod: true, soloGap: false });
                  setPannello("galassia");
                }}
              >
                Solo i god nodes
              </button>
            </div>
            {nodiIsolati > 0 && (
              <p className="mt-3 text-[12.5px]" style={{ color: "var(--inchiostro-2)" }}>
                Il report conta <strong>{nodiIsolati} nodi isolati</strong>: conoscenza citata una
                volta sola o mai collegata.
              </p>
            )}
            <h4 className="mt-4 text-[12px] font-semibold" style={{ color: "var(--inchiostro-2)" }}>
              Supergiganti del vault
            </h4>
            <ul className="mt-1.5 flex flex-col gap-1">
              {god.map((g) => (
                <li key={g.label}>
                  <button
                    type="button"
                    className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-[12.5px] transition-colors hover:bg-[color:var(--superficie-2)]"
                    onClick={() => {
                      if (g.star == null) return;
                      setSelezione(g.star);
                      vola(g.star);
                      setPannello("galassia");
                    }}
                  >
                    <span aria-hidden style={{ color: "var(--oro-2)" }}>✦</span>
                    <span className="min-w-0 flex-1 truncate">{g.label}</span>
                    <span className="mono text-[10.5px]" style={{ color: "var(--inchiostro-3)" }}>
                      {g.edges} edge
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
