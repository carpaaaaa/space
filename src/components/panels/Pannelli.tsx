"use client";

import { useUI } from "@/state/store";
import { PannelloOggi } from "./PannelloOggi";
import { PannelloProgetti } from "./PannelloProgetti";
import { PannelloFinanze } from "./PannelloFinanze";
import { PannelloInbox } from "./PannelloInbox";
import { PannelloLog } from "./PannelloLog";
import { PannelloRicerca } from "./PannelloRicerca";

/** Contenitore dei pannelli operativi sopra la galassia. */
export function Pannelli({
  onSmista,
  agentePronto = false,
}: {
  onSmista?: () => void;
  agentePronto?: boolean;
}) {
  const pannello = useUI((s) => s.pannello);

  return (
    <section
      key={pannello}
      className="pannello-enter pointer-events-none absolute bottom-5 left-[200px] right-5 top-[72px] max-md:inset-x-2 max-md:bottom-[64px] max-md:top-[64px]"
      style={{ zIndex: "var(--z-pannello)" }}
      aria-label={`Pannello ${pannello}`}
    >
      <div className="pannello-superficie pointer-events-auto h-full overflow-y-auto px-7 py-6 max-md:px-4">
        {pannello === "oggi" && <PannelloOggi />}
        {pannello === "progetti" && <PannelloProgetti />}
        {pannello === "finanze" && <PannelloFinanze />}
        {pannello === "inbox" && (
          <PannelloInbox onSmista={onSmista} agentePronto={agentePronto} />
        )}
        {pannello === "log" && <PannelloLog />}
        {pannello === "ricerca" && <PannelloRicerca />}
      </div>
    </section>
  );
}
