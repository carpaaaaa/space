import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { query, type PermissionResult, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import {
  fileProtetti,
  getAree,
  modelliAgente,
  vaultPath,
  type ModelloAgente,
} from "@/lib/vault/config";
import { systemPromptAgente } from "./prompt";
import { eseguiOpenAI } from "./openai";

const execFileAsync = promisify(execFile);

/**
 * Layer agente di space.
 * - provider "claude": Claude Agent SDK (login Claude Code, setup-token o API key)
 * - provider "openai": endpoint OpenAI-compatibile (Ollama/Hermes, LM Studio...)
 * - in entrambi i casi: cwd nel vault, strumenti file-only, scritture sensibili
 *   con conferma diff (ask-first), eventi NDJSON identici.
 */

export type RigaDiff = { k: "+" | "-" | " "; testo: string };

export type EventoAgente =
  | { t: "init"; sessione: string; modello: string }
  | { t: "testo"; testo: string }
  | { t: "tool"; nome: string; descr: string }
  | {
      t: "permesso";
      id: string;
      titolo: string;
      percorso: string;
      motivo: string;
      diff: RigaDiff[];
    }
  | { t: "permesso_esito"; id: string; esito: "allow" | "deny" }
  | { t: "scrittura"; percorso: string; azione: "crea" | "modifica" }
  | { t: "fine"; ok: boolean; durataMs?: number; costoUsd?: number; risultato?: string }
  | { t: "errore"; messaggio: string };

export type Emit = (e: EventoAgente) => void;

interface PermessoPendente {
  resolve: (esito: { esito: "allow" | "deny"; messaggio?: string }) => void;
}

interface StatoAgente {
  occupato: boolean;
  permessi: Map<string, PermessoPendente>;
  ultimaSessione: string | null;
  abortCorrente: AbortController | null;
}

const G = globalThis as unknown as { __spaceAgente?: StatoAgente };
function stato(): StatoAgente {
  if (!G.__spaceAgente) {
    G.__spaceAgente = {
      occupato: false,
      permessi: new Map(),
      ultimaSessione: null,
      abortCorrente: null,
    };
  }
  return G.__spaceAgente;
}

export function agenteOccupato(): boolean {
  return stato().occupato;
}

export function ultimaSessione(): string | null {
  return stato().ultimaSessione;
}

export function risolviPermesso(
  id: string,
  esito: "allow" | "deny",
  messaggio?: string
): boolean {
  const p = stato().permessi.get(id);
  if (!p) return false;
  stato().permessi.delete(id);
  p.resolve({ esito, messaggio });
  return true;
}

/* ------------------------------------------------------------------ */
/* Credenziali Claude                                                  */
/* ------------------------------------------------------------------ */

async function credenzialiClaude(): Promise<boolean> {
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN) return true;
  if (process.platform !== "darwin") return false;
  for (const servizio of ["Claude Code-credentials", "Claude Code"]) {
    try {
      const { stdout } = await execFileAsync(
        "security",
        ["find-generic-password", "-s", servizio, "-w"],
        { timeout: 4000 }
      );
      const dati = JSON.parse(stdout.trim()) as { claudeAiOauth?: { accessToken?: string } };
      if (dati.claudeAiOauth?.accessToken) return true;
    } catch {
      // item assente o non leggibile: si prova il prossimo
    }
  }
  return false;
}

const MESSAGGIO_SETUP = [
  "L'agente Claude non ha credenziali su questa macchina. Serve un passo una-tantum:",
  "1) col tuo abbonamento Claude: esegui `claude setup-token` nel Terminale e incolla il token in .env.local (nella cartella di space) come CLAUDE_CODE_OAUTH_TOKEN=... (se la CLI manca: npm i -g @anthropic-ai/claude-code, poi claude /login);",
  "2) in alternativa: metti ANTHROPIC_API_KEY=sk-ant-... in .env.local.",
  "Poi riavvia space. In alternativa configura un modello locale (Ollama/Hermes) in space.config.json: non richiede credenziali.",
].join("\n");

/* ------------------------------------------------------------------ */
/* Diff a righe (LCS semplice, file di note: dimensioni piccole)       */
/* ------------------------------------------------------------------ */

export function diffRighe(vecchio: string, nuovo: string, max = 400): RigaDiff[] {
  const a = vecchio.split("\n").slice(0, 1500);
  const b = nuovo.split("\n").slice(0, 1500);
  const n = a.length;
  const m = b.length;
  const dp: number[] = new Array((n + 1) * (m + 1)).fill(0);
  const idx = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[idx(i, j)] =
        a[i] === b[j]
          ? dp[idx(i + 1, j + 1)] + 1
          : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
    }
  }
  const righe: RigaDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      righe.push({ k: " ", testo: a[i] });
      i++;
      j++;
    } else if (dp[idx(i + 1, j)] >= dp[idx(i, j + 1)]) {
      righe.push({ k: "-", testo: a[i] });
      i++;
    } else {
      righe.push({ k: "+", testo: b[j] });
      j++;
    }
  }
  while (i < n) righe.push({ k: "-", testo: a[i++] });
  while (j < m) righe.push({ k: "+", testo: b[j++] });

  // comprimi il contesto invariato lontano dalle modifiche
  const compresse: RigaDiff[] = [];
  for (let k = 0; k < righe.length; k++) {
    const r = righe[k];
    if (r.k === " ") {
      const vicina = righe.slice(Math.max(0, k - 2), k + 3).some((x) => x.k !== " ");
      if (!vicina) {
        if (compresse[compresse.length - 1]?.testo !== "…") {
          compresse.push({ k: " ", testo: "…" });
        }
        continue;
      }
    }
    compresse.push(r);
  }
  return compresse.slice(0, max);
}

/* ------------------------------------------------------------------ */
/* Regole ask-first (da space.config.json, con default sensati)        */
/* ------------------------------------------------------------------ */

function classificaScrittura(rel: string, contenutoNuovo: string | undefined): {
  decisione: "allow" | "ask" | "deny";
  motivo: string;
} {
  const top = rel.split("/")[0];
  if (rel.startsWith("..")) {
    return { decisione: "deny", motivo: "Percorso fuori dal vault" };
  }
  if (top.startsWith(".")) {
    return { decisione: "deny", motivo: "Configurazione del vault: fuori dal perimetro dell'agente" };
  }
  if (/^(attachments?|allegati|assets)$/i.test(top)) {
    return { decisione: "ask", motivo: "Gli allegati non si toccano senza conferma esplicita" };
  }
  if (fileProtetti().has(rel)) {
    return { decisione: "ask", motivo: "Manuale operativo degli agenti: serve conferma" };
  }
  const area = getAree().find((a) => a.cartella === top);
  if (area?.polvere && /archiv/i.test(area.key)) {
    return { decisione: "ask", motivo: "Archiviare o modificare l'archivio richiede conferma" };
  }
  if (contenutoNuovo != null && contenutoNuovo.trim() === "") {
    return { decisione: "ask", motivo: "Scrittura che svuota il file: equivale a una cancellazione" };
  }
  return { decisione: "allow", motivo: "" };
}

/**
 * Gate condiviso per le scritture (usato da entrambi i provider):
 * valuta la regola, mostra il diff e attende la conferma quando serve.
 * Ritorna null se la scrittura puo procedere, altrimenti il motivo del rifiuto.
 */
export async function gateScrittura(opts: {
  toolName: "Write" | "Edit";
  input: Record<string, unknown>;
  emit: Emit;
  abort: AbortSignal;
}): Promise<{ rifiuto: string | null; rel: string; esisteva: boolean; nuovo: string }> {
  const s = stato();
  const root = vaultPath();
  const filePath = String(opts.input.file_path ?? "");
  const assoluto = path.resolve(root, filePath);
  if (!assoluto.startsWith(root)) {
    return { rifiuto: "Percorso fuori dal vault: operazione vietata", rel: filePath, esisteva: false, nuovo: "" };
  }
  const rel = path.relative(root, assoluto).split(path.sep).join("/");

  let vecchio = "";
  try {
    vecchio = await fs.readFile(assoluto, "utf8");
  } catch {
    vecchio = "";
  }
  let nuovo = vecchio;
  if (opts.toolName === "Write") {
    nuovo = String(opts.input.content ?? "");
  } else {
    const oldStr = String(opts.input.old_string ?? "");
    const newStr = String(opts.input.new_string ?? "");
    if (oldStr && !vecchio.includes(oldStr)) {
      return { rifiuto: `Testo da sostituire non trovato in ${rel}`, rel, esisteva: true, nuovo: vecchio };
    }
    nuovo = opts.input.replace_all
      ? vecchio.split(oldStr).join(newStr)
      : vecchio.replace(oldStr, newStr);
  }

  const esisteva = vecchio !== "" || opts.toolName === "Edit";
  const regola = classificaScrittura(rel, opts.toolName === "Write" ? nuovo : undefined);

  if (regola.decisione === "deny") {
    return { rifiuto: regola.motivo, rel, esisteva, nuovo };
  }

  if (regola.decisione === "ask") {
    const id = "perm_" + Math.random().toString(36).slice(2, 10);
    opts.emit({
      t: "permesso",
      id,
      titolo: esisteva ? `Modifica ${rel}` : `Crea ${rel}`,
      percorso: rel,
      motivo: regola.motivo,
      diff: diffRighe(vecchio, nuovo),
    });
    const scelta = await new Promise<{ esito: "allow" | "deny"; messaggio?: string }>(
      (resolve) => {
        s.permessi.set(id, { resolve });
        opts.abort.addEventListener("abort", () => {
          if (s.permessi.delete(id)) {
            resolve({ esito: "deny", messaggio: "Comando interrotto" });
          }
        });
      }
    );
    opts.emit({ t: "permesso_esito", id, esito: scelta.esito });
    if (scelta.esito === "deny") {
      return {
        rifiuto: scelta.messaggio || "L'utente ha negato l'operazione",
        rel,
        esisteva,
        nuovo,
      };
    }
  }

  opts.emit({ t: "scrittura", percorso: rel, azione: esisteva ? "modifica" : "crea" });
  return { rifiuto: null, rel, esisteva, nuovo };
}

/* ------------------------------------------------------------------ */
/* Esecuzione comando (dispatcher per provider)                        */
/* ------------------------------------------------------------------ */

function risolviModello(id?: string): ModelloAgente {
  const modelli = modelliAgente();
  const daEnv = process.env.SPACE_AGENT_MODEL;
  return (
    modelli.find((m) => m.id === id) ??
    modelli.find((m) => m.id === daEnv) ??
    modelli[0]
  );
}

export function eseguiComando(opts: {
  comando: string;
  sessione?: string | null;
  modello?: string;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const s = stato();
  const modello = risolviModello(opts.modello);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: Emit = (e) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // stream chiuso dal client
        }
      };

      if (s.occupato) {
        emit({ t: "errore", messaggio: "L'agente sta gia eseguendo un comando" });
        controller.close();
        return;
      }
      s.occupato = true;
      const abort = new AbortController();
      s.abortCorrente = abort;

      try {
        if (modello.provider === "openai") {
          await eseguiOpenAI({ comando: opts.comando, modello, emit, abort });
        } else {
          if (!(await credenzialiClaude())) {
            emit({ t: "errore", messaggio: MESSAGGIO_SETUP });
            return;
          }
          await eseguiClaude({
            comando: opts.comando,
            sessione: opts.sessione,
            modelloId: modello.id,
            emit,
            abort,
          });
        }
      } catch (err) {
        emit({
          t: "errore",
          messaggio: err instanceof Error ? err.message : "Errore dell'agente",
        });
      } finally {
        s.occupato = false;
        s.abortCorrente = null;
        try {
          controller.close();
        } catch {
          // gia chiuso
        }
      }
    },
    cancel() {
      // il client ha chiuso lo stream: fermiamo davvero il run in corso
      const st = stato();
      st.abortCorrente?.abort();
      st.abortCorrente = null;
      st.occupato = false;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Runner Claude (Agent SDK)                                           */
/* ------------------------------------------------------------------ */

async function eseguiClaude(opts: {
  comando: string;
  sessione?: string | null;
  modelloId: string;
  emit: Emit;
  abort: AbortController;
}): Promise<void> {
  const s = stato();
  const sistema = await systemPromptAgente();
  const root = vaultPath();
  const { emit } = opts;

  // Env pulito per la CLI dell'SDK: se space gira dentro un'altra sessione
  // Claude (dev), le variabili del suo harness impedirebbero il login normale.
  const envPulito: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v == null) continue;
    if (k === "ANTHROPIC_BASE_URL") continue;
    if (k.startsWith("CLAUDE_CODE_") && k !== "CLAUDE_CODE_OAUTH_TOKEN") continue;
    envPulito[k] = v;
  }

  const q = query({
    prompt: opts.comando,
    options: {
      cwd: root,
      model: opts.modelloId,
      systemPrompt: sistema,
      env: envPulito,
      settingSources: [],
      allowedTools: ["Read", "Grep", "Glob"],
      disallowedTools: ["Bash", "WebSearch", "WebFetch", "Task", "NotebookEdit"],
      permissionMode: "default",
      maxTurns: 40,
      abortController: opts.abort,
      resume: opts.sessione ?? undefined,
      canUseTool: async (toolName, input) => {
        if (toolName !== "Write" && toolName !== "Edit") {
          // gli altri strumenti consentiti sono di sola lettura
          return { behavior: "allow", updatedInput: input } as PermissionResult;
        }
        const esito = await gateScrittura({
          toolName,
          input,
          emit,
          abort: opts.abort.signal,
        });
        if (esito.rifiuto) {
          return { behavior: "deny", message: esito.rifiuto } as PermissionResult;
        }
        return { behavior: "allow", updatedInput: input } as PermissionResult;
      },
    },
  });

  for await (const m of q as AsyncIterable<SDKMessage>) {
    if (m.type === "system" && "subtype" in m && m.subtype === "init") {
      const sess = (m as { session_id?: string }).session_id ?? "";
      s.ultimaSessione = sess || s.ultimaSessione;
      emit({ t: "init", sessione: sess, modello: opts.modelloId });
    } else if (m.type === "assistant") {
      const contenuto = (m as { message?: { content?: unknown } }).message?.content;
      if (Array.isArray(contenuto)) {
        for (const blocco of contenuto) {
          if (blocco?.type === "text" && blocco.text) {
            emit({ t: "testo", testo: String(blocco.text) });
          } else if (blocco?.type === "tool_use") {
            const inp = (blocco.input ?? {}) as Record<string, unknown>;
            const descr = String(inp.file_path ?? inp.pattern ?? inp.path ?? inp.query ?? "");
            emit({ t: "tool", nome: String(blocco.name ?? "tool"), descr });
          }
        }
      }
    } else if (m.type === "result") {
      const r = m as {
        subtype: string;
        duration_ms?: number;
        total_cost_usd?: number;
        result?: string;
      };
      emit({
        t: "fine",
        ok: r.subtype === "success",
        durataMs: r.duration_ms,
        costoUsd: r.total_cost_usd,
        risultato: typeof r.result === "string" ? r.result : undefined,
      });
    }
  }
}
