"use client";

import { useState } from "react";
import type { TaskBuckets, TaskItem } from "@/lib/vault/tasks";
import type { ProgettoScheda } from "@/lib/vault/progetti";
import type { LogGiorno } from "@/lib/vault/logs";
import { useUI } from "@/state/store";
import { TestataPannello, VuotoCaldo, dataItaliana, useVaultJson } from "./comune";

function RigaTask({ t, oggi }: { t: TaskItem; oggi: string }) {
  const apriNota = useUI((s) => s.apriNota);
  const scaduta = t.due && t.due < oggi;
  return (
    <li
      className="flex items-baseline gap-3 border-b py-2 last:border-b-0"
      style={{ borderColor: "var(--linea)" }}
    >
      <span
        aria-hidden
        className="mt-[3px] h-[13px] w-[13px] flex-none self-center rounded-[3px] border"
        style={{ borderColor: "var(--linea-forte)" }}
      />
      <span className="min-w-0 flex-1 text-[13.5px] leading-snug">{t.testo}</span>
      {t.due && (
        <span
          className="mono flex-none text-[11px]"
          style={{ color: scaduta ? "var(--errore)" : "var(--inchiostro-2)" }}
        >
          {dataItaliana(t.due)}
        </span>
      )}
      <button
        type="button"
        onClick={() => apriNota(t.notaRel)}
        className="chip-area flex-none hover:brightness-125"
        title={t.notaRel}
      >
        <i style={{ background: `var(--area-${t.areaKey}, var(--inchiostro-3))` }} aria-hidden />
        {t.notaTitolo}
      </button>
    </li>
  );
}

function GruppoTask({
  titolo,
  task,
  oggi,
  vuoto,
}: {
  titolo: string;
  task: TaskItem[];
  oggi: string;
  vuoto: string;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-1.5 flex items-baseline gap-2 text-[13px] font-semibold">
        {titolo}
        <span className="mono text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
          {task.length}
        </span>
      </h3>
      {task.length === 0 ? (
        <VuotoCaldo>{vuoto}</VuotoCaldo>
      ) : (
        <ul>{task.map((t, i) => <RigaTask key={t.notaRel + i + t.testo} t={t} oggi={oggi} />)}</ul>
      )}
    </section>
  );
}

function QuickCapture() {
  const [testo, setTesto] = useState("");
  const [stato, setStato] = useState<"idle" | "invio" | "ok" | "errore">("idle");
  const [dettaglio, setDettaglio] = useState("");

  const invia = async () => {
    if (!testo.trim() || stato === "invio") return;
    setStato("invio");
    try {
      const r = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testo }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.errore ?? "Errore");
      setTesto("");
      setStato("ok");
      setDettaglio("Salvato in Note da sistemare e registrato nel log.");
    } catch (e) {
      setStato("errore");
      setDettaglio(e instanceof Error ? e.message : "Errore");
    }
  };

  return (
    <section
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--linea-forte)", background: "var(--superficie-2)" }}
    >
      <h3 className="text-[13px] font-semibold">Cattura veloce</h3>
      <p className="mt-0.5 text-[12px]" style={{ color: "var(--inchiostro-2)" }}>
        Un appunto grezzo per l&apos;inbox del vault. Lo smisti dopo.
      </p>
      <textarea
        value={testo}
        onChange={(e) => {
          setTesto(e.target.value);
          if (stato === "ok" || stato === "errore") setStato("idle");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) invia();
        }}
        rows={3}
        placeholder="es. 12chf pranzo · idea: wallpaper con grana… (⌘↵ per salvare)"
        className="mt-2.5 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-[13px] outline-none"
        style={{ borderColor: "var(--linea)" }}
        aria-label="Cattura veloce per l'inbox"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span
          className="text-[11.5px]"
          style={{ color: stato === "errore" ? "var(--errore)" : "var(--ok)" }}
          role="status"
        >
          {stato === "ok" || stato === "errore" ? dettaglio : ""}
        </span>
        <button
          type="button"
          onClick={invia}
          disabled={!testo.trim() || stato === "invio"}
          className="bottone-primario text-[12.5px]"
        >
          {stato === "invio" ? "Salvo…" : "Cattura"}
        </button>
      </div>
    </section>
  );
}

export function PannelloOggi() {
  const { dati: tasks } = useVaultJson<TaskBuckets>("/api/tasks");
  const { dati: progetti } = useVaultJson<ProgettoScheda[]>("/api/progetti");
  const { dati: logs } = useVaultJson<LogGiorno[]>("/api/logs?limit=2");
  const apriNota = useUI((s) => s.apriNota);
  const setPannello = useUI((s) => s.setPannello);

  const oggi = tasks?.oggiISO ?? "";
  const attivi = (progetti ?? []).filter((p) => p.stato === "attivo").slice(0, 6);
  const ultimoGiorno = logs?.[0];

  return (
    <div>
      <TestataPannello
        titolo="Obiettivi"
        sotto={`Il polso del vault · ${dataItaliana(oggi)}`}
      />
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          {tasks ? (
            <>
              <GruppoTask
                titolo="Scadute"
                task={tasks.scadute}
                oggi={oggi}
                vuoto="Nessuna task scaduta."
              />
              <GruppoTask
                titolo="Oggi"
                task={tasks.oggi}
                oggi={oggi}
                vuoto="Niente in scadenza oggi."
              />
              <GruppoTask
                titolo="Prossimi 7 giorni"
                task={tasks.prossimi7}
                oggi={oggi}
                vuoto="Settimana senza scadenze fissate."
              />
              <section className="mb-2">
                <h3 className="mb-1.5 flex items-baseline gap-2 text-[13px] font-semibold">
                  Senza data
                  <span className="mono text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
                    {tasks.senzaData.length}
                  </span>
                </h3>
                <ul>
                  {tasks.senzaData.slice(0, 8).map((t, i) => (
                    <RigaTask key={t.notaRel + i} t={t} oggi={oggi} />
                  ))}
                </ul>
                {tasks.senzaData.length > 8 && (
                  <p className="mt-2 text-[12px]" style={{ color: "var(--inchiostro-3)" }}>
                    e altre {tasks.senzaData.length - 8} nelle note.
                  </p>
                )}
              </section>
            </>
          ) : (
            <VuotoCaldo>Leggo le task dal vault…</VuotoCaldo>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <QuickCapture />

          <section>
            <h3 className="mb-2 text-[13px] font-semibold">Progetti attivi</h3>
            {attivi.length === 0 && <VuotoCaldo>Nessun progetto attivo.</VuotoCaldo>}
            <ul className="flex flex-col gap-1">
              {attivi.map((p) => (
                <li key={p.rel}>
                  <button
                    type="button"
                    onClick={() => apriNota(p.rel)}
                    className="flex w-full items-baseline gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-[color:var(--superficie-2)]"
                  >
                    <i
                      className="h-[8px] w-[8px] flex-none translate-y-[-1px] rounded-full"
                      style={{ background: `var(--area-${p.areaKey})` }}
                      aria-hidden
                    />
                    <span className="text-[13.5px] font-medium">{p.titolo}</span>
                    {p.nTaskAperte > 0 && (
                      <span className="mono text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
                        {p.nTaskAperte} task
                      </span>
                    )}
                    <span
                      className="mono ml-auto flex-none text-[10.5px]"
                      style={{ color: "var(--inchiostro-3)" }}
                    >
                      {dataItaliana(p.aggiornata ?? p.creata)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setPannello("progetti")}
              className="mt-2 text-[12px] underline-offset-2 hover:underline"
              style={{ color: "var(--oro-2)" }}
            >
              Tutti i progetti
            </button>
          </section>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold">
              Successo di recente
              {ultimoGiorno && (
                <span className="mono ml-2 text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
                  {dataItaliana(ultimoGiorno.data)}
                </span>
              )}
            </h3>
            {!ultimoGiorno && <VuotoCaldo>Nessun log ancora.</VuotoCaldo>}
            {ultimoGiorno && (
              <ul className="flex flex-col gap-2">
                {ultimoGiorno.entries.slice(-4).reverse().map((e, i) => (
                  <li key={i} className="flex gap-2.5 text-[12.5px] leading-snug">
                    <span className="mono flex-none text-[11px]" style={{ color: "var(--inchiostro-3)" }}>
                      {e.ora}
                    </span>
                    <span className="mono flex-none text-[11px]" style={{ color: "var(--oro-2)" }}>
                      {e.azione}
                    </span>
                    <span className="min-w-0" style={{ color: "var(--inchiostro-2)" }}>
                      {e.testo
                        .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t, a) => a || t)
                        .replace(/\*\*/g, "")
                        .slice(0, 140)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setPannello("log")}
              className="mt-2 text-[12px] underline-offset-2 hover:underline"
              style={{ color: "var(--oro-2)" }}
            >
              Timeline completa
            </button>
          </section>

          {(tasks?.completateRecenti.length ?? 0) > 0 && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold" style={{ color: "var(--inchiostro-2)" }}>
                Completate di recente
              </h3>
              <ul className="flex flex-col gap-1">
                {tasks!.completateRecenti.slice(0, 4).map((t, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-[12.5px]" style={{ color: "var(--inchiostro-3)" }}>
                    <span aria-hidden style={{ color: "var(--ok)" }}>✓</span>
                    <span className="line-through decoration-[rgba(176,167,149,.4)]">{t.testo}</span>
                    {t.fatta && <span className="mono ml-auto text-[10.5px]">{dataItaliana(t.fatta)}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
