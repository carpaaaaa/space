# space

Il tuo vault Obsidian come una galassia. Cockpit locale che legge il vault
live, lo mostra come galassia a spirale (reference NGC 4414) e permette di
comandare un agente AI che scrive nelle note rispettando le regole del vault.

- **Utente**: chi tiene un vault Obsidian e lo vuole vedere e pilotare come un
  sistema vivo. Un utente per istanza, in locale, spesso di sera.
- **Register**: product (la UI serve il compito), con UNA superficie brand: la
  galassia. Scena fisica: stanza in penombra, laptop, il vault come cielo
  notturno da plancia di comando. Il tema scuro e forzato dalla scena.
- **Job da svolgere**: capire lo stato del sapere (galassia), agire in fretta
  (task, inbox, capture), controllare i numeri (finanze), comandare l'agente in
  linguaggio naturale.
- **Configurazione**: tutto cio che e personale vive in space.config.json e
  .env.local (gitignored). Il repo e un template pulito.
- **Privacy**: tutto locale. L'AI viene chiamata solo per comandi espliciti
  dell'agente; i pannelli non fanno mai rete esterna. Provider locale possibile.

## Superfici

1. **Galassia** (hero, brand moment): grafo reale del vault. Nucleo = orchestratore.
2. **Pannelli operativi** (product, restrained): Obiettivi, Progetti, Finanze,
   Inbox, Log, Ricerca, Aspetto.
3. **Command bar agente**: streaming, selettore modello, conferme diff per le
   azioni sensibili.

## Divieti non negoziabili (anti-slop)

- MAI il pulsing dot di stato "available/live". Stato = testo o glow diffuso.
- Niente glassmorphism freddo, serif decorativo, em-dash nel testo UI, eyebrow
  uppercase su ogni sezione, card tutte identiche, template look.
- Testi concisi, molto negative space, numeri tabellari per le finanze.
