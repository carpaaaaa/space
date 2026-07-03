import fs from "node:fs/promises";
import path from "node:path";
import { fileProtetti, fileRegole, getAree, vaultName, vaultPath } from "@/lib/vault/config";

async function leggi(rel: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(vaultPath(), rel), "utf8");
    return raw.replace(/\r\n?/g, "\n");
  } catch {
    return null;
  }
}

/**
 * System prompt dell'agente: le regole generali di space piu i manuali del
 * vault (da space.config.json, o auto-rilevati: _CLAUDE.md, CLAUDE.md,
 * AGENTS.md, index.md). Nessun riferimento personale hardcoded.
 */
export async function systemPromptAgente(): Promise<string> {
  const regole = fileRegole();
  const contenuti = await Promise.all(regole.map((f) => leggi(f)));

  const oggi = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const dataISO = `${oggi.getFullYear()}-${p(oggi.getMonth() + 1)}-${p(oggi.getDate())}`;
  const ora = `${p(oggi.getHours())}:${p(oggi.getMinutes())}`;

  const areaLog = getAree().find((a) => a.polvere && /log/i.test(a.key));
  const protetti = [...fileProtetti()].join(", ");

  const sezioni: string[] = [
    `Sei l'agente di space, il cockpit del vault Obsidian "${vaultName()}".`,
    `Lavori DENTRO il vault (la tua cwd). Data: ${dataISO}, ora: ${ora}.`,
    ``,
    `REGOLE VINCOLANTI:`,
    `- Scrivi nella stessa lingua usata dalle note del vault. UTF-8 senza BOM.`,
    `- Rispetta le convenzioni dei manuali del vault riportati sotto (frontmatter, naming, propagazione): sono la legge. Se un manuale e assente, limita le scritture a cio che il comando chiede.`,
    ...(areaLog
      ? [
          `- Ogni scrittura valida va registrata in ${areaLog.cartella}/${dataISO}.md (append-only, formato "**HH:MM** - azione | descrizione"). Se il file del giorno manca, crealo seguendo il formato dei file esistenti in ${areaLog.cartella}/.`,
        ]
      : []),
    `- Prima di creare una nota, cerca duplicati (Grep/Glob). Aggiorna una nota esistente quando il contenuto le appartiene.`,
    `- Wikilink [[Nome Nota]] per persone/progetti/tool/concetti.`,
    `- NON toccare ${protetti} ne le cartelle di allegati o .obsidian/ senza conferma (il sistema la chiedera).`,
    `- NON cancellare note. NON spostare o rinominare piu di 3 note senza proporre prima il criterio.`,
    `- Quando finisci, riassumi in 1-3 frasi cosa hai fatto e dove.`,
    ``,
    `Se il comando e ambiguo, fai la scelta piu ragionevole e dichiarala (l'utente non puo rispondere a domande durante l'esecuzione).`,
  ];

  regole.forEach((f, i) => {
    const contenuto = contenuti[i];
    if (contenuto) {
      sezioni.push(``, `=== MANUALE DEL VAULT: ${f} ===`, contenuto);
    }
  });

  return sezioni.join("\n");
}
