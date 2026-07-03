import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { query, type PermissionResult, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { vaultPath } from "@/lib/vault/config";
import { systemPromptAgente } from "./prompt";

const execFileAsync = promisify(execFile);

/**
 * L'agente ha bisogno di UNA di queste credenziali:
 * - ANTHROPIC_API_KEY (o CLAUDE_CODE_OAUTH_TOKEN) in .env.local
 * - il login di Claude Code CLI su questo Mac (Keychain, claudeAiOauth)
 */
async function credenzialiDisponibili(): Promise<boolean> {
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
  "L'agente non ha credenziali su questo Mac. Serve un passo una-tantum, poi space funziona da solo:",
  "1) col tuo abbonamento Claude: apri il Terminale, esegui `claude setup-token` e incolla il token in ~/Desktop/Cartella/space/.env.local come CLAUDE_CODE_OAUTH_TOKEN=... (se la CLI manca: npm i -g @anthropic-ai/claude-code, poi claude /login);",
  "2) in alternativa: metti ANTHROPIC_API_KEY=sk-ant-... in .env.local.",
  "Poi riavvia `npm run dev`. I pannelli e la galassia funzionano comunque: solo i comandi all'agente richiedono questo passo.",
].join("\n");

/**
 * Layer agente di space sopra il Claude Agent SDK.
 * - usa l'autenticazione locale di Claude Code (o ANTHROPIC_API_KEY se presente)
 * - lavora con cwd nel vault, strumenti file-only (niente Bash)
 * - le scritture sensibili passano da una conferma con diff (ask-first)
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

interface PermessoPendente {
  resolve: (esito: { esito: "allow" | "deny"; messaggio?: string }) => void;
}

interface StatoAgente {
  occupato: boolean;
  permessi: Map<string, PermessoPendente>;
  ultimaSessione: string | null;
}

const G = globalThis as unknown as { __nucleoAgente?: StatoAgente };
function stato(): StatoAgente {
  if (!G.__nucleoAgente) {
    G.__nucleoAgente = { occupato: false, permessi: new Map(), ultimaSessione: null };
  }
  return G.__nucleoAgente;
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
/* Diff a righe (LCS semplice, file di note: dimensioni piccole)       */
/* ------------------------------------------------------------------ */

export function diffRighe(vecchio: string, nuovo: string, max = 400): RigaDiff[] {
  const a = vecchio.split("\n").slice(0, 1500);
  const b = nuovo.split("\n").slice(0, 1500);
  const n = a.length;
  const m = b.length;
  // LCS con DP compatta
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
      const vicina =
        righe.slice(Math.max(0, k - 2), k + 3).some((x) => x.k !== " ");
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
/* Regole ask-first del vault                                          */
/* ------------------------------------------------------------------ */

const FILE_PROTETTI = new Set([
  "CLAUDE.md",
  "_CLAUDE.md",
  "AGENTS.md",
  "CODEX.md",
  "GEMINI.md",
  "ANTIGRAVITY.md",
]);

function classificaScrittura(rel: string, contenutoNuovo: string | undefined): {
  decisione: "allow" | "ask" | "deny";
  motivo: string;
} {
  const top = rel.split("/")[0];
  if (rel.startsWith("..")) {
    return { decisione: "deny", motivo: "Percorso fuori dal vault" };
  }
  if (top === ".obsidian" || top === ".git") {
    return { decisione: "deny", motivo: "Configurazione del vault: fuori dal perimetro dell'agente" };
  }
  if (top === "Attachments") {
    return { decisione: "ask", motivo: "Gli allegati non si toccano senza conferma esplicita" };
  }
  if (FILE_PROTETTI.has(rel)) {
    return { decisione: "ask", motivo: "Manuale operativo degli agenti: serve conferma" };
  }
  if (top === "99_ARCHIVIO") {
    return { decisione: "ask", motivo: "Archiviare o modificare l'archivio richiede conferma" };
  }
  if (contenutoNuovo != null && contenutoNuovo.trim() === "") {
    return { decisione: "ask", motivo: "Scrittura che svuota il file: equivale a una cancellazione" };
  }
  return { decisione: "allow", motivo: "" };
}

/* ------------------------------------------------------------------ */
/* Esecuzione comando                                                  */
/* ------------------------------------------------------------------ */

export function eseguiComando(opts: {
  comando: string;
  sessione?: string | null;
  modello?: string;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const s = stato();
  const modello = opts.modello || process.env.SPACE_AGENT_MODEL || "claude-opus-4-8";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: EventoAgente) => {
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
      if (!(await credenzialiDisponibili())) {
        emit({ t: "errore", messaggio: MESSAGGIO_SETUP });
        controller.close();
        return;
      }
      s.occupato = true;
      const abort = new AbortController();

      try {
        const sistema = await systemPromptAgente();
        const root = vaultPath();

        // Env pulito per la CLI dell'SDK: se space gira dentro un'altra
        // sessione Claude (dev), le variabili del suo harness (proxy interno)
        // impedirebbero il login normale via Keychain/API key.
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
            model: modello,
            systemPrompt: sistema,
            env: envPulito,
            settingSources: [],
            allowedTools: ["Read", "Grep", "Glob"],
            disallowedTools: ["Bash", "WebSearch", "WebFetch", "Task", "NotebookEdit"],
            permissionMode: "default",
            maxTurns: 40,
            abortController: abort,
            resume: opts.sessione ?? undefined,
            canUseTool: async (toolName, input) => {
              if (toolName !== "Write" && toolName !== "Edit") {
                // gli altri strumenti consentiti sono di sola lettura
                return { behavior: "allow", updatedInput: input } as PermissionResult;
              }
              const filePath = String(input.file_path ?? "");
              const assoluto = path.resolve(root, filePath);
              if (!assoluto.startsWith(root)) {
                return {
                  behavior: "deny",
                  message: "Percorso fuori dal vault Mind: operazione vietata",
                } as PermissionResult;
              }
              const rel = path.relative(root, assoluto).split(path.sep).join("/");

              // contenuto prima/dopo per il diff
              let vecchio = "";
              try {
                vecchio = await fs.readFile(assoluto, "utf8");
              } catch {
                vecchio = "";
              }
              let nuovo = vecchio;
              if (toolName === "Write") {
                nuovo = String(input.content ?? "");
              } else {
                const oldStr = String(input.old_string ?? "");
                const newStr = String(input.new_string ?? "");
                nuovo = input.replace_all
                  ? vecchio.split(oldStr).join(newStr)
                  : vecchio.replace(oldStr, newStr);
              }

              const esisteva = vecchio !== "" || toolName === "Edit";
              const regola = classificaScrittura(rel, toolName === "Write" ? nuovo : undefined);

              if (regola.decisione === "deny") {
                return { behavior: "deny", message: regola.motivo } as PermissionResult;
              }

              if (regola.decisione === "ask") {
                const id = "perm_" + Math.random().toString(36).slice(2, 10);
                emit({
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
                    abort.signal.addEventListener("abort", () => {
                      if (s.permessi.delete(id)) {
                        resolve({ esito: "deny", messaggio: "Comando interrotto" });
                      }
                    });
                  }
                );
                emit({ t: "permesso_esito", id, esito: scelta.esito });
                if (scelta.esito === "deny") {
                  return {
                    behavior: "deny",
                    message: scelta.messaggio || "L'utente ha negato l'operazione",
                  } as PermissionResult;
                }
              }

              emit({
                t: "scrittura",
                percorso: rel,
                azione: esisteva ? "modifica" : "crea",
              });
              return { behavior: "allow", updatedInput: input } as PermissionResult;
            },
          },
        });

        for await (const m of q as AsyncIterable<SDKMessage>) {
          if (m.type === "system" && "subtype" in m && m.subtype === "init") {
            const sess = (m as { session_id?: string }).session_id ?? "";
            s.ultimaSessione = sess || s.ultimaSessione;
            emit({ t: "init", sessione: sess, modello });
          } else if (m.type === "assistant") {
            const contenuto = (m as { message?: { content?: unknown } }).message?.content;
            if (Array.isArray(contenuto)) {
              for (const blocco of contenuto) {
                if (blocco?.type === "text" && blocco.text) {
                  emit({ t: "testo", testo: String(blocco.text) });
                } else if (blocco?.type === "tool_use") {
                  const inp = (blocco.input ?? {}) as Record<string, unknown>;
                  const descr = String(
                    inp.file_path ?? inp.pattern ?? inp.path ?? inp.query ?? ""
                  );
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
      } catch (err) {
        emit({
          t: "errore",
          messaggio:
            err instanceof Error
              ? err.message
              : "Errore dell'agente (Claude Code e autenticato su questo Mac?)",
        });
      } finally {
        s.occupato = false;
        try {
          controller.close();
        } catch {
          // gia chiuso
        }
      }
    },
    cancel() {
      // il client ha chiuso: liberiamo il lock al prossimo giro del loop
      stato().occupato = false;
    },
  });
}
