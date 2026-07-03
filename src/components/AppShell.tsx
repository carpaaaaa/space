"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useUI } from "@/state/store";
import { NavRail } from "@/components/hud/NavRail";
import { TabBarMobile } from "@/components/hud/TabBarMobile";
import { FiltriGalassia } from "@/components/hud/FiltriGalassia";
import { CommandBar } from "@/components/hud/CommandBar";
import { NotaDrawer } from "@/components/NotaDrawer";
import { Pannelli } from "@/components/panels/Pannelli";
import { ConsoleAgente } from "@/components/ConsoleAgente";
import { useVaultEvents } from "@/components/hud/useVaultEvents";
import { applicaColoriAree, applicaTema, temaPerId } from "@/lib/temi";
import { inviaComando } from "@/lib/agenteClient";

const GalaxyCanvas = dynamic(() => import("@/components/galaxy/GalaxyCanvas"), {
  ssr: false,
});

const COMANDO_SMISTA =
  "Sistema l'inbox del vault: trova la nota degli appunti da smistare (es. 'Note da sistemare' " +
  "nella cartella inbox), smista ogni appunto nella nota giusta secondo le regole dei manuali del " +
  "vault (aggiorna note esistenti quando possibile, crea nuove note solo se servono), svuota solo " +
  "le voci effettivamente smistate e registra l'operazione nel log del vault.";

export function AppShell() {
  useVaultEvents();
  const pannello = useUI((s) => s.pannello);
  const temaId = useUI((s) => s.aspetto.tema);
  const galassia = useUI((s) => s.galassia);
  const setModelli = useUI((s) => s.setModelli);

  // tema -> token CSS
  useEffect(() => {
    applicaTema(temaPerId(temaId));
  }, [temaId]);

  // colori aree dal vault -> CSS var (--area-<key>), anche per vault generici
  useEffect(() => {
    if (galassia) applicaColoriAree(galassia.payload.aree);
  }, [galassia]);

  // modelli agente configurati
  useEffect(() => {
    fetch("/api/agent")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.modelli && setModelli(d.modelli))
      .catch(() => {});
  }, [setModelli]);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <GalaxyCanvas />

      {/* velo caldo che smorza la galassia: sta SOTTO la nav e la barra
          comandi (z-hud 10), sopra la galassia (z 0-1). Cosi il menu di sinistra
          resta cliccabile e puoi uscire dalla sezione. */}
      {pannello !== "galassia" && (
        <div
          className="absolute inset-0"
          style={{ background: "rgba(5, 6, 10, 0.55)", zIndex: 5 }}
          aria-hidden
        />
      )}

      <NavRail />
      <CommandBar agentePronto onComando={(testo) => inviaComando(testo)} />
      {pannello === "galassia" && <FiltriGalassia />}
      {pannello !== "galassia" && (
        <Pannelli agentePronto onSmista={() => inviaComando(COMANDO_SMISTA)} />
      )}
      <NotaDrawer />
      <ConsoleAgente />
      <TabBarMobile />
    </main>
  );
}
