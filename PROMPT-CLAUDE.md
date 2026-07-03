# Collega space al tuo vault con Claude

Hai clonato space e hai un vault Obsidian? Non serve configurare nulla a mano:
apri **Claude Code** (o Claude Desktop) nella cartella di space e incollagli il
prompt qui sotto. Claude ispeziona il tuo vault, genera la configurazione su
misura e avvia l'app.

---

Copia da qui:

```
Ho clonato space (questa cartella): un cockpit web locale che visualizza un
vault Obsidian come galassia e permette di comandare un agente AI sulle note.
Voglio collegarlo al MIO vault Obsidian. Fai tutto tu:

1. Chiedimi il percorso del mio vault se non riesci a trovarlo da solo
   (cerca cartelle con dentro `.obsidian/`).
2. Ispeziona il vault: cartelle top-level, lingua delle note, convenzioni di
   frontmatter, eventuali file di regole (CLAUDE.md o simili), cartelle di
   allegati/archivio/log da trattare come polvere o da escludere.
3. Genera `space.config.json` partendo da `space.config.example.json`:
   percorso e nome del vault, un'area per ogni cartella significativa con un
   colore adatto (desaturato, leggibile su fondo scuro), `polvere: true` per
   log e archivi, esclusioni per allegati e template.
4. Chiedimi quale AI voglio usare per l'agente:
   - se ho un abbonamento Claude: guidami con `claude setup-token` e metti il
     token in `.env.local` come CLAUDE_CODE_OAUTH_TOKEN;
   - se ho una chiave API Anthropic: ANTHROPIC_API_KEY in `.env.local`;
   - se voglio un modello locale gratuito (Ollama/Hermes/LM Studio): configura
     un modello `provider: "openai"` in space.config.json con la baseUrl giusta
     e aiutami a installarlo se manca.
5. `npm install`, poi avvia con `npm run dev` e verifica che
   http://localhost:3000 mostri la galassia del MIO vault (le aree devono
   corrispondere alle mie cartelle).
6. Spiegami in due righe come si usa: ricerca (cmd+K), click sulle stelle,
   pannelli, comando all'agente dalla barra in alto.

Regole: non modificare MAI le note del mio vault in questa fase (solo lettura);
tutta la configurazione va nei file di space (space.config.json, .env.local),
che sono gitignored.
```

---

Note:

- Il file `space.config.example.json` documenta ogni campo disponibile.
- Senza `space.config.json`, space funziona lo stesso: scopre le aree dalle
  cartelle del vault e genera una palette. Il config serve per nomi, colori e
  agente su misura.
- I pannelli e la galassia non richiedono nessuna credenziale: solo i comandi
  all'agente ne hanno bisogno.
