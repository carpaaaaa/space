"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/state/store";
import { TestataPannello, VuotoCaldo, useVaultJson } from "./comune";

/**
 * Il pannello Skills: tutte le ricette del vault in un posto solo.
 * Le proposte della fucina in testa, poi le attive e quelle in pausa,
 * in coda le note scartate col motivo. Stato sempre come testo.
 */

interface SkillRiga {
  rel: string;
  nome: string;
  stato: "proposta" | "attiva" | "pausa";
  trigger: Array<"comando" | "ogni" | "evento">;
  comando?: string;
  ogni?: string;
  evento?: string;
  dove?: string;
  output?: string;
  descrizione?: string;
  motivazione?: string;
  ultimaEsecuzione?: string;
  esito?: "ok" | "errore";
  estratto: string;
}

/** Risultato di una skill: la nota che mantiene, resa inline nel pannello. */
function RisultatoSkill({ rel }: { rel: string }) {
  const vaultVersion = useUI((s) => s.vaultVersion);
  const [html, setHtml] = useState<string | null>(null);
  const [stato, setStato] = useState<"carico" | "vuoto" | "pronto" | "errore">("carico");

  useEffect(() => {
    let vivo = true;
    setStato("carico");
    fetch(`/api/note?rel=${encodeURIComponent(rel)}`)
      .then(async (r) => {
        if (r.status === 404) return { _vuoto: true };
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: { html?: string; _vuoto?: boolean }) => {
        if (!vivo) return;
        if (d._vuoto) setStato("vuoto");
        else {
          setHtml(d.html ?? "");
          setStato("pronto");
        }
      })
      .catch(() => vivo && setStato("errore"));
    return () => {
      vivo = false;
    };
  }, [rel, vaultVersion]);

  if (stato === "carico") {
    return (
      <p className="text-[12.5px]" style={{ color: "var(--inchiostro-3)" }}>
        Leggo il risultato
      </p>
    );
  }
  if (stato === "vuoto") {
    return (
      <p className="text-[12.5px]" style={{ color: "var(--inchiostro-2)" }}>
        Non ancora generato. Premi &quot;Esegui ora&quot; qui sopra: appena finisce,
        compare qui.
      </p>
    );
  }
  if (stato === "errore") {
    return (
      <p className="text-[12.5px]" style={{ color: "var(--errore)" }}>
        Non riesco a leggere {rel}.
      </p>
    );
  }
  return (
    <article
      className="prosa max-h-[340px] overflow-y-auto text-[13.5px]"
      dangerouslySetInnerHTML={{ __html: html ?? "" }}
    />
  );
}

interface RispostaSkills {
  skills: SkillRiga[];
  scartate: Array<{ rel: string; motivo: string }>;
  runner: { inEsecuzione: string | null; inCoda: number; runOggi: number; saltatiOggi: number };
}

const COLORE_STATO: Record<SkillRiga["stato"], string> = {
  proposta: "var(--oro-2)",
  attiva: "var(--ok)",
  pausa: "var(--inchiostro-3)",
};

const ORDINE_STATO: Record<SkillRiga["stato"], number> = {
  proposta: 0,
  attiva: 1,
  pausa: 2,
};

function descriviTrigger(s: SkillRiga): string {
  const parti: string[] = [];
  if (s.trigger.includes("comando") && s.comando) parti.push(`/${s.comando}`);
  if (s.trigger.includes("ogni") && s.ogni) {
    parti.push(s.ogni.includes(" ") ? `ogni ${s.ogni}` : `ogni giorno ${s.ogni}`);
  }
  if (s.trigger.includes("evento") && s.dove) parti.push(`su nuova nota in ${s.dove}`);
  return parti.join(" · ") || "manuale";
}

export function PannelloSkills() {
  const { dati, errore, caricamento } = useVaultJson<RispostaSkills>("/api/skills");
  const apriNota = useUI((s) => s.apriNota);
  // rel -> feedback transitorio dopo un'azione ("in coda", "salvata")
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  // accordion: un solo risultato aperto alla volta (null = nessuno)
  const [apertoRel, setApertoRel] = useState<string | null>(null);

  const azione = async (rel: string, corpo: Record<string, string>, nota: string) => {
    try {
      const r = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rel, ...corpo }),
      });
      const j = (await r.json()) as { ok?: boolean; motivo?: string; errore?: string };
      // per "esegui" il runner spiega sempre l'esito (in esecuzione, gia' in
      // coda, limite...): non e' un errore, e' informazione. Per "stato" uso
      // il messaggio passato dal chiamante.
      setFeedback((f) => ({
        ...f,
        [rel]: j.motivo ?? (r.ok && j.ok !== false ? nota : j.errore ?? "non riuscita"),
      }));
    } catch {
      setFeedback((f) => ({ ...f, [rel]: "non riuscita" }));
    }
    setTimeout(() => setFeedback((f) => ({ ...f, [rel]: "" })), 5000);
  };

  const esegui = (s: SkillRiga) => azione(s.rel, { azione: "esegui" }, "in esecuzione");

  const skills = [...(dati?.skills ?? [])].sort(
    (a, b) => ORDINE_STATO[a.stato] - ORDINE_STATO[b.stato] || a.nome.localeCompare(b.nome)
  );

  return (
    <div>
      <TestataPannello
        titolo="Skills"
        sotto="Le ricette del vault: la fucina le propone, tu le attivi, space le esegue."
      />

      {caricamento && (
        <p className="text-[13px]" style={{ color: "var(--inchiostro-2)" }}>
          Leggo le skill dal vault
        </p>
      )}
      {errore && (
        <p className="text-[13px]" style={{ color: "var(--errore)" }}>
          {errore}
        </p>
      )}

      {dati && skills.length === 0 && (
        <VuotoCaldo>
          Nessuna skill ancora. Lancia /osserva dalla barra comandi: l&apos;osservatorio
          legge il vault e ti propone le prime.
        </VuotoCaldo>
      )}

      <ul className="flex flex-col gap-2.5">
        {skills.map((s) => {
          const proposta = s.stato === "proposta";
          return (
            <li
              key={s.rel}
              className="rounded-lg border px-4 py-3"
              style={{
                borderColor: proposta ? "var(--linea-forte)" : "var(--linea)",
                background: proposta ? "rgba(255, 217, 138, 0.04)" : "transparent",
              }}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[14.5px] font-semibold">{s.nome}</span>
                <span className="mono text-[11.5px]" style={{ color: "var(--inchiostro-2)" }}>
                  {descriviTrigger(s)}
                </span>
                <span
                  className="text-[11.5px] font-semibold"
                  style={{ color: COLORE_STATO[s.stato] }}
                >
                  {s.stato}
                </span>
                {dati?.runner.inEsecuzione === s.rel ? (
                  <span className="mono ml-auto text-[11px]" style={{ color: "var(--oro-2)" }}>
                    in esecuzione…
                  </span>
                ) : (
                  s.ultimaEsecuzione && (
                    <span
                      className="mono ml-auto text-[11px]"
                      style={{
                        color: s.esito === "errore" ? "var(--errore)" : "var(--inchiostro-3)",
                      }}
                    >
                      {s.ultimaEsecuzione}
                      {s.esito ? ` · ${s.esito}` : ""}
                    </span>
                  )
                )}
              </div>

              {s.descrizione && (
                <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--inchiostro)" }}>
                  {s.descrizione}
                </p>
              )}
              {proposta && s.motivazione && (
                <p className="mt-1 text-[12px]" style={{ color: "var(--inchiostro-3)" }}>
                  Perché te la propongo: {s.motivazione}
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {s.stato !== "attiva" && (
                  <button
                    type="button"
                    className="bottone-secondario text-[12px]"
                    onClick={() => azione(s.rel, { azione: "stato", stato: "attiva" }, "attivata")}
                  >
                    Attiva
                  </button>
                )}
                {s.stato === "attiva" && (
                  <button
                    type="button"
                    className="bottone-secondario text-[12px]"
                    onClick={() => azione(s.rel, { azione: "stato", stato: "pausa" }, "in pausa")}
                  >
                    Pausa
                  </button>
                )}
                <button
                  type="button"
                  className="bottone-secondario text-[12px]"
                  onClick={() => esegui(s)}
                >
                  Esegui ora
                </button>
                {s.output && (
                  <button
                    type="button"
                    className="bottone-secondario text-[12px]"
                    aria-expanded={apertoRel === s.rel}
                    onClick={() => setApertoRel((r) => (r === s.rel ? null : s.rel))}
                  >
                    {apertoRel === s.rel ? "Nascondi risultato" : "Risultato"}
                  </button>
                )}
                <button
                  type="button"
                  className="bottone-secondario text-[12px]"
                  onClick={() => apriNota(s.rel)}
                >
                  Apri skill
                </button>
                {feedback[s.rel] && (
                  <span className="text-[12px]" style={{ color: "var(--inchiostro-2)" }}>
                    {feedback[s.rel]}
                  </span>
                )}
              </div>

              {s.output && apertoRel === s.rel && (
                <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--linea)" }}>
                  <RisultatoSkill rel={s.output} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {dati && dati.scartate.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[13px] font-semibold" style={{ color: "var(--inchiostro-2)" }}>
            Note scartate
          </h3>
          <ul className="flex flex-col gap-1.5">
            {dati.scartate.map((sc) => (
              <li key={sc.rel} className="flex items-baseline gap-2.5 text-[12.5px]">
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  style={{ color: "var(--inchiostro-2)" }}
                  onClick={() => apriNota(sc.rel)}
                >
                  {sc.rel}
                </button>
                <span style={{ color: "var(--errore)" }}>{sc.motivo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dati && (
        <p className="mono mt-6 text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
          oggi {dati.runner.runOggi} run automatici · {dati.runner.inCoda} in coda
          {dati.runner.saltatiOggi > 0 ? ` · ${dati.runner.saltatiOggi} oltre il limite` : ""}
          {dati.runner.inEsecuzione ? " · una skill in esecuzione" : ""}
        </p>
      )}

      {/* spazio per non restare sotto la command bar ancorata in basso a destra */}
      <div className="h-20" aria-hidden />
    </div>
  );
}
