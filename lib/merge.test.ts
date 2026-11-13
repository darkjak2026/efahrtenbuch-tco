import { test } from "node:test";
import assert from "node:assert/strict";
import { canon, contentKey, mergeAppData } from "./merge";
import { defaultData, emptyRow } from "./data";
import type { AppData, ChargeRow } from "./types";

// v2.56.02: zwei Geräte speichern gleichzeitig – nichts geht verloren.

const MONAT = "2026-11";
const row = (datum: string, fahrzeug: "b10" | "t03", km: string): ChargeRow => ({ ...emptyRow(), datum, fahrzeug, km });
const stand = (rev = 5): AppData => ({ ...defaultData(), _rev: rev });
const kopie = (d: AppData): AppData => structuredClone(d);
const eintraege = (d: AppData) => d.months[MONAT].filter((r) => r.datum).map((r) => `${r.fahrzeug}:${r.km}`);

test("beide Geräte fügen je einen Ladevorgang hinzu: beide bleiben erhalten", () => {
  const base = stand();
  const lokal = kopie(base);
  lokal.months[MONAT].push(row("2026-11-12", "b10", "2900"));
  const fern = { ...kopie(base), _rev: 6 };
  fern.months[MONAT].push(row("2026-11-12", "t03", "12100"));
  const m = mergeAppData(base, lokal, fern);
  assert.deepEqual(eintraege(m.data), ["b10:2900", "t03:12100"]);
  assert.deepEqual(m.conflicts, []);
  assert.equal(m.data._rev, 6); // trägt die Revision des Servers, kann direkt gespeichert werden
});

test("verschiedene Felder an verschiedenen Stellen: beide Änderungen gelten", () => {
  const base = stand();
  const lokal = kopie(base);
  lokal.vehicles.b10.leasing = "331.51";
  const fern = { ...kopie(base), _rev: 6 };
  fern.vehicles.t03.leasing = "149";
  const m = mergeAppData(base, lokal, fern);
  assert.equal(m.data.vehicles.b10.leasing, "331.51");
  assert.equal(m.data.vehicles.t03.leasing, "149");
  assert.deepEqual(m.conflicts, []);
});

test("dasselbe Feld verschieden geändert: die eigene Änderung gewinnt und wird gemeldet", () => {
  const base = stand();
  const lokal = kopie(base);
  lokal.vehicles.b10.leasing = "300";
  const fern = { ...kopie(base), _rev: 6 };
  fern.vehicles.b10.leasing = "310";
  const m = mergeAppData(base, lokal, fern);
  assert.equal(m.data.vehicles.b10.leasing, "300");
  assert.deepEqual(m.conflicts, ["vehicles.b10.leasing"]);
});

test("das andere Gerät löscht einen Eintrag, hier kommt ein neuer dazu: beides gilt", () => {
  const base = stand();
  base.months[MONAT].push(row("2026-11-05", "b10", "2232"));
  const lokal = kopie(base);
  lokal.months[MONAT].push(row("2026-11-12", "b10", "2900"));
  const fern = { ...kopie(base), _rev: 6 };
  fern.months[MONAT] = fern.months[MONAT].filter((r) => r.km !== "2232");
  const m = mergeAppData(base, lokal, fern);
  assert.deepEqual(eintraege(m.data), ["b10:2900"]);
});

test("derselbe Eintrag auf beiden Seiten (Antwort ging verloren, Speichern wiederholt) zählt nur einmal", () => {
  const base = stand();
  const neu = row("2026-11-12", "b10", "2900");
  const lokal = kopie(base);
  lokal.months[MONAT].push(neu);
  const fern = { ...kopie(base), _rev: 6 };
  fern.months[MONAT].push({ ...neu });
  const m = mergeAppData(base, lokal, fern);
  assert.deepEqual(eintraege(m.data), ["b10:2900"]);
});

test("die Schlüsselreihenfolge spielt keine Rolle (Postgres sortiert Schlüssel um)", () => {
  const base = stand();
  const x = row("2026-11-05", "b10", "2232");
  base.months[MONAT].push(x);
  const lokal = kopie(base);
  lokal.months[MONAT].push(row("2026-11-12", "t03", "12100"));
  const fern = { ...kopie(base), _rev: 6 };
  const umgestellt = Object.fromEntries(Object.entries(x).reverse()) as unknown as ChargeRow;
  fern.months[MONAT] = fern.months[MONAT].map((r) => (r.km === "2232" ? umgestellt : r));
  const m = mergeAppData(base, lokal, fern);
  assert.deepEqual(eintraege(m.data), ["b10:2232", "t03:12100"]);
  assert.equal(canon({ a: 1, b: [2, { d: 4, c: 3 }] }), canon({ b: [2, { c: 3, d: 4 }], a: 1 }));
});

test("nichts selbst geändert: der Serverstand gilt; nur selbst geändert: der eigene Stand gilt", () => {
  const base = stand();
  const fern = { ...kopie(base), _rev: 6 };
  fern.months[MONAT].push(row("2026-11-12", "t03", "12100"));
  assert.deepEqual(eintraege(mergeAppData(base, kopie(base), fern).data), ["t03:12100"]);
  const lokal = kopie(base);
  lokal.months[MONAT].push(row("2026-11-12", "b10", "2900"));
  assert.deepEqual(eintraege(mergeAppData(base, lokal, { ...kopie(base), _rev: 6 }).data), ["b10:2900"]);
});

test("eigene Reihenfolge bleibt stabil, fremde Neuzugänge kommen ans Ende", () => {
  const base = stand();
  base.months[MONAT].push(row("2026-11-01", "b10", "1"), row("2026-11-02", "b10", "2"));
  const lokal = kopie(base);
  lokal.months[MONAT].push(row("2026-11-03", "b10", "3"));
  const fern = { ...kopie(base), _rev: 6 };
  fern.months[MONAT].push(row("2026-11-04", "b10", "4"));
  const m = mergeAppData(base, lokal, fern);
  assert.deepEqual(eintraege(m.data), ["b10:1", "b10:2", "b10:3", "b10:4"]);
});

test("beide ändern denselben Eintrag verschieden: beide Fassungen bleiben, es wird gemeldet", () => {
  const base = stand();
  base.months[MONAT].push(row("2026-11-05", "b10", "2232"));
  const lokal = kopie(base);
  lokal.months[MONAT] = lokal.months[MONAT].map((r) => (r.km === "2232" ? { ...r, km: "2233" } : r));
  const fern = { ...kopie(base), _rev: 6 };
  fern.months[MONAT] = fern.months[MONAT].map((r) => (r.km === "2232" ? { ...r, km: "2234" } : r));
  const m = mergeAppData(base, lokal, fern);
  assert.deepEqual(eintraege(m.data), ["b10:2233", "b10:2234"]);
  assert.equal(m.conflicts.length, 1);
});

test("Wünsche aus dem Entwicklerbereich von zwei Geräten gehen nicht verloren", () => {
  const base = stand();
  const lokal = kopie(base);
  lokal.featureRequests.push({ id: "a", ts: "2026-11-12||11:58", text: "Wunsch A", status: "offen" } as AppData["featureRequests"][number]);
  const fern = { ...kopie(base), _rev: 6 };
  fern.featureRequests.push({ id: "b", ts: "2026-11-12||11:59", text: "Wunsch B", status: "offen" } as AppData["featureRequests"][number]);
  const m = mergeAppData(base, lokal, fern);
  assert.deepEqual(m.data.featureRequests.map((f) => f.text), ["Wunsch A", "Wunsch B"]);
});

test("Vergleichstext ignoriert die Revision", () => {
  const a = stand(5);
  const b = { ...kopie(a), _rev: 9 };
  assert.equal(contentKey(a), contentKey(b));
  b.months[MONAT].push(row("2026-11-12", "b10", "2900"));
  assert.notEqual(contentKey(a), contentKey(b));
});
