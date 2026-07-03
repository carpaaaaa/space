# NUCLEO

Il cervello del vault Mind. Cockpit locale che legge `~/Documents/Mind` live, lo mostra come
galassia (reference NGC 4414) e permette di comandare un agente Claude che scrive nel vault
rispettando `_CLAUDE.md`.

- **Utente**: bozzo, designer freelance italiano. Un solo utente, in locale, spesso di sera.
- **Register**: product (la UI serve il compito), con UNA superficie brand: la galassia.
  Scena fisica: stanza in penombra, MacBook Air, il vault come cielo notturno da plancia
  di comando. Il tema scuro è forzato dalla scena, non è una scelta di stile.
- **Job da svolgere**: capire lo stato del sapere (galassia), agire in fretta (task, inbox,
  capture), controllare i numeri (finanze), comandare l'agente in italiano naturale.
- **Lingua**: italiano, sempre.
- **Privacy**: tutto locale. L'API Anthropic viene chiamata solo per comandi espliciti
  dell'agente; i pannelli non fanno mai rete esterna.

## Superfici

1. **Galassia** (hero, brand moment): grafo reale del vault. Nucleo dorato = orchestratore.
2. **Pannelli operativi** (product, restrained): Oggi, Progetti, Finanze, Inbox, Log, Ricerca.
3. **Command bar agente**: nel nucleo, streaming, con conferma diff per azioni sensibili.

## Divieti non negoziabili (dal gusto dell'utente, CLAUDE.md del vault)

- MAI il pulsing dot di stato "available/live". Stato = testo o glow diffuso.
- Niente glassmorphism freddo, serif decorativo, em-dash nel testo UI, eyebrow uppercase
  su ogni sezione, card tutte identiche, template look.
- Testi concisi, molto negative space, numeri tabellari per le finanze.
