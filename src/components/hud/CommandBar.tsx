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

interface SkillSlash {
  comando: string;
  nome: string;
  motivazione?: string;
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
  const [skillsSlash, setSkillsSlash] = useState<SkillSlash[]>([]);
  const [attivo, setAttivo] = useState(-1);
  const [aperta, setAperta] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vaultVersion = useUI((s) => s.vaultVersion);

  const galassia = useUI((s) => s.galassia);
  const vola = useUI((s) => s.vola);
  const apriNota = useUI((s) => s.apriNota);
  const setSelezione = useUI((s) => s.setSelezione);
  const modelli = useUI((s) => s.modelli);
  const modelloScelto = useUI((s) => s.modelloScelto);
  const setModelloScelto = useUI((s) => s.setModelloScelto);

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

  // le skill del vault che rispondono a /slug (attive, trigger comando)
  useEffect(() => {
    if (!agentePronto) return;
    let vivo = true;
    fetch("/api/skills")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { skills?: Array<SkillSlash & { stato: string; trigger: string[] }> } | null) => {
        if (!vivo || !d?.skills) return;
        setSkillsSlash(
          d.skills.filter(
            (s) => s.stato === "attiva" && s.trigger.includes("comando") && s.comando
          )
        );
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [agentePronto, vaultVersion]);

  const inSlash = testo.startsWith("/") && testo.length > 0;
  const slashFiltrate = inSlash
    ? skillsSlash.filter((s) => s.comando.startsWith(testo.slice(1).split(/\s/)[0]))
    : [];

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    // in slash-mode la lista note non e renderizzata: inutile fetchare
    if (!testo.trim() || testo.startsWith("/")) return;
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

  const lanciaSkill = (slug: string) => {
    if (!onComando) return;
    // conserva l'eventuale argomento digitato dopo lo slug
    const arg = testo.slice(1).split(/\s+/).slice(1).join(" ");
    onComando("/" + slug + (arg ? " " + arg : ""));
    setTesto("");
    setAperta(false);
    setAttivo(-1);
  };

  const invia = () => {
    if (inSlash) {
      const scelta = attivo >= 0 ? slashFiltrate[attivo] : slashFiltrate[0];
      if (scelta) {
        lanciaSkill(scelta.comando);
      } else if (agentePronto && onComando) {
        onComando(testo.trim()); // slug libero: il server rispondera 404 se non esiste
        setTesto("");
        setAperta(false);
      }
      return;
    }
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
              const n = inSlash ? slashFiltrate.length : suggerimenti.length;
              setAttivo((a) => Math.min(a + 1, n - 1));
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
          aria-label="Barra comandi"
          className="h-11 w-full bg-transparent text-[14px] outline-none placeholder:text-[color:var(--inchiostro-3)]"
        />
        {agentePronto && modelli.length > 0 && (
          <select
            value={modelloScelto ?? modelli[0].id}
            onChange={(e) => setModelloScelto(e.target.value)}
            aria-label="Modello dell'agente"
            title="Modello usato per i comandi all'agente"
            className="mono max-w-[150px] flex-none cursor-pointer rounded border bg-transparent px-1.5 py-0.5 text-[10.5px] outline-none"
            style={{ borderColor: "var(--linea)", color: "var(--inchiostro-2)" }}
          >
            {modelli.map((m) => (
              <option key={m.id} value={m.id} style={{ background: "var(--superficie)" }}>
                {m.etichetta}
              </option>
            ))}
          </select>
        )}
        <kbd
          className="mono rounded border px-1.5 py-0.5 text-[10px] max-md:hidden"
          style={{ borderColor: "var(--linea)", color: "var(--inchiostro-3)" }}
        >
          ⌘K
        </kbd>
      </div>

      {aperta && inSlash && slashFiltrate.length > 0 && (
        <ul className="pannello-superficie mt-1.5 overflow-hidden py-1" role="listbox">
          {slashFiltrate.map((s, i) => (
            <li key={s.comando} role="option" aria-selected={i === attivo}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  lanciaSkill(s.comando);
                }}
                onMouseEnter={() => setAttivo(i)}
                className="flex w-full items-baseline gap-2.5 px-4 py-2 text-left transition-colors duration-100"
                style={{ background: i === attivo ? "var(--superficie-2)" : "transparent" }}
              >
                <span className="mono text-[12px]" style={{ color: "var(--oro-2)" }}>
                  /{s.comando}
                </span>
                <span className="text-[13px] font-medium">{s.nome}</span>
                {s.motivazione && (
                  <span
                    className="truncate text-[11.5px]"
                    style={{ color: "var(--inchiostro-3)" }}
                  >
                    {s.motivazione}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aperta && !inSlash && suggerimenti.length > 0 && (
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
