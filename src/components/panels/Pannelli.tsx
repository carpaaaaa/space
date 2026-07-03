"use client";

import { useUI } from "@/state/store";

/** Contenitore dei pannelli operativi (riempiti nella fase 3). */
export function Pannelli() {
  const pannello = useUI((s) => s.pannello);

  return (
    <section
      className="pannello-enter absolute bottom-6 left-[210px] right-6 top-[76px] overflow-y-auto max-md:inset-x-3 max-md:top-16"
      style={{ zIndex: "var(--z-pannello)" }}
      aria-label={`Pannello ${pannello}`}
    >
      <div className="pannello-superficie min-h-full px-7 py-6">
        <h2 className="text-[22px] font-semibold capitalize">{pannello}</h2>
        <p className="mt-2 text-[13.5px]" style={{ color: "var(--inchiostro-2)" }}>
          In costruzione nella fase 3.
        </p>
      </div>
    </section>
  );
}
