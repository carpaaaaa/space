"use client";

import { Pannello, useUI } from "@/state/store";

const VOCI: { key: Pannello; label: string }[] = [
  { key: "galassia", label: "Galassia" },
  { key: "oggi", label: "Oggi" },
  { key: "progetti", label: "Progetti" },
  { key: "finanze", label: "Finanze" },
  { key: "inbox", label: "Inbox" },
  { key: "log", label: "Log" },
  { key: "ricerca", label: "Cerca" },
];

/** Navigazione mobile: barra inferiore scorrevole. */
export function TabBarMobile() {
  const pannello = useUI((s) => s.pannello);
  const setPannello = useUI((s) => s.setPannello);

  return (
    <nav
      className="absolute inset-x-0 bottom-0 md:hidden"
      style={{
        zIndex: "var(--z-drawer)",
        background: "color-mix(in srgb, var(--superficie) 97%, transparent)",
        borderTop: "1px solid var(--linea)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="Navigazione NUCLEO"
    >
      <ul className="flex overflow-x-auto px-2 py-1.5" style={{ scrollbarWidth: "none" }}>
        {VOCI.map((v) => {
          const attivo = pannello === v.key;
          return (
            <li key={v.key} className="flex-none">
              <button
                type="button"
                onClick={() => setPannello(v.key)}
                aria-current={attivo ? "page" : undefined}
                className="rounded-full px-3.5 py-1.5 text-[13px] transition-colors duration-150"
                style={{
                  color: attivo ? "var(--oro)" : "var(--inchiostro-2)",
                  background: attivo ? "rgba(255,217,138,.1)" : "transparent",
                  fontWeight: attivo ? 600 : 450,
                }}
              >
                {v.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
