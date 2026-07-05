import test from "node:test";
import assert from "node:assert/strict";
import {
  parseOgni,
  ultimaOccorrenza,
  daRieseguire,
  adessoStr,
} from "../src/lib/fucina/scadenze.ts";

const d = (s) => new Date(s.replace(" ", "T") + ":00");

test("parseOgni: giornaliero, settimanale, malformati", () => {
  assert.deepEqual(parseOgni("09:00"), { giorno: null, ore: 9, minuti: 0 });
  assert.deepEqual(parseOgni("lun 18:30"), { giorno: 1, ore: 18, minuti: 30 });
  assert.deepEqual(parseOgni("dom 7:05"), { giorno: 0, ore: 7, minuti: 5 });
  assert.equal(parseOgni("9 di sera"), null);
  assert.equal(parseOgni("lun 25:00"), null);
  assert.equal(parseOgni("xyz 09:00"), null);
  assert.equal(parseOgni(""), null);
});

test("ultimaOccorrenza giornaliera", () => {
  assert.equal(
    +ultimaOccorrenza("09:00", d("2026-07-04 10:00")),
    +d("2026-07-04 09:00")
  );
  assert.equal(
    +ultimaOccorrenza("09:00", d("2026-07-04 08:00")),
    +d("2026-07-03 09:00")
  );
  // esattamente all'orario: conta come occorsa
  assert.equal(
    +ultimaOccorrenza("09:00", d("2026-07-04 09:00")),
    +d("2026-07-04 09:00")
  );
});

test("ultimaOccorrenza settimanale", () => {
  // 2026-07-05 e domenica; "lun 09:00" -> lunedi scorso 2026-06-29
  assert.equal(
    +ultimaOccorrenza("lun 09:00", d("2026-07-05 12:00")),
    +d("2026-06-29 09:00")
  );
  // lunedi stesso, prima dell'orario -> lunedi precedente
  assert.equal(
    +ultimaOccorrenza("lun 09:00", d("2026-06-29 08:00")),
    +d("2026-06-22 09:00")
  );
});

test("daRieseguire: catch-up e ultima-esecuzione", () => {
  const skill = { ogni: "09:00", ultimaEsecuzione: "2026-07-03 09:01" };
  assert.equal(daRieseguire(skill, d("2026-07-04 09:02")), true); // scaduta oggi
  assert.equal(daRieseguire(skill, d("2026-07-03 12:00")), false); // gia fatta
  assert.equal(daRieseguire({ ogni: "09:00" }, d("2026-07-04 10:00")), true); // mai girata
  assert.equal(daRieseguire({}, d("2026-07-04 10:00")), false); // niente ogni
  // ultima-esecuzione malformata = come mai girata
  assert.equal(
    daRieseguire({ ogni: "09:00", ultimaEsecuzione: "boh" }, d("2026-07-04 10:00")),
    true
  );
});

test("adessoStr: formato YYYY-MM-DD HH:MM", () => {
  assert.equal(adessoStr(d("2026-07-05 09:03")), "2026-07-05 09:03");
});
