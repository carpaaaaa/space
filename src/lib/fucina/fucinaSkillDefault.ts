/**
 * La nota-skill di sistema "Fucina": viene copiata nella cartella skills
 * del vault al primo avvio, se manca. Da li in poi appartiene all'utente,
 * che puo modificarla come qualsiasi altra nota.
 */

export const NOME_FILE_FUCINA = "Fucina.md";
export const SLUG_FUCINA = "forgia";

export const FUCINA_DEFAULT = `---
tipo: skill
stato: attiva
trigger: [comando, ogni]
comando: forgia
ogni: "09:00"
motivazione: Skill di sistema di space, la fucina che propone le altre.
---

## Obiettivo

Analizza il vault e proponi skill utili, senza mai attivarle da solo.

## Passi

1. Leggi lo stato del vault: obiettivi e task (scadute e ricorrenti),
   progetti attivi, inbox, log degli ultimi 14 giorni.
2. Cerca due segnali: azioni ripetute a mano (stesse operazioni nel log,
   inbox che si accumula) e obiettivi fermi (task vecchie, progetti senza
   log recenti).
3. Per ogni segnale forte (massimo 3), scrivi una nota-skill nella stessa
   cartella di questa nota, nello stesso formato, con:
   - \`tipo: skill\` e \`stato: proposta\` (SEMPRE proposta: mai attiva, mai pausa)
   - \`trigger\` adatto: \`comando\` con uno slug breve (minuscole e trattini),
     oppure anche \`ogni: "HH:MM"\` / \`evento: nuova-nota\` + \`dove: Cartella/\`
     se ha senso che giri da sola una volta approvata
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
