"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Galassia, caricaGalassia } from "@/lib/galassia";
import { useUI } from "@/state/store";
import { ControlliCamera } from "./camera";
import { Filamenti } from "./filamenti";
import { Picker } from "./picker";
import { Nucleo, PolvereBracci, SfondoAmbientale, StratoStelle } from "./strati";
import { EtichetteOverlay, MappaEtichette, PonteEtichette, TooltipStella } from "./etichette";

function useReducedMotion(): boolean {
  const [ridotto, setRidotto] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = (e: MediaQueryListEvent) => setRidotto(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return ridotto;
}

export default function GalaxyCanvas() {
  const [g, setG] = useState<Galassia | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const filtriVersione = useUI((s) => s.filtriVersione);
  const vaultVersion = useUI((s) => s.vaultVersion);
  const ridotto = useReducedMotion();
  const etichetteRefs = useRef<MappaEtichette>(new Map());

  // caricamento (e ricaricamento quando il vault cambia su disco)
  const setGalassia = useUI((s) => s.setGalassia);
  const inGalassia = useUI((s) => s.pannello === "galassia");
  useEffect(() => {
    let vivo = true;
    caricaGalassia()
      .then((dati) => {
        if (vivo) {
          setG(dati);
          setGalassia(dati);
          setErrore(null);
        }
      })
      .catch((e) => vivo && setErrore(e.message));
    return () => {
      vivo = false;
    };
  }, [vaultVersion, setGalassia]);

  const conteggi = useMemo(() => g?.payload.conteggi, [g]);

  return (
    <div className="absolute inset-0">
      {g && (
        <Canvas
          dpr={[1, 2]}
          camera={{ fov: 55, near: 0.5, far: 2400, position: [4, 210, 290] }}
          gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
          style={{ position: "absolute", inset: 0 }}
        >
          <ControlliCamera g={g} ridotto={ridotto} />
          <SfondoAmbientale />
          <PolvereBracci />
          <Nucleo ridotto={ridotto} />
          {/* stelle principali: note, concetti, documenti */}
          <StratoStelle
            g={g}
            indici={g.idxPrincipali}
            alpha={1}
            scala={2.2}
            filtriVersione={filtriVersione}
          />
          {/* micro-stelle sezione: emergono avvicinandosi */}
          <StratoStelle
            g={g}
            indici={g.idxSezioni}
            alpha={0.75}
            scala={1.9}
            lod={[36, 120]}
            filtriVersione={filtriVersione}
          />
          {/* alone dei gap in periferia */}
          <StratoStelle
            g={g}
            indici={g.idxGap}
            alpha={0.55}
            scala={1.7}
            filtriVersione={filtriVersione}
          />
          {/* corsie di polvere: blending normale, occludono */}
          <StratoStelle
            g={g}
            indici={g.idxPolvere}
            alpha={0.5}
            scala={3.6}
            additive={false}
            filtriVersione={filtriVersione}
          />
          <Filamenti g={g} />
          <Picker g={g} />
          <PonteEtichette g={g} refs={etichetteRefs} />
        </Canvas>
      )}

      {g && inGalassia && <EtichetteOverlay g={g} refs={etichetteRefs} />}
      {g && inGalassia && <TooltipStella g={g} />}

      {!g && !errore && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="text-[13px]" style={{ color: "var(--inchiostro-2)" }}>
            Leggo il vault e accendo la galassia
          </p>
        </div>
      )}
      {errore && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="pannello-superficie max-w-md px-5 py-4 text-[13.5px]">
            <p className="font-semibold" style={{ color: "var(--errore)" }}>
              La galassia non si accende
            </p>
            <p className="mt-1" style={{ color: "var(--inchiostro-2)" }}>
              {errore}. Controlla MIND_VAULT_PATH e che il vault esista.
            </p>
          </div>
        </div>
      )}

      {conteggi && inGalassia && (
        <div
          className="mono pointer-events-none absolute bottom-3 right-4 text-[10.5px]"
          style={{ color: "var(--inchiostro-3)", zIndex: "var(--z-hud)" }}
        >
          {conteggi.note} note · {conteggi.concetti} concetti · {conteggi.sezioni} sezioni ·{" "}
          {conteggi.gap} gap · {conteggi.edges} filamenti
        </div>
      )}
    </div>
  );
}
