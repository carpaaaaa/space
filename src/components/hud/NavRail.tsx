"use client";

import { Pannello, useUI } from "@/state/store";

const VOCI: { key: Pannello; label: string }[] = [
  { key: "galassia", label: "Galassia" },
  { key: "oggi", label: "Obiettivi" },
  { key: "progetti", label: "Progetti" },
  { key: "finanze", label: "Finanze" },
  { key: "inbox", label: "Inbox" },
  { key: "log", label: "Log" },
  { key: "ricerca", label: "Ricerca" },
  { key: "skills", label: "Skills" },
  { key: "aspetto", label: "Aspetto" },
];

export function NavRail() {
  const pannello = useUI((s) => s.pannello);
  const setPannello = useUI((s) => s.setPannello);
  const galassia = useUI((s) => s.galassia);

  return (
    <nav
      className="absolute left-0 top-0 flex h-full w-[190px] flex-col px-5 py-5 max-md:hidden"
      style={{ zIndex: "var(--z-hud)" }}
      aria-label="Navigazione space"
    >
      <div className="mb-8 select-none">
        <p className="text-[19px] font-semibold tracking-[0.14em]" style={{ color: "var(--oro)" }}>
          space
        </p>
        <p className="mt-0.5 text-[11.5px] leading-tight" style={{ color: "var(--inchiostro-3)" }}>
          il cervello del vault Mind
        </p>
      </div>

      <ul className="flex flex-col gap-0.5">
        {VOCI.map((v) => {
          const attivo = pannello === v.key;
          return (
            <li key={v.key}>
              <button
                type="button"
                onClick={() => setPannello(v.key)}
                aria-current={attivo ? "page" : undefined}
                className="w-full rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors duration-150"
                style={{
                  color: attivo ? "var(--oro)" : "var(--inchiostro-2)",
                  background: attivo ? "rgba(255, 217, 138, 0.09)" : "transparent",
                  fontWeight: attivo ? 600 : 450,
                }}
              >
                {v.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto text-[10.5px] leading-relaxed" style={{ color: "var(--inchiostro-3)" }}>
        {galassia ? (
          <>
            <p>vault letto live</p>
            <p className="mono">
              {galassia.payload.conteggi.note} note · v{galassia.payload.versione}
            </p>
          </>
        ) : (
          <p>collegamento al vault…</p>
        )}
      </div>
    </nav>
  );
}
