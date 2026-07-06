import test from "node:test";
import assert from "node:assert/strict";
import { parseSkillNota, conEsito, conStato } from "../src/lib/fucina/skillNota.ts";

const VALIDA = `---
tipo: skill
stato: attiva
trigger: [comando, ogni]
comando: smista-inbox
ogni: "09:00"
motivazione: prova
---

## Obiettivo
Fai la cosa.
`;

test("parsa una skill valida", () => {
  const r = parseSkillNota(VALIDA, "Skills/Smista.md");
  assert.equal(r.scartata, undefined);
  assert.equal(r.skill?.nome, "Smista");
  assert.equal(r.skill?.stato, "attiva");
  assert.deepEqual(r.skill?.trigger, ["comando", "ogni"]);
  assert.equal(r.skill?.comando, "smista-inbox");
  assert.equal(r.skill?.ogni, "09:00");
  assert.match(r.skill?.corpo ?? "", /Fai la cosa/);
});

test("trigger scalare accettato", () => {
  const s = `---\ntipo: skill\nstato: pausa\ntrigger: comando\ncomando: x1\n---\ncorpo`;
  const r = parseSkillNota(s, "a.md");
  assert.deepEqual(r.skill?.trigger, ["comando"]);
});

test("scarta tipo mancante, stato invalido, trigger incoerenti", () => {
  assert.ok(parseSkillNota("---\nstato: attiva\n---\nx", "a.md").scartata);
  assert.ok(
    parseSkillNota("---\ntipo: skill\nstato: forse\ntrigger: comando\ncomando: a\n---\nx", "a.md")
      .scartata
  );
  const senzaSlug = VALIDA.replace("comando: smista-inbox\n", "");
  assert.ok(parseSkillNota(senzaSlug, "a.md").scartata);
  const ogniRotto = VALIDA.replace('"09:00"', '"9 di sera"');
  assert.ok(parseSkillNota(ogniRotto, "a.md").scartata);
  const corpoVuoto = `---\ntipo: skill\nstato: attiva\ntrigger: comando\ncomando: a\n---\n`;
  assert.ok(parseSkillNota(corpoVuoto, "a.md").scartata);
});

test("trigger evento richiede dove", () => {
  const senzaDove = `---\ntipo: skill\nstato: attiva\ntrigger: evento\nevento: nuova-nota\n---\nx`;
  assert.ok(parseSkillNota(senzaDove, "a.md").scartata);
  const ok = `---\ntipo: skill\nstato: attiva\ntrigger: evento\nevento: nuova-nota\ndove: Inbox/\n---\nx`;
  const r = parseSkillNota(ok, "a.md");
  assert.equal(r.skill?.dove, "Inbox/");
  assert.equal(r.skill?.evento, "nuova-nota");
});

test("campo output opzionale letto dal frontmatter", () => {
  const conOut = VALIDA.replace(
    "motivazione: prova",
    "output: 02_FINANZE/Come va il mese.md\nmotivazione: prova"
  );
  assert.equal(parseSkillNota(conOut, "a.md").skill?.output, "02_FINANZE/Come va il mese.md");
  // assente o vuoto -> undefined
  assert.equal(parseSkillNota(VALIDA, "a.md").skill?.output, undefined);
});

test("campo descrizione opzionale letto dal frontmatter", () => {
  const conDescr = VALIDA.replace(
    "motivazione: prova",
    "descrizione: Fa la cosa quando gira.\nmotivazione: prova"
  );
  assert.equal(parseSkillNota(conDescr, "a.md").skill?.descrizione, "Fa la cosa quando gira.");
  assert.equal(parseSkillNota(VALIDA, "a.md").skill?.descrizione, undefined);
});

test("campi runtime letti dal frontmatter", () => {
  const s = `---\ntipo: skill\nstato: attiva\ntrigger: comando\ncomando: a\nultima-esecuzione: "2026-07-04 09:01"\nesito: errore\n---\nx`;
  const r = parseSkillNota(s, "a.md");
  assert.equal(r.skill?.ultimaEsecuzione, "2026-07-04 09:01");
  assert.equal(r.skill?.esito, "errore");
});

test("CRLF normalizzato (note scritte da Windows)", () => {
  const r = parseSkillNota(VALIDA.replace(/\n/g, "\r\n"), "a.md");
  assert.equal(r.skill?.comando, "smista-inbox");
});

test("conEsito aggiorna il frontmatter senza toccare il corpo", () => {
  const dopo = conEsito(VALIDA, { quando: "2026-07-05 09:01", esito: "ok" });
  assert.match(dopo, /ultima-esecuzione: ['"]?2026-07-05 09:01/);
  assert.match(dopo, /esito: ok/);
  assert.match(dopo, /Fai la cosa/);
  const due = conEsito(dopo, { quando: "2026-07-05 10:00", esito: "errore" });
  assert.equal(due.match(/ultima-esecuzione/g)?.length, 1);
  assert.match(due, /esito: errore/);
});

test("conStato cambia solo lo stato", () => {
  const dopo = conStato(VALIDA, "pausa");
  assert.match(dopo, /stato: pausa/);
  assert.match(dopo, /comando: smista-inbox/);
  const r = parseSkillNota(dopo, "a.md");
  assert.equal(r.skill?.stato, "pausa");
});
