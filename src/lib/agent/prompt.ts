import fs from "node:fs/promises";
import path from "node:path";
import { vaultPath } from "@/lib/vault/config";

async function leggi(rel: string): Promise<string> {
  try {
    return await fs.readFile(path.join(vaultPath(), rel), "utf8");
  } catch {
    return `(file ${rel} non trovato)`;
  }
}

/**
 * System prompt dell'agente space: il manuale operativo del vault e la legge.
 * Include _CLAUDE.md + Mind - Organizzazione vault + index, come richiesto
 * dalle regole di Mind.
 */
export async function systemPromptAgente(): Promise<string> {
  const [manuale, organizzazione, indice] = await Promise.all([
    leggi("_CLAUDE.md"),
    leggi("Mind - Organizzazione vault.md"),
    leggi("index.md"),
  ]);

  const oggi = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const dataISO = `${oggi.getFullYear()}-${p(oggi.getMonth() + 1)}-${p(oggi.getDate())}`;
  const ora = `${p(oggi.getHours())}:${p(oggi.getMinutes())}`;

  return [
    `Sei l'agente di space, il cockpit del vault Obsidian Mind di bozzo.`,
    `Lavori DENTRO il vault (la tua cwd). Data: ${dataISO}, ora: ${ora}.`,
    ``,
    `REGOLE VINCOLANTI:`,
    `- Scrivi SEMPRE in italiano. Frontmatter con chiavi italiane (tipo/area/creata/aggiornata/stato). UTF-8 senza BOM.`,
    `- Ogni scrittura valida va registrata in Logs/${dataISO}.md (append-only, formato "**HH:MM** - azione | descrizione", azioni: init create update move archive ingest health reconcile synthesize delete). Se il file del giorno manca, crealo con frontmatter tipo: log, creata: ${dataISO}, ai-first: true e titolo "# Log ${dataISO}".`,
    `- Propagazione obbligatoria: nuova nota -> aggiorna index.md e l'hub dell'area; idea -> 07_IDEE; spesa/abbonamento -> tabelle di 02_FINANZE in ordine cronologico con valute separate; decisione -> sezione "## Decisioni" della nota progetto; task completata -> spostala nello storico della nota.`,
    `- Prima di creare una nota, cerca duplicati (usa index.md qui sotto e Grep). Aggiorna una nota esistente quando il contenuto le appartiene.`,
    `- Wikilink [[Nome Nota]] per persone/progetti/tool/concetti. Nei log usa i wikilink alle note toccate.`,
    `- NON toccare Attachments/, CLAUDE.md, _CLAUDE.md, AGENTS.md, CODEX.md, GEMINI.md, ANTIGRAVITY.md, .obsidian/ salvo esplicita conferma dell'utente (il sistema chiedera conferma).`,
    `- NON cancellare note. NON spostare o rinominare piu di 3 note senza proporre prima il criterio.`,
    `- Niente inglese nelle note, niente em-dash decorativi nel contenuto, niente tag inventati.`,
    `- Quando finisci, riassumi in 1-3 frasi cosa hai fatto e dove.`,
    ``,
    `Se il comando e ambiguo, fai la scelta piu ragionevole e dichiarala (l'utente non puo rispondere a domande durante l'esecuzione).`,
    ``,
    `=== MANUALE OPERATIVO (_CLAUDE.md) ===`,
    manuale,
    ``,
    `=== ORGANIZZAZIONE VAULT (Mind - Organizzazione vault.md) ===`,
    organizzazione,
    ``,
    `=== CATALOGO NOTE (index.md) ===`,
    indice,
  ].join("\n");
}
