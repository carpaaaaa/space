"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUI } from "@/state/store";

interface Suggerimento {
  rel: string;
  titolo: string;
  areaKey: string;
  tipo?: string;
  estratto: string;
}

/**
 * La command bar del nucleo: cerca nel vault e vola alle stelle.
 * Dalla fase agente, il testo libero diventa un comando per Claude.
 */
export function CommandBar({
  onComando,
  agentePronto = false,
}: {
  onComando?: (testo: string) => void;
  agentePronto?: boolean;
}) {
  const [testo, setTesto] = useState("");
  const [suggerimenti, setSuggerimenti] = useState<Suggerimento[]>([]);
  const [attivo, setAttivo] = useState(-1);
  const [aperta, setAperta] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const galassia = useUI((s) => s.galassia);
  const vola = useUI((s) => s.vola);
  const apriNota = useUI((s) => s.apriNota);
  const setSelezione = useUI((s) => s.setSelezione);

  // scorciatoia globale: premi / o cmd+k per cercare
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inCampo =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;
      if ((e.key === "/" && !inCampo) || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape") {
        setAperta(false);
        input.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!testo.trim()) return;
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?mode=local&q=${encodeURIComponent(testo)}`);
        const dati = (await res.json()) as Suggerimento[];
        setSuggerimenti(Array.isArray(dati) ? dati.slice(0, 6) : []);
        setAttivo(-1);
      } catch {
        setSuggerimenti([]);
      }
    }, 180);
  }, [testo]);

  const volaANota = useCallback(
    (s: Suggerimento) => {
      setTesto("");
      setSuggerimenti([]);
      setAperta(false);
      apriNota(s.rel);
      const idx = galassia?.relToIdx.get(s.rel);
      if (idx != null) {
        setSelezione(idx);
        vola(idx);
      }
    },
    [galassia, apriNota, vola, setSelezione]
  );

  const invia = () => {
    if (attivo >= 0 && suggerimenti[attivo]) {
      volaANota(suggerimenti[attivo]);
      return;
    }
    const t = testo.trim();
    if (!t) return;
    if (agentePronto && onComando) {
      onComando(t);
      setTesto("");
      setSuggerimenti([]);
      setAperta(false);
    } else if (suggerimenti[0]) {
      volaANota(suggerimenti[0]);
    }
  };

  return (
    <div
      className="absolute left-1/2 top-5 w-[min(560px,86vw)] -translate-x-1/2"
      style={{ zIndex: "var(--z-hud)" }}
    >
      <div
        className="pannello-superficie flex items-center gap-3 px-4"
        style={{ borderColor: aperta ? "var(--linea-forte)" : "var(--linea)" }}
      >
        <span aria-hidden className="text-[13px]" style={{ color: "var(--oro-2)" }}>
          ✦
        </span>
        <input
          ref={input}
          value={testo}
          onChange={(e) => {
            const v = e.target.value;
            setTesto(v);
            setAperta(true);
            if (!v.trim()) {
              setSuggerimenti([]);
              setAttivo(-1);
            }
          }}
          onFocus={() => setAperta(true)}
          onBlur={() => setTimeout(() => setAperta(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAttivo((a) => Math.min(a + 1, suggerimenti.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAttivo((a) => Math.max(a - 1, -1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              invia();
            }
          }}
          placeholder={
            agentePronto
              ? "Cerca una stella o dai un comando all'agente…"
              : "Cerca nel vault… (/)"
          }
          aria-label="Command bar del nucleo"
          className="h-11 w-full bg-transparent text-[14px] outline-none placeholder:text-[color:var(--inchiostro-3)]"
        />
        <kbd
          className="mono rounded border px-1.5 py-0.5 text-[10px]"
          style={{ borderColor: "var(--linea)", color: "var(--inchiostro-3)" }}
        >
          ⌘K
        </kbd>
      </div>

      {aperta && suggerimenti.length > 0 && (
        <ul className="pannello-superficie mt-1.5 overflow-hidden py-1" role="listbox">
          {suggerimenti.map((s, i) => (
            <li key={s.rel} role="option" aria-selected={i === attivo}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  volaANota(s);
                }}
                onMouseEnter={() => setAttivo(i)}
                className="flex w-full items-baseline gap-2.5 px-4 py-2 text-left transition-colors duration-100"
                style={{ background: i === attivo ? "var(--superficie-2)" : "transparent" }}
              >
                <span
                  className="h-[7px] w-[7px] flex-none translate-y-[-1px] rounded-full"
                  style={{ background: `var(--area-${s.areaKey}, var(--inchiostro-3))` }}
                  aria-hidden
                />
                <span className="text-[13.5px] font-medium">{s.titolo}</span>
                <span className="truncate text-[11.5px]" style={{ color: "var(--inchiostro-3)" }}>
                  {s.estratto}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
