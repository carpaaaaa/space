import chokidar, { FSWatcher } from "chokidar";
import path from "node:path";
import { vaultPath, CARTELLE_ESCLUSE } from "./config";

export interface VaultEvent {
  tipo: "add" | "change" | "unlink";
  rel: string;
  versione: number;
  ts: number;
}

type Listener = (e: VaultEvent) => void;

interface WatcherState {
  watcher: FSWatcher;
  versione: number;
  listeners: Set<Listener>;
}

// Singleton su globalThis: sopravvive all'HMR di Next in dev.
const G = globalThis as unknown as { __nucleoWatcher?: WatcherState };

function crea(): WatcherState {
  const root = vaultPath();
  const stato: WatcherState = {
    versione: 1,
    listeners: new Set(),
    watcher: chokidar.watch(root, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 350, pollInterval: 80 },
      ignored: (p: string) => {
        const rel = path.relative(root, p);
        if (rel.startsWith("..")) return false;
        const top = rel.split(path.sep)[0];
        // graph.json vive sotto 08_AI: resta osservato.
        if (CARTELLE_ESCLUSE.has(top) && top !== "_Templates") return true;
        if (top === "_Templates") return true;
        return false;
      },
    }),
  };

  const emetti = (tipo: VaultEvent["tipo"]) => (assoluto: string) => {
    if (!assoluto.endsWith(".md") && !assoluto.endsWith(".json")) return;
    stato.versione += 1;
    const e: VaultEvent = {
      tipo,
      rel: path.relative(root, assoluto),
      versione: stato.versione,
      ts: Date.now(),
    };
    for (const l of stato.listeners) {
      try {
        l(e);
      } catch {
        // un listener rotto non deve fermare gli altri
      }
    }
  };

  stato.watcher.on("add", emetti("add"));
  stato.watcher.on("change", emetti("change"));
  stato.watcher.on("unlink", emetti("unlink"));
  return stato;
}

function stato(): WatcherState {
  if (!G.__nucleoWatcher) G.__nucleoWatcher = crea();
  return G.__nucleoWatcher;
}

/** Versione corrente del vault: cresce a ogni modifica su disco. */
export function vaultVersion(): number {
  return stato().versione;
}

export function onVaultEvent(fn: Listener): () => void {
  const s = stato();
  s.listeners.add(fn);
  return () => s.listeners.delete(fn);
}

/**
 * Memo per-modulo invalidata dalla versione del vault.
 * Le build concorrenti condividono la stessa promise.
 */
export function memoPerVersione<T>(build: () => Promise<T>): () => Promise<T> {
  let memo: { versione: number; value: Promise<T> } | null = null;
  return () => {
    const v = vaultVersion();
    if (!memo || memo.versione !== v) {
      memo = { versione: v, value: build() };
      memo.value.catch(() => {
        // una build fallita non resta in cache
        if (memo && memo.versione === v) memo = null;
      });
    }
    return memo.value;
  };
}
