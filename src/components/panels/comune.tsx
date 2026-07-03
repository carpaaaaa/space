"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/state/store";

/** Fetch JSON con rivalidazione automatica quando il vault cambia. */
export function useVaultJson<T>(url: string | null): {
  dati: T | null;
  errore: string | null;
  caricamento: boolean;
} {
  const vaultVersion = useUI((s) => s.vaultVersion);
  const [stato, setStato] = useState<{
    dati: T | null;
    errore: string | null;
    caricamento: boolean;
  }>({ dati: null, errore: null, caricamento: true });

  useEffect(() => {
    if (!url) return;
    let vivo = true;
    fetch(url)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.errore ?? "Errore di lettura");
        return j as T;
      })
      .then((dati) => vivo && setStato({ dati, errore: null, caricamento: false }))
      .catch(
        (e) => vivo && setStato((s) => ({ ...s, errore: e.message, caricamento: false }))
      );
    return () => {
      vivo = false;
    };
  }, [url, vaultVersion]);

  return stato;
}

/** Intestazione condivisa dei pannelli. */
export function TestataPannello({
  titolo,
  sotto,
  azioni,
}: {
  titolo: string;
  sotto?: string;
  azioni?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[24px] font-semibold leading-tight">{titolo}</h2>
        {sotto && (
          <p className="mt-1 text-[13px]" style={{ color: "var(--inchiostro-2)" }}>
            {sotto}
          </p>
        )}
      </div>
      {azioni}
    </header>
  );
}

export function VuotoCaldo({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="rounded-lg border border-dashed px-4 py-3 text-[13px]"
      style={{ borderColor: "var(--linea)", color: "var(--inchiostro-2)" }}
    >
      {children}
    </p>
  );
}

export function ChipNotaLink({
  rel,
  titolo,
  areaKey,
}: {
  rel: string;
  titolo: string;
  areaKey: string;
}) {
  const apriNota = useUI((s) => s.apriNota);
  return (
    <button type="button" className="chip-area hover:brightness-125" onClick={() => apriNota(rel)}>
      <i style={{ background: `var(--area-${areaKey}, var(--inchiostro-3))` }} aria-hidden />
      {titolo}
    </button>
  );
}

export function dataItaliana(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const mesi = [
    "gen", "feb", "mar", "apr", "mag", "giu",
    "lug", "ago", "set", "ott", "nov", "dic",
  ];
  if (!y || !m || !d) return iso;
  return `${d} ${mesi[m - 1]} ${y}`;
}

export function importoInValute(rec: Record<string, number>): string {
  const parti = Object.entries(rec).map(
    ([valuta, v]) =>
      `${v.toLocaleString("it-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${valuta}`
  );
  return parti.join(" + ") || "0";
}
