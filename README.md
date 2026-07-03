# NUCLEO

Il cervello del vault Mind. Un cockpit web locale che legge il vault Obsidian
`~/Documents/Mind` live, lo mostra come una galassia (reference: NGC 4414) e permette di
comandare un agente Claude che scrive nelle note rispettando le regole di `_CLAUDE.md`.

Tutto gira su questo Mac. I pannelli non fanno mai rete esterna; l'API Anthropic viene
chiamata solo quando dai un comando esplicito all'agente.

## Avvio

```bash
cd ~/Documents/NUCLEO
npm install
npm run dev        # http://localhost:3000
```

Configurazione via `.env.local` (vedi `.env.example`):

| Variabile | Default | Uso |
|---|---|---|
| `MIND_VAULT_PATH` | `~/Documents/Mind` | percorso del vault |
| `MIND_VAULT_NAME` | `Mind` | nome vault per i deep-link `obsidian://` |
| `GRAPHIFY_BIN` | `graphify` nel PATH | CLI per le query sul grafo |
| `NUCLEO_AGENT_MODEL` | `claude-opus-4-8` | modello dell'agente |
| `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` | — | credenziali agente (vedi sotto) |

### Collegare l'agente (una tantum)

I pannelli e la galassia funzionano subito. I comandi in italiano all'agente richiedono
UNA di queste credenziali:

1. **Col tuo abbonamento Claude** (consigliato): nel Terminale `claude setup-token`,
   poi incolla il token in `.env.local` come `CLAUDE_CODE_OAUTH_TOKEN=...`.
   Se la CLI manca: `npm i -g @anthropic-ai/claude-code` e `claude /login`.
   In alternativa basta che la CLI `claude` sia loggata su questo Mac: NUCLEO la rileva da solo.
2. **Con una chiave API**: `ANTHROPIC_API_KEY=sk-ant-...` in `.env.local` (fatturazione a consumo).

Senza credenziali la console dell'agente spiega esattamente questi passi.

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
Obsidian e NUCLEO si aggiorna da solo (galassia compresa).

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
- Se sviluppi NUCLEO da dentro una sessione Claude Code, il runner del preview puo non
  avere i permessi macOS su `~/Documents`: in quel caso lancia `next dev` da un
  terminale normale. L'app in se non ha questo problema.
- Privacy: nessuna telemetria; i dati finanziari restano nel parsing locale; l'agente
  riceve solo il contesto del comando che gli dai.
