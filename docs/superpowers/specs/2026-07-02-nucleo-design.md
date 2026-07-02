# NUCLEO - Design e piano di costruzione

Data: 2026-07-02. Stato: approvato dal brief (sessione autonoma).

NUCLEO e il cockpit agentico del vault Obsidian `Mind` (`~/Documents/Mind`): legge il vault live,
lo visualizza come galassia (reference: NGC 4414) e permette di comandare un agente Claude che
opera sulle note rispettando `_CLAUDE.md`. Non modifica mai la struttura del vault di sua
iniziativa. Lingua UI e note prodotte: italiano.

## Verita operative apprese dal vault (fonti lette)

- `_CLAUDE.md`: frontmatter a chiavi italiane (`tipo/area/creata/aggiornata/stato`), regole di
  propagazione (hub, Tasks, index, Logs), auto-save vs ask-first, log `**HH:MM** - action | descrizione`,
  UTF-8 senza BOM, niente inglese.
- `Mind - Organizzazione vault.md`: destinazioni, hub, task plugin Tasks (`- [ ] Azione #area 📅 data`),
  storico in callout `[!success]-`, ordine alfabetico solo dove aiuta.
- `Mind - Configurazione visuale.md`: palette Flexoki per area (tabella esatta dei colori root),
  stile "costellazione", accento `#ffc800`.
- `index.md`: catalogo note. `GRAPH_REPORT.md` (2026-07-02): 1350 nodi, 1448 edge, 90 community,
  10 god nodes (top: ArGi Group - Schede progetti 52 edge, Sito Carpa 41, Opera Prima I 29,
  Pianificatore viaggi AI 29), 961 nodi isolati, 5 surprising connections, suggested questions.
- `graph.json` (388 nodi connessi, 1268 link): nodi `{id,label,file_type:document|concept,source_file,community,community_name}`,
  edge `{source,target,relation,confidence,confidence_score,source_file}`.
- CLI `graphify` 0.8.40 disponibile in PATH (query/path/explain con `--graph`).
- Dati reali: 118 note md, ~1950 heading, 3 registri finanze (tabelle md, valute CHF/EUR separate),
  Logs/*.md giornalieri, inbox capture in `00_INBOX/Note da sistemare.md`.

## Architettura

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4. Tutto locale.

```
src/lib/vault/      parser filesystem (server-only)
  config.ts         MIND_VAULT_PATH (default ~/Documents/Mind), espansione ~
  notes.ts          walk + gray-matter: NotaMeta {path, titolo, area, tipo, stato, creata,
                    aggiornata, estratto, wikilink[], headings[], parole}
  graph.ts          galassia: merge note + graph.json + GRAPH_REPORT.md (god/gap/surprising)
  tasks.ts          parser checkbox plugin Tasks (📅 due, ✅ done, #area) da tutte le note
  finanze.ts        parser tabelle md dei 3 registri (valute separate, mai fuse)
  logs.ts           parser Logs/YYYY-MM-DD.md -> entry {ora, azione, testo}
  markdown.ts       md -> html (remark + gfm + wikilink -> link interni)
  watcher.ts        chokidar singleton sul vault, invalida cache + notifica SSE
  cache.ts          cache in-memory per modulo, invalidata dal watcher
src/app/api/        route handlers: graph, notes, note, tasks, finanze, logs, inbox (POST),
                    search (graphify CLI), agent (POST -> stream), events (SSE)
src/components/     Galaxy (r3f), pannelli (Oggi, Progetti, Finanze, Inbox, Log, Ricerca),
                    NotePanel, CommandBar, shell di navigazione
src/lib/agent/      Claude Agent SDK: system prompt = _CLAUDE.md + Organizzazione vault,
                    permessi ask-first via canUseTool, log obbligatorio, diff di anteprima
```

## Mappatura galassia -> dati (tutto reale, niente inventato)

| Elemento visivo | Dato |
|---|---|
| Nucleo dorato | orchestratore/agente; vicino al nucleo i file di sistema root |
| 10 bracci flocculenti | aree root; colore = palette Flexoki della config visuale |
| Stelle principali | note (118), raggio/luminosita proporzionali al grado (wikilink + edge grafo) |
| Supergiganti etichettate | god nodes del GRAPH_REPORT |
| Stelle minori | entita Graphify (388) attorno alla loro nota sorgente, tinte di community |
| Micro-stelle (LOD, solo in zoom) | heading delle note (~1950): satelliti della nota |
| Ammassi | community Graphify (posizionamento raggruppato) |
| Corsie di polvere | 99_ARCHIVIO + Logs + note poco connesse (seppia scuro) |
| Stelle di campo in periferia | knowledge gap: nodi isolati, wikilink irrisolti |
| Filamenti on-demand | edge (wikilink + relazioni grafo), surprising connections evidenziate |

Totale nodi renderizzati: ben oltre 1300 (note+entita+heading+gap). Rendering: THREE.Points
instanziati con shader additivo e sprite radiale (glow senza postprocessing), etichette HTML
solo per stelle grandi o hovered/zoom (LOD). Target 60fps su MacBook Air M5.

Layout: disco inclinato tipo NGC 4414. Ogni area = settore angolare con flusso a spirale
logaritmica flocculenta (rumore deterministico seedato dal path: layout stabile tra reload).
Grado alto -> piu vicino al nucleo. Gap -> periferia.

## Pannelli

- OGGI: task scadute/oggi/7 giorni (stesse query di Tasks.md), progetti attivi (frontmatter
  `tipo: progetto` + god nodes), ultime entry log, quick capture -> append a
  `00_INBOX/Note da sistemare.md` sotto `## Note da sistemare` + log automatico.
- PROGETTI: schede da note `tipo: progetto|nota-progetto` (obiettivo/stato/prossime azioni/
  decisioni/risorse dalle sezioni), task collegate, vicini nella galassia, link obsidian://.
- FINANZE: riepilogo abbonamenti (totali per valuta, margine, nota promo Gemini), spese variabili
  (registro + riepilogo mensile per valuta), portfolio crypto. Solo lettura locale; nessun dato
  inviato a servizi esterni.
- INBOX & LOG: contenuto inbox + azione "smista" (delegata all'agente); timeline Logs filtrabile
  per azione.
- RICERCA: ricerca locale (titoli/contenuto/frontmatter) + query grafo via CLI graphify
  (query/path/explain) + scorciatoie: gap, god nodes per area, cosa collega X e Y, suggested
  questions del report.
- COMANDO AGENTE: command bar nel nucleo. Contesto: index + regole + note pertinenti. Modelli:
  opus per scrittura/ragionamento, sonnet per operazioni rapide. Ask-first con diff di anteprima
  per operazioni sensibili; ogni scrittura loggata in Logs. Streaming di testo e azioni.

## Direzione estetica (vincolante)

Cosmica ma calda e fotografica, NGC 4414 come reference in `public/reference/NGC_4414.jpg`.
Token CSS: fondo `#05060a -> #0a0c14` radiale; nucleo `#f6e7c1` alone `#ffd98a/#ffbf69`;
polvere `#6b4f34/#8a6a44`; stelle giovani `#bcd3ff/#dfe9ff`; accenti area = Flexoki del vault
(INBOX #E8B84A, DESIGN #D97757, FINANZE #D6A53A, ARCHVIZ #4FA3A5, CONTENT #C77B91, PC #6487B6,
CASA #7D9D78, IDEE #9886B8, AI #B07AA1, LOGS #979293, ARCHIVIO #77736B).
Tipografia: Instrument Sans Variable (UI, editoriale) + JetBrains Mono (numeri tabellari finanze).
Grana fotografica leggera. Motion GSAP sobrio; il nucleo respira lentamente (glow diffuso).
DIVIETI: pulsing dot di stato (bandito), glassmorphism freddo, serif decorativo, em-dash nel
testo visibile della UI, eyebrow uppercase ovunque, template look.

## Privacy

Pannelli = parsing locale, zero rete. L'agente chiama l'API Anthropic solo su comando esplicito
dell'utente e solo con le note pertinenti al comando; i dati finanziari non vengono mai inclusi
nel contesto se il comando non li riguarda. Nessuna telemetria.

## Fasi (commit per fase su branch nucleo/build)

0. Scaffold + design doc (questo commit)
1. Data layer + API + watcher; verifica con curl su dati reali
2. Galassia r3f: rendering, interazioni (hover/click/zoom/ricerca/filtri), palette, LOD
3. Pannelli: Oggi, Progetti, Finanze, Inbox, Log, Ricerca
4. Layer agente: command bar + Agent SDK + regole propagazione + diff ask-first
5. Responsive iPhone 16 Pro Max + rifinitura + verifica finale (preview server, screenshot)

## Rischi e scelte

- I 961 nodi isolati del report non hanno JSON: rappresentati da wikilink irrisolti reali,
  entita a grado <=1 e conteggio del report (etichettato come dato di report).
- Percorsi Windows nel report (sync storica): il parser normalizza e usa solo basename quando serve.
- Agent SDK usa l'autenticazione locale di Claude Code se presente, altrimenti ANTHROPIC_API_KEY.
