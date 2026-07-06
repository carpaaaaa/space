/**
 * La nota-skill di sistema "Osservatorio": viene copiata nella cartella
 * skills del vault al primo avvio, se manca. Da li in poi appartiene
 * all'utente, che puo modificarla come qualsiasi altra nota.
 */

export const NOME_FILE_FUCINA = "Osservatorio.md";
export const SLUG_FUCINA = "osserva";

export const FUCINA_DEFAULT = `---
tipo: skill
stato: attiva
trigger: [comando, ogni]
comando: osserva
ogni: "09:00"
descrizione: Legge il vault e propone nuove skill quando nota qualcosa di ripetitivo o fermo.
motivazione: Skill di sistema di space, osserva la galassia del vault e propone le altre.
---

## Obiettivo

Osserva la galassia del vault e proponi skill utili, senza mai attivarle
da solo.

## Passi

1. Leggi lo stato del vault: obiettivi e task (scadute e ricorrenti),
   progetti attivi, inbox, log degli ultimi 14 giorni.
2. Cerca due segnali: azioni ripetute a mano (stesse operazioni nel log,
   inbox che si accumula) e obiettivi fermi (task vecchie, progetti senza
   log recenti).
3. Per ogni segnale forte (massimo 3), scrivi una nota-skill nella stessa
   cartella di questa nota, nello stesso formato, con:
   - \`tipo: skill\` e \`stato: proposta\` (SEMPRE proposta: mai attiva, mai
     pausa; anche se scrivi altro, space forza comunque proposta)
   - \`trigger\` adatto: \`comando\` con uno slug breve (minuscole e trattini),
     oppure anche \`ogni: "HH:MM"\` / \`evento: nuova-nota\` + \`dove: Cartella/\`
     se ha senso che giri da sola una volta approvata
   - \`descrizione:\` UNA riga, presente tempo, che dice cosa fa la skill
     quando gira (es. "Scrive un cruscotto di come sta andando il mese").
     Diversa dalla motivazione: la motivazione spiega perche' la proponi,
     la descrizione spiega cosa fa. Sempre in prima persona neutra, mai
     "questa skill...".
   - \`output: Cartella/Nome.md\` SOLO se la skill mantiene un'unica nota di
     sintesi che ha senso mostrare come risultato (non per skill che
     scrivono su note sparse o esistenti)
   - \`motivazione:\` una riga onesta che spiega il segnale osservato
   - un playbook chiaro nel corpo: obiettivo, passi, vincoli, output atteso
4. Se una skill esistente andrebbe ritoccata, NON modificarla: scrivi la
   proposta come nuova nota con \`stato: proposta\` e una motivazione che
   spiega il ritocco.
5. Se non trovi segnali forti, non scrivere nulla: nessuna proposta e
   meglio di una proposta debole.

## Vincoli

- Mai piu di 3 proposte per esecuzione.
- Mai attivare, mettere in pausa, modificare o cancellare skill esistenti.
- Non proporre skill che duplicano una skill gia presente.
- Registra l'esecuzione nel log del vault come da regole.
`;
