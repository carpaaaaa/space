"use client";

import { useUI } from "@/state/store";

function Toggle({
  attivo,
  onClick,
  children,
}: {
  attivo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={attivo}
      className="rounded-full border px-2.5 py-[3px] text-[11.5px] transition-colors duration-150"
      style={{
        borderColor: attivo ? "var(--linea-forte)" : "var(--linea)",
        color: attivo ? "var(--inchiostro)" : "var(--inchiostro-3)",
        background: attivo ? "rgba(255,217,138,.07)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

/** Filtri della galassia: aree, god nodes, gap, filamenti, sezioni. */
export function FiltriGalassia() {
  const galassia = useUI((s) => s.galassia);
  const filtri = useUI((s) => s.filtri);
  const setFiltri = useUI((s) => s.setFiltri);
  const toggleArea = useUI((s) => s.toggleArea);

  if (!galassia) return null;
  const aree = galassia.payload.aree.filter((a) => a.braccio != null);

  return (
    <div
      className="absolute bottom-4 left-1/2 flex max-w-[86vw] -translate-x-1/2 flex-col items-center gap-2 max-md:hidden"
      style={{ zIndex: "var(--z-hud)" }}
    >
      <div className="flex flex-wrap justify-center gap-1.5">
        {aree.map((a) => {
          const on = filtri.aree[a.key] ?? true;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => toggleArea(a.key)}
              aria-pressed={on}
              className="chip-area transition-opacity duration-150"
              style={{ opacity: on ? 1 : 0.38, ["--c" as never]: a.colore }}
              title={on ? `Nascondi ${a.nome}` : `Mostra ${a.nome}`}
            >
              <i aria-hidden />
              {a.nome}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <Toggle attivo={filtri.soloGod} onClick={() => setFiltri({ soloGod: !filtri.soloGod, soloGap: false })}>
          solo god nodes
        </Toggle>
        <Toggle attivo={filtri.soloGap} onClick={() => setFiltri({ soloGap: !filtri.soloGap, soloGod: false })}>
          solo gap
        </Toggle>
        <Toggle attivo={filtri.filamenti} onClick={() => setFiltri({ filamenti: !filtri.filamenti })}>
          filamenti
        </Toggle>
        <Toggle attivo={filtri.sezioni} onClick={() => setFiltri({ sezioni: !filtri.sezioni })}>
          sezioni
        </Toggle>
        <Toggle attivo={filtri.etichette} onClick={() => setFiltri({ etichette: !filtri.etichette })}>
          nomi
        </Toggle>
      </div>
    </div>
  );
}
