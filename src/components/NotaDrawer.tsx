"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/state/store";

interface NotaDettaglio {
  meta: {
    rel: string;
    titolo: string;
    areaKey: string;
    tipo?: string;
    stato?: string;
    creata?: string;
    aggiornata?: string;
    parole: number;
  };
  html: string;
  backlinks: { rel: string; titolo: string; areaKey: string }[];
  inUscita: { rel: string; titolo: string; areaKey: string }[];
  vicini: { rel: string; titolo: string; areaKey: string }[];
  concetti: string[];
  obsidianUri: string;
}

function ChipNota({
  n,
  onClick,
}: {
  n: { rel: string; titolo: string; areaKey: string };
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="chip-area hover:brightness-125">
      <i style={{ background: `var(--area-${n.areaKey}, var(--inchiostro-3))` }} aria-hidden />
      {n.titolo}
    </button>
  );
}

export function NotaDrawer() {
  const rel = useUI((s) => s.notaAperta);
  if (!rel) return null;
  // key={rel}: lo stato interno riparte pulito a ogni cambio di nota
  return <NotaDrawerInner key={rel} rel={rel} />;
}

function NotaDrawerInner({ rel }: { rel: string }) {
  const chiudi = useUI((s) => s.chiudiNota);
  const apriNota = useUI((s) => s.apriNota);
  const vola = useUI((s) => s.vola);
  const setSelezione = useUI((s) => s.setSelezione);
  const galassia = useUI((s) => s.galassia);
  const vaultVersion = useUI((s) => s.vaultVersion);
  const [nota, setNota] = useState<NotaDettaglio | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/note?rel=${encodeURIComponent(rel)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).errore ?? "Nota non leggibile");
        return r.json();
      })
      .then((d) => {
        if (vivo) {
          setNota(d);
          setErrore(null);
        }
      })
      .catch((e) => vivo && setErrore(e.message));
    return () => {
      vivo = false;
    };
  }, [rel, vaultVersion]);

  // i wikilink dentro la prosa aprono la nota citata
  const onClickProsa = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("wikilink:")) {
      e.preventDefault();
      const titolo = decodeURIComponent(href.slice("wikilink:".length));
      fetch(`/api/note?titolo=${encodeURIComponent(titolo)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && apriNota(d.meta.rel))
        .catch(() => {});
    } else if (href.startsWith("http")) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noreferrer");
    }
  };

  const idxStella = galassia?.relToIdx.get(rel);

  return (
    <aside
      className="pannello-enter absolute bottom-0 right-0 top-0 flex w-[min(480px,100vw)] flex-col"
      style={{
        zIndex: "var(--z-drawer)",
        background: "color-mix(in srgb, var(--superficie) 97%, transparent)",
        borderLeft: "1px solid var(--linea)",
      }}
      aria-label={`Nota ${nota?.meta.titolo ?? ""}`}
    >
      <header className="border-b px-5 py-4" style={{ borderColor: "var(--linea)" }}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[19px] font-semibold leading-snug">
            {nota?.meta.titolo ?? rel.split("/").pop()?.replace(/\.md$/, "")}
          </h2>
          <button
            type="button"
            onClick={chiudi}
            aria-label="Chiudi nota"
            className="bottone-secondario px-2 py-0.5 text-[13px]"
          >
            esc
          </button>
        </div>
        {nota && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip-area">
                <i
                  style={{ background: `var(--area-${nota.meta.areaKey}, var(--inchiostro-3))` }}
                  aria-hidden
                />
                {nota.meta.areaKey}
              </span>
              {nota.meta.tipo && <span className="chip-area">{nota.meta.tipo}</span>}
              {nota.meta.stato && <span className="chip-area">{nota.meta.stato}</span>}
              <span className="chip-area mono">{nota.meta.parole} parole</span>
            </div>
            <div className="mono mt-2 flex gap-3 text-[10.5px]" style={{ color: "var(--inchiostro-3)" }}>
              {nota.meta.creata && <span>creata {nota.meta.creata}</span>}
              {nota.meta.aggiornata && <span>aggiornata {nota.meta.aggiornata}</span>}
            </div>
            <div className="mt-3 flex gap-2">
              <a href={nota.obsidianUri} className="bottone-primario text-[12.5px]">
                Apri in Obsidian
              </a>
              {idxStella != null && (
                <button
                  type="button"
                  className="bottone-secondario text-[12.5px]"
                  onClick={() => {
                    setSelezione(idxStella);
                    vola(idxStella);
                  }}
                >
                  Vola alla stella
                </button>
              )}
            </div>
          </>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {errore && (
          <p className="text-[13px]" style={{ color: "var(--errore)" }}>
            {errore}
          </p>
        )}
        {!nota && !errore && (
          <p className="text-[13px]" style={{ color: "var(--inchiostro-3)" }}>
            Leggo la nota…
          </p>
        )}
        {nota && (
          <>
            <article
              className="prosa text-[14px]"
              onClick={onClickProsa}
              dangerouslySetInnerHTML={{ __html: nota.html }}
            />

            {(nota.backlinks.length > 0 || nota.inUscita.length > 0 || nota.vicini.length > 0) && (
              <div className="mt-8 border-t pt-4" style={{ borderColor: "var(--linea)" }}>
                {nota.backlinks.length > 0 && (
                  <section className="mb-4">
                    <h3 className="mb-2 text-[12px] font-semibold" style={{ color: "var(--inchiostro-2)" }}>
                      Citata da
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {nota.backlinks.map((n) => (
                        <ChipNota key={n.rel} n={n} onClick={() => apriNota(n.rel)} />
                      ))}
                    </div>
                  </section>
                )}
                {nota.inUscita.length > 0 && (
                  <section className="mb-4">
                    <h3 className="mb-2 text-[12px] font-semibold" style={{ color: "var(--inchiostro-2)" }}>
                      Cita
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {nota.inUscita.map((n) => (
                        <ChipNota key={n.rel} n={n} onClick={() => apriNota(n.rel)} />
                      ))}
                    </div>
                  </section>
                )}
                {nota.vicini.length > 0 && (
                  <section className="mb-4">
                    <h3 className="mb-2 text-[12px] font-semibold" style={{ color: "var(--inchiostro-2)" }}>
                      Vicine nella galassia
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {nota.vicini.map((n) => (
                        <ChipNota key={n.rel} n={n} onClick={() => apriNota(n.rel)} />
                      ))}
                    </div>
                  </section>
                )}
                {nota.concetti.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-[12px] font-semibold" style={{ color: "var(--inchiostro-2)" }}>
                      Concetti estratti
                    </h3>
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--inchiostro-3)" }}>
                      {nota.concetti.join(" · ")}
                    </p>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
