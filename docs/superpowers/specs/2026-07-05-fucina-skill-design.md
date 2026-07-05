# Fucina: skill generate dal vault e promosse ad automazioni

Data: 2026-07-05 · Stato: approvato dall'utente (con modifiche) · Branch: fable/upgrade

## Idea

Space analizza il vault (obiettivi, progetti, task, inbox, log), capisce cosa
l'utente fa a mano o dove gli obiettivi sono fermi, e propone skill su misura.
Una skill approvata puo diventare un'automazione che gira da sola. Tutto il
ciclo (analisi, proposta, approvazione, esecuzione, esito) vive nel vault.

Decisioni prese con l'utente:

- Le skill sono note markdown nel vault, eseguite dall'agente di Space.
- Automazioni: a orario con Space aperto (catch-up all'avvio) e su eventi del
  vault. Niente launchd.
- Run automatici full-auto: scrivono senza conferma; restano i deny duri
  (fuori vault, dotfolder, svuotamenti-cancellazioni).
- La fucina parte a comando (`/forgia`) E con revisione periodica ogni giorno
  alle 09:00.
- Pannello dedicato dove leggere tutte le skill/automazioni.

## 1. Contratto: una skill e una nota

Cartella configurabile in `space.config.json` (chiave `skills.cartella`;
per l'istanza personale `08_AI/Skills`, default template `Skills`).

```markdown
---
tipo: skill
stato: proposta          # proposta | attiva | pausa
trigger: comando         # uno o piu tra: comando | ogni | evento (lista YAML se piu di uno)
comando: smista-inbox    # slug slash command (trigger: comando)
ogni: "lun 09:00"        # "09:00" giornaliero, "lun 09:00" settimanale (trigger: ogni)
evento: nuova-nota       # unico evento v1 (trigger: evento)
dove: Inbox/             # filtro cartella per l'evento
motivazione: Smisti l'inbox a mano ogni sera da tre settimane.
ultima-esecuzione: 2026-07-05 09:01   # scritta dal runtime
esito: ok                # ok | errore (scritto dal runtime)
---

## Obiettivo
Playbook in prosa: cosa fare, passi, vincoli, output atteso.
```

- Il corpo della nota e il prompt che l'agente esegue.
- Approvare = cambiare `stato: proposta -> attiva` (da Obsidian o dal pannello).
- Lo stato di runtime sta nel frontmatter: visibile nel vault, nessun registro
  parallelo.
- Una skill puo avere trigger `comando` e basta: e una "ricetta manuale", non
  un'automazione. La promozione ad automazione = darle `ogni` o `evento`.

## 2. Caricamento ed esecuzione

- `src/lib/vault/skills.ts`: legge la cartella, parse frontmatter con
  gray-matter (gia in dipendenza), valida; le note malformate sono scartate
  con motivo (mai eseguite, mostrate nel pannello).
- `GET /api/skills`: elenco skill + motivi di scarto. Cache invalidata dal
  watcher chokidar esistente.
- Esecuzione: riuso di `eseguiComando()` con nuova opzione `unattended`:
  - interattivo (command bar): comportamento attuale, conferme diff comprese;
  - unattended (scheduler/eventi): le regole `ask` di `classificaScrittura`
    diventano `allow`; le regole `deny` restano `deny`. Nessuno stream verso
    la UI: esito nel frontmatter della skill + riga nel log giornaliero del
    vault (convenzione gia esistente dell'agente).
- Concorrenza: l'agente e gia single-flight (`occupato`); i run automatici
  entrano in una coda FIFO in memoria, uno alla volta. Un comando manuale
  dell'utente ha precedenza sulla coda.

## 3. Scheduler e trigger

- `src/lib/fucina/scheduler.ts`, avviato col server Next (meccanismo di avvio
  da verificare sui doc bundled in `node_modules/next/dist/docs/`, vincolo
  AGENTS.md: probabilmente `instrumentation.ts`).
- Tick al minuto: ogni skill `attiva` con `ogni` la cui scadenza piu recente e
  successiva a `ultima-esecuzione` parte. Questo da gratis il catch-up
  all'avvio se Space era chiuso all'orario previsto.
- Eventi: il watcher esistente notifica `add` di note; se il percorso matcha
  `dove:` di una skill `attiva` con `trigger: evento`, la skill parte
  (debounce 30s per burst di file).
- Guardie anti-loop:
  - le scritture nella cartella skills non generano eventi trigger;
  - le scritture fatte dall'agente durante un run non generano eventi trigger
    (finestra di soppressione durante il run);
  - limite configurabile di run automatici al giorno (`skills.maxRunGiorno`,
    default 20); superato il limite, i run saltano e il pannello lo dice.

## 4. La fucina

Skill di sistema fornita col template: il sorgente sta nel repo
(`src/lib/fucina/Fucina.md`) e viene copiato nella cartella skills al primo
avvio se manca una nota con `comando: forgia`. Doppia veste
(`trigger: [comando, ogni]`):

- comando `/forgia` on-demand;
- revisione periodica `ogni: "09:00"` (giornaliera, alle 9).

Playbook: leggi obiettivi, progetti, task scadute, inbox e log recenti;
individua attriti ripetuti e obiettivi fermi; proponi al massimo 3 skill nuove
o ritocchi a skill esistenti; scrivi le proposte come note-skill con
`stato: proposta` e `motivazione` onesta; non attivare mai nulla da solo.

Sicurezza by design: la revisione periodica e full-auto ma produce solo
proposte inerti; nulla gira finche l'utente non cambia lo stato ad `attiva`.

## 5. UI: pannello Skills

Nuovo pannello nella NavRail (register product, vocabolario DESIGN.md):

- elenco completo di skill e automazioni: nome, trigger ("comando", "ogni
  giorno 09:00", "su nuova nota in Inbox/"), stato come testo (mai pulsing
  dot), ultima esecuzione ed esito in JetBrains Mono;
- proposte della fucina in testa, bordo oro tenue, con la motivazione;
- azioni per riga: attiva/pausa, esegui ora, apri nota (drawer esistente);
- skill malformate in coda con il motivo dello scarto;
- empty state: una riga calda che invita a lanciare `/forgia`;
- command bar: le skill `attiva` con `trigger: comando` compaiono come
  suggerimenti `/slug`.

## 6. Errori, config, coerenza di prodotto

- Run fallito: `esito: errore` nel frontmatter + dettaglio nel log del vault.
- Skill malformata: mai eseguita, motivo visibile nel pannello.
- `space.config.json`: `skills.cartella`, `skills.maxRunGiorno`,
  `skills.fucinaPeriodica` (bool per spegnere la revisione delle 9).
- PRODUCT.md da aggiornare: "l'AI parte solo su comando esplicito" diventa
  "o su automazioni attivate esplicitamente dall'utente, skill per skill".
- Template pubblico pulito: la fucina di sistema e un file del template;
  cartella e limiti personali stanno in `space.config.json` gitignored.

## 7. Test

- Logica pura con `node:test` (zero dipendenze nuove): parser/validazione
  frontmatter, calcolo scadenze e catch-up, matching eventi, guardie
  anti-loop, contatore run giornalieri.
- Ciclo completo a mano contro il vault reale, preferendo il modello locale
  (Hermes) per i run di prova.

## Fuori scope (v1)

- Eventi diversi da `nuova-nota` (modifica, cancellazione, tag).
- Esecuzione a Space chiuso (launchd).
- Export delle skill verso ~/.claude/skills.
- Storico esecuzioni oltre l'ultima (il log giornaliero resta la cronologia).
