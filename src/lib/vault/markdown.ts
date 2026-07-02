import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

const processore = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

/**
 * Pre-trasforma la sintassi Obsidian in markdown standard, proteggendo i
 * blocchi di codice. I wikilink diventano link `wikilink:<target>` che il
 * client intercetta per aprire la nota; gli embed diventano chip testuali.
 */
function preObsidian(md: string): string {
  const pezzi = md.split(/(```[\s\S]*?```)/g);
  return pezzi
    .map((pezzo, i) => {
      if (i % 2 === 1) {
        // blocco di codice: i blocchi ```tasks diventano un marcatore che la UI
        // sostituisce con le task reali della nota
        if (/^```tasks/.test(pezzo)) return "\n`[query tasks del plugin]`\n";
        return pezzo;
      }
      return (
        pezzo
          // embed ![[file]] -> chip
          .replace(/!\[\[([^\[\]]+)\]\]/g, (_m, t) => "`[allegato: " + String(t) + "]`")
          // wikilink [[Target|Alias]] / [[Target#Ancora]]
          .replace(
            /\[\[([^\[\]|#]+)(?:#([^\[\]|]*))?(?:\|([^\[\]]*))?\]\]/g,
            (_m, target, _ancora, alias) => {
              const testo = (alias || target).trim();
              const dest = "wikilink:" + encodeURIComponent(String(target).trim());
              return `[${testo}](${dest})`;
            }
          )
          // callout Obsidian: il titolo resta leggibile
          .replace(/^>\s*\[!(\w+)\]([-+]?)\s*(.*)$/gm, (_m, tipo, _fold, titolo) => {
            return `> **${String(titolo || tipo).trim()}**`;
          })
      );
    })
    .join("");
}

export async function mdToHtml(md: string): Promise<string> {
  const file = await processore.process(preObsidian(md));
  return String(file);
}
