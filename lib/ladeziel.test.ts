import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultData, emptyRow, ladeStand, neuesteZuerst, vollReichweite } from "./data";
import type { ChargeRow } from "./types";

// v2.49.00: Ladeziel 80 % und Reihenfolge am selben Tag (Wünsche vom 18.10.2026)

function row(datum: string, vorher: number, nachher: number, extra: Partial<ChargeRow> = {}): ChargeRow {
  return { ...emptyRow(), datum, fahrzeug: "b10", reichweiteVorher: String(vorher), reichweiteNachher: String(nachher), ...extra };
}
function mit(rows: ChargeRow[]) {
  const d = defaultData();
  for (const r of rows) d.months[r.datum.slice(0, 7)].push(r);
  return d;
}

test("80 %: volle Reichweite = Reichweite neu ÷ 0,8", () => {
  const d = mit([row("2026-10-17", 100, 360, { ziel80: true })]);
  assert.equal(vollReichweite(d, "b10"), 450);
});

test("voll und 80 % werden gemeinsam gemittelt", () => {
  const d = mit([row("2026-10-16", 50, 440, { voll: true }), row("2026-10-17", 100, 368, { ziel80: true })]);
  assert.equal(vollReichweite(d, "b10"), (440 + 460) / 2);
});

test("Ladering: 80 % endet bei 80, vorher relativ zur vollen Reichweite", () => {
  const r = row("2026-10-17", 90, 360, { ziel80: true });
  const d = mit([r]);
  assert.deepEqual(ladeStand(d, r), { vor: 20, nach: 80 }); // 90 ÷ 450
});

test("Ladering: voll bleibt 100, teilweise höchstens 99", () => {
  const voll = row("2026-10-16", 44, 440, { voll: true });
  const teil = row("2026-10-18", 44, 439);
  const d = mit([voll, teil]);
  assert.deepEqual(ladeStand(d, voll), { vor: 10, nach: 100 });
  assert.equal(ladeStand(d, teil)!.nach, 99);
});

test("Historie: am selben Tag steht der jüngste oben (Startzeit)", () => {
  const a = { row: row("2026-10-18", 0, 0, { start: "07:30" }), idx: 2 };
  const b = { row: row("2026-10-18", 0, 0, { start: "19:41" }), idx: 0 };
  const c = { row: row("2026-10-18", 0, 0, { start: "12:05" }), idx: 1 };
  const v = { row: row("2026-10-17", 0, 0, { start: "23:00" }), idx: 3 };
  assert.deepEqual([a, v, b, c].sort(neuesteZuerst).map((x) => x.row.start), ["19:41", "12:05", "07:30", "23:00"]);
});

test("Historie: ohne Startzeit steht der zuletzt eingetragene oben", () => {
  const alt = { row: row("2026-09-01", 0, 0), idx: 0 };
  const neu = { row: row("2026-09-01", 0, 0), idx: 1 };
  assert.deepEqual([alt, neu].sort(neuesteZuerst), [neu, alt]);
});
