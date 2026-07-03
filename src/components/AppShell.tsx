"use client";

import dynamic from "next/dynamic";
import { useUI } from "@/state/store";
import { NavRail } from "@/components/hud/NavRail";
import { FiltriGalassia } from "@/components/hud/FiltriGalassia";
import { CommandBar } from "@/components/hud/CommandBar";
import { NotaDrawer } from "@/components/NotaDrawer";
import { Pannelli } from "@/components/panels/Pannelli";
import { ConsoleAgente } from "@/components/ConsoleAgente";
import { useVaultEvents } from "@/components/hud/useVaultEvents";
import { inviaComando } from "@/lib/agenteClient";

const GalaxyCanvas = dynamic(() => import("@/components/galaxy/GalaxyCanvas"), {
  ssr: false,
});

const COMANDO_SMISTA =
  "Sistema l'inbox: leggi 00_INBOX/Note da sistemare.md, smista ogni appunto nella nota giusta " +
  "secondo le regole del vault (aggiorna note esistenti quando possibile, crea nuove note solo se " +
  "servono), registra le spese nelle tabelle di 02_FINANZE, lascia traccia in Note sistemate, " +
  "svuota solo le voci smistate e logga tutto.";

export function AppShell() {
  useVaultEvents();
  const pannello = useUI((s) => s.pannello);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <GalaxyCanvas />

      {/* velo caldo quando un pannello copre la galassia */}
      {pannello !== "galassia" && (
        <div
          className="absolute inset-0"
          style={{ background: "rgba(5, 6, 10, 0.55)", zIndex: "calc(var(--z-pannello) - 1)" }}
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
    </main>
  );
}
