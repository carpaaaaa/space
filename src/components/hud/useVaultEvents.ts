"use client";

import { useEffect, useRef } from "react";
import { useUI } from "@/state/store";

/** Ascolta il watcher del vault via SSE e invalida i dati con debounce. */
export function useVaultEvents() {
  const bumpVault = useUI((s) => s.bumpVault);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (ev) => {
      try {
        const dati = JSON.parse(ev.data) as { tipo: string };
        if (dati.tipo === "hello") return;
      } catch {
        return;
      }
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => bumpVault(), 700);
    };
    return () => {
      es.close();
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [bumpVault]);
}
