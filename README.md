# space

Il tuo vault Obsidian come una galassia. space e un cockpit web locale che legge
il vault live, lo disegna come una galassia a spirale (reference: NGC 4414) e ti
permette di comandare un agente AI che lavora sulle note con conferme diff.

Tutto gira sulla tua macchina. I pannelli non fanno mai rete esterna; l'AI viene
chiamata solo quando dai un comando esplicito all'agente (e puo essere un
modello locale: Ollama/Hermes).

## Installazione

```bash
git clone https://github.com/carpaaaaa/space.git
cd space
npm install
npm run dev        # http://localhost:3000
```

Al primo avvio space cerca il vault in `~/Documents/Mind` o nel percorso di
`SPACE_VAULT_PATH`; senza configurazione scopre da solo le aree (le cartelle
top-level) e genera una palette.

**La via piu comoda: fatti configurare da Claude.** Apri Claude Code in questa
cartella e incollagli il prompt di [PROMPT-CLAUDE.md](PROMPT-CLAUDE.md):
ispeziona il tuo vault e genera tutto lui.

### Configurazione manuale

Copia `space.config.example.json` in `space.config.json` e personalizza:
percorso e nome del vault, aree con colori e bracci della galassia, cartelle
polvere (log, archivi), esclusioni, file di regole per l'agente, modelli AI.
Ogni campo e opzionale e documentato nell'example. Il file e gitignored: la tua
configurazione resta tua.

Variabili `.env.local` (vedi `.env.example`):

| Variabile | Uso |
|---|---|
| `SPACE_VAULT_PATH` | percorso del vault (vince sul config) |
| `SPACE_VAULT_NAME` | nome vault per i deep-link `obsidian://` |
| `GRAPHIFY_BIN` | CLI graphify per le query sul grafo (opzionale) |
| `SPACE_AGENT_MODEL` | id del modello agente di default |
| `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` | credenziali per i modelli Claude |

### L'agente: scegli il tuo modello

Nel selettore della barra comandi scegli tra i modelli configurati in
`space.config.json`:

- **Claude** (`provider: "claude"`): serve UNA credenziale una-tantum:
  `claude setup-token` col tuo abbonamento (token in `.env.local` come
  `CLAUDE_CODE_OAUTH_TOKEN`) oppure una `ANTHROPIC_API_KEY`.
- **Modello locale o OpenAI-compatibile** (`provider: "openai"`): Ollama,
  LM Studio, vLLM o un endpoint remoto. Gratuito e tutto in locale con
  es. `ollama pull hermes3`. Nessuna credenziale se l'endpoint e locale.

Senza credenziali la console dell'agente spiega esattamente cosa fare.
Galassia e pannelli funzionano comunque, sempre.

## Architettura

```
src/lib/vault/        data layer (server): il vault e la fonte di verita
  config.ts           percorso vault, aree root + palette Flexoki, esclusioni
  notes.ts            walk + gray-matter: frontmatter italiano, wikilink, heading, alias
  graph.ts            LA GALASSIA: fusione note + graph.json + GRAPH_REPORT, layout deterministico
  tasks.ts            checkbox del plugin Tasks (scadenze, done, #area, priorita emoji)
  finanze.ts          tabelle markdown di 02_FINANZE (valute sempre separate)
  logs.ts             Logs/YYYY-MM-DD.md -> entry {ora, azione, testo}
  progetti.ts         schede da tipo: progetto/nota-progetto (sezioni, vicini, task)
  markdown.ts         md -> html con wikilink cliccabili e callout
  scrivi.ts           quick capture + append log (regole _CLAUDE.md, UTF-8 senza BOM)
  watcher.ts          chokidar live sul vault -> versione + eventi SSE
src/lib/agent/        layer agente (server)
  prompt.ts           system prompt: regole + _CLAUDE.md + Organizzazione + index
  sessione.ts         Claude Agent SDK: streaming NDJSON, ask-first con diff, pre-flight credenziali
src/app/api/          galaxy, notes, note, tasks, finanze, logs, progetti, inbox,
                      search (locale + graphify CLI), events (SSE), agent, agent/permesso
src/components/       galaxy/ (r3f), panels/, hud/, NotaDrawer, ConsoleAgente, AppShell
```

Il watcher invalida le cache e notifica il browser via SSE: modifichi una nota in
Obsidian e space si aggiorna da solo (galassia compresa).

## La galassia: mappatura dati

Tutto cio che vedi e derivato da dati reali del vault. Un solo strato e dichiaratamente
scenografico: il campo stelle di sfondo lontano e la polvere/foschia procedurale dei
bracci (segue gli stessi parametri di spirale del layout, ma non rappresenta note).

| Elemento | Dato |
|---|---|
| Nucleo dorato | l'orchestratore (punto d'ingresso dell'agente); intorno, i file di sistema root |
| 10 bracci | le aree root; colore = palette Flexoki di `Mind - Configurazione visuale.md` |
| Stelle principali | le note; raggio e luminosita crescono col grado (wikilink + grafo) |
| Supergiganti etichettate | i god nodes del `GRAPH_REPORT.md` |
| Stelle minori | le entita semantiche di `graph.json`, attorno alla nota sorgente |
| Micro-stelle (zoom, desktop) | gli heading delle note |
| Corsie di polvere scura | `Logs/` (cronologica: recente verso il centro) e `99_ARCHIVIO` |
| Alone periferico | i knowledge gap: wikilink citati ma senza nota |
| Filamenti | wikilink e relazioni semantiche; le surprising connections sono oro e sempre accese |

Il layout e deterministico (seed dal percorso della nota): la stessa nota sta sempre
nello stesso punto finche non cambia la sua connettivita.

Interazioni: hover = tooltip; click = seleziona e apre la nota; doppio click = volo
camera; `/` o `cmd+K` = ricerca che vola alla stella; filtri in basso (aree, god, gap,
filamenti, sezioni).

## L'agente

La command bar in alto accetta italiano naturale ("cattura questa idea…", "aggiorna il
portfolio crypto…", "sistema l'inbox"). Il system prompt dell'agente incorpora
`_CLAUDE.md`, `Mind - Organizzazione vault.md` e `index.md`; l'agente lavora con
strumenti file-only dentro il vault (niente shell).

- **Auto-save**: idee, capture, log, aggiornamenti coerenti a note esistenti; ogni
  scrittura appare nella console e viene loggata dall'agente in `Logs/`.
- **Ask-first con diff**: `Attachments/`, i manuali degli agenti (CLAUDE.md ecc.),
  `99_ARCHIVIO/`, scritture che svuotano un file. La console mostra il diff e chiede
  Approva/Nega prima di scrivere.
- Il pulsante "Smista con l'agente" nel pannello Inbox lancia lo smistamento secondo le
  regole del vault.

## Skills e automazioni

Le skill sono note markdown in una cartella del vault (config `skills.cartella`,
default `Skills/`): il frontmatter dice quando girano (`trigger: comando` con uno
slug per la command bar, `ogni: "09:00"` o `"lun 09:00"` a orario, `evento:
nuova-nota` + `dove: Inbox/` sugli eventi del vault), il corpo e il playbook che
l'agente esegue.

- **La fucina** (`/forgia`, e da sola ogni giorno alle 9): legge obiettivi, task,
  inbox e log, e scrive nuove skill con `stato: proposta`. Le proposte sono
  inerti: diventano operative solo quando le attivi tu (dal pannello Skills o
  cambiando `stato: attiva` in Obsidian).
- **Pannello Skills**: tutte le skill con stato, trigger, ultima esecuzione ed
  esito; azioni attiva/pausa/esegui ora/apri.
- **Run automatici**: girano con space aperto (recupero all'avvio se era chiuso),
  senza conferme ma coi divieti duri intatti (mai fuori dal vault, mai
  cancellazioni, mai `.obsidian`), massimo `skills.maxRunGiorno` al giorno
  (default 20). `skills.fucinaPeriodica: false` spegne la proposta giornaliera.

## Ricerca

- **Note**: ricerca locale su titoli, frontmatter e contenuto.
- **Grafo / Percorso / Concetto**: `graphify query|path|explain` sulla copia locale del
  grafo (`08_AI/graphify/output/current/graph.json`), piu le domande suggerite dal report.

## Estendere

- **Nuova area root nel vault**: aggiungi la riga in `AREE` (`src/lib/vault/config.ts`)
  con colore e slot del braccio; il resto segue.
- **Nuovo pannello**: componente in `src/components/panels/`, voce in `NavRail` e
  `TabBarMobile`, eventuale route in `src/app/api/`.
- **Nuove regole ask-first**: `classificaScrittura` in `src/lib/agent/sessione.ts`.
- **Payload galassia**: formato colonnare in `src/lib/vault/graph.ts` (`GalaxyPayload`);
  il client lo trasforma in Float32Array in `src/lib/galassia.ts`.

## Note operative

- Il grafo semantico e un artefatto locale di Graphify: se manca `graph.json`, la
  galassia si costruisce comunque da note e wikilink (senza community ed entita).
- Se sviluppi space da dentro una sessione Claude Code, il runner del preview puo non
  avere i permessi macOS su `~/Documents`: in quel caso lancia `next dev` da un
  terminale normale. L'app in se non ha questo problema.
- Privacy: nessuna telemetria; i dati finanziari restano nel parsing locale; l'agente
  riceve solo il contesto del comando che gli dai.
