import fs from "node:fs/promises";
import path from "node:path";
import { vaultPath, type ModelloAgente } from "@/lib/vault/config";
import { systemPromptAgente } from "./prompt";
import type { Emit } from "./sessione";
import { gateScrittura } from "./sessione";
import { getSnapshot, senzaCodeFence } from "@/lib/vault/notes";

/**
 * Runner per endpoint OpenAI-compatibili (Ollama/Hermes, LM Studio, vLLM...).
 * Stesso contratto del runner Claude: eventi NDJSON, strumenti file-only,
 * scritture attraverso il gate ask-first con diff.
 */

const MAX_TURNI = 25;
const MAX_CHAR_FILE = 24_000;

interface MsgTool {
  role: "tool";
  tool_call_id: string;
  content: string;
}
interface MsgChat {
  role: "system" | "user" | "assistant";
  content: string | null;
  tool_calls?: ToolCall[];
}
type Messaggio = MsgChat | MsgTool;

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

const STRUMENTI = [
  {
    type: "function",
    function: {
      name: "leggi_file",
      description: "Leggi il contenuto di una nota o file del vault (percorso relativo al vault).",
      parameters: {
        type: "object",
        properties: { percorso: { type: "string", description: "Percorso relativo, es. Cartella/Nota.md" } },
        required: ["percorso"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "elenca_file",
      description: "Elenca i file del vault che corrispondono a un pattern glob (es. Cartella/**/*.md).",
      parameters: {
        type: "object",
        properties: { pattern: { type: "string" } },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cerca_testo",
      description: "Cerca un testo (case-insensitive) in tutte le note del vault. Ritorna file e righe.",
      parameters: {
        type: "object",
        properties: {
          testo: { type: "string" },
          cartella: { type: "string", description: "Limita la ricerca a una cartella (opzionale)" },
        },
        required: ["testo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scrivi_file",
      description:
        "Crea o sovrascrivi un file del vault. Le scritture sensibili chiedono conferma all'utente.",
      parameters: {
        type: "object",
        properties: {
          percorso: { type: "string" },
          contenuto: { type: "string" },
        },
        required: ["percorso", "contenuto"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modifica_file",
      description:
        "Sostituisci un testo esatto dentro un file esistente del vault (come un trova-e-sostituisci puntuale).",
      parameters: {
        type: "object",
        properties: {
          percorso: { type: "string" },
          vecchio: { type: "string", description: "Testo esatto da trovare" },
          nuovo: { type: "string", description: "Testo sostitutivo" },
          tutte: { type: "boolean", description: "Sostituisci tutte le occorrenze (default: solo la prima)" },
        },
        required: ["percorso", "vecchio", "nuovo"],
      },
    },
  },
];

function globARegex(pattern: string): RegExp {
  const esc = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp("^" + esc + "$", "i");
}

function dentroVault(rel: string): string | null {
  const root = vaultPath();
  const assoluto = path.resolve(root, rel);
  return assoluto.startsWith(root) ? assoluto : null;
}

async function esegui(
  nome: string,
  args: Record<string, unknown>,
  emit: Emit,
  abort: AbortSignal
): Promise<string> {
  const snap = await getSnapshot();

  if (nome === "leggi_file") {
    const rel = String(args.percorso ?? "");
    const assoluto = dentroVault(rel);
    if (!assoluto) return "ERRORE: percorso fuori dal vault";
    try {
      const testo = (await fs.readFile(assoluto, "utf8")).replace(/\r\n?/g, "\n");
      return testo.length > MAX_CHAR_FILE
        ? testo.slice(0, MAX_CHAR_FILE) + `\n[...troncato, file di ${testo.length} caratteri]`
        : testo;
    } catch {
      return `ERRORE: file non trovato: ${rel}`;
    }
  }

  if (nome === "elenca_file") {
    const re = globARegex(String(args.pattern ?? "**"));
    const trovati = snap.notes.map((n) => n.rel).filter((r) => re.test(r)).slice(0, 200);
    return trovati.length ? trovati.join("\n") : "(nessun file corrispondente)";
  }

  if (nome === "cerca_testo") {
    const ago = String(args.testo ?? "").toLowerCase();
    const cartella = args.cartella ? String(args.cartella) : "";
    if (!ago) return "ERRORE: testo vuoto";
    const righe: string[] = [];
    for (const nota of snap.notes) {
      if (cartella && !nota.rel.startsWith(cartella)) continue;
      const body = senzaCodeFence(snap.bodies.get(nota.rel) ?? "");
      body.split("\n").forEach((riga, i) => {
        if (righe.length < 80 && riga.toLowerCase().includes(ago)) {
          righe.push(`${nota.rel}:${i + 1}: ${riga.trim().slice(0, 160)}`);
        }
      });
      if (righe.length >= 80) break;
    }
    return righe.length ? righe.join("\n") : "(nessuna occorrenza)";
  }

  if (nome === "scrivi_file" || nome === "modifica_file") {
    const toolName = nome === "scrivi_file" ? "Write" : "Edit";
    const input =
      nome === "scrivi_file"
        ? { file_path: String(args.percorso ?? ""), content: String(args.contenuto ?? "") }
        : {
            file_path: String(args.percorso ?? ""),
            old_string: String(args.vecchio ?? ""),
            new_string: String(args.nuovo ?? ""),
            replace_all: Boolean(args.tutte),
          };
    const esito = await gateScrittura({ toolName, input, emit, abort });
    if (esito.rifiuto) return `RIFIUTATA: ${esito.rifiuto}`;
    const assoluto = dentroVault(esito.rel);
    if (!assoluto) return "ERRORE: percorso fuori dal vault";
    await fs.mkdir(path.dirname(assoluto), { recursive: true });
    await fs.writeFile(assoluto, esito.nuovo, "utf8");
    return `OK: ${esito.esisteva ? "aggiornato" : "creato"} ${esito.rel}`;
  }

  return `ERRORE: strumento sconosciuto ${nome}`;
}

export async function eseguiOpenAI(opts: {
  comando: string;
  modello: ModelloAgente;
  emit: Emit;
  abort: AbortController;
}): Promise<void> {
  const { emit, modello } = opts;
  const inizio = Date.now();
  const baseUrl = (modello.baseUrl || "http://localhost:11434/v1").replace(/\/$/, "");
  const chiave = modello.chiaveEnv ? process.env[modello.chiaveEnv] : undefined;

  emit({ t: "init", sessione: "locale", modello: modello.id });

  const sistema = await systemPromptAgente();
  const messaggi: Messaggio[] = [
    { role: "system", content: sistema },
    { role: "user", content: opts.comando },
  ];

  let ok = false;
  let risultato: string | undefined;

  for (let turno = 0; turno < MAX_TURNI; turno++) {
    if (opts.abort.signal.aborted) break;

    let risposta: Response;
    try {
      risposta = await fetch(baseUrl + "/chat/completions", {
        method: "POST",
        signal: opts.abort.signal,
        headers: {
          "Content-Type": "application/json",
          ...(chiave ? { Authorization: `Bearer ${chiave}` } : {}),
        },
        body: JSON.stringify({
          model: modello.id,
          messages: messaggi,
          tools: STRUMENTI,
          tool_choice: "auto",
          stream: false,
        }),
      });
    } catch (e) {
      emit({
        t: "errore",
        messaggio: `Endpoint ${baseUrl} non raggiungibile (${e instanceof Error ? e.message : "?"}). Il modello locale e in esecuzione? (es. \`ollama serve\` + \`ollama pull ${modello.id}\`)`,
      });
      return;
    }
    if (!risposta.ok) {
      const corpo = await risposta.text().catch(() => "");
      emit({
        t: "errore",
        messaggio: `Il provider ha risposto ${risposta.status}: ${corpo.slice(0, 300)}`,
      });
      return;
    }

    const dati = (await risposta.json()) as {
      choices?: Array<{ message?: MsgChat & { tool_calls?: ToolCall[] }; finish_reason?: string }>;
    };
    const msg = dati.choices?.[0]?.message;
    if (!msg) {
      emit({ t: "errore", messaggio: "Risposta del provider senza contenuto" });
      return;
    }

    if (msg.content && String(msg.content).trim()) {
      emit({ t: "testo", testo: String(msg.content).trim() });
      risultato = String(msg.content).trim();
    }

    const chiamate = msg.tool_calls ?? [];
    messaggi.push({ role: "assistant", content: msg.content ?? null, tool_calls: chiamate });

    if (chiamate.length === 0) {
      ok = true;
      break;
    }

    for (const chiamata of chiamate) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(chiamata.function.arguments || "{}");
      } catch {
        // argomenti malformati: l'errore va al modello
      }
      const descr = String(args.percorso ?? args.pattern ?? args.testo ?? "");
      emit({ t: "tool", nome: chiamata.function.name, descr });
      const esito = await esegui(chiamata.function.name, args, emit, opts.abort.signal);
      messaggi.push({ role: "tool", tool_call_id: chiamata.id, content: esito });
    }
  }

  emit({
    t: "fine",
    ok,
    durataMs: Date.now() - inizio,
    risultato,
  });
}
