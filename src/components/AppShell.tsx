"use client";

import dynamic from "next/dynamic";
import { useUI } from "@/state/store";
import { NavRail } from "@/components/hud/NavRail";
import { FiltriGalassia } from "@/components/hud/FiltriGalassia";
import { CommandBar } from "@/components/hud/CommandBar";
import { NotaDrawer } from "@/components/NotaDrawer";
import { Pannelli } from "@/components/panels/Pannelli";
import { useVaultEvents } from "@/components/hud/useVaultEvents";

const GalaxyCanvas = dynamic(() => import("@/components/galaxy/GalaxyCanvas"), {
  ssr: false,
});

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
      <CommandBar />
      {pannello === "galassia" && <FiltriGalassia />}
      {pannello !== "galassia" && <Pannelli />}
      <NotaDrawer />
    </main>
  );
}
