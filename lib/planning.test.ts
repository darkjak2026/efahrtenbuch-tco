import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultData, emptyRow } from "./data";
import { fahrtPreisProKm, planeStrecke, strompreisProKwh } from "./planning";
import type { AppData, ChargeRow, VehicleKey } from "./types";

// Planung seit v2.50.00: nur noch km × Ø Verbrauch × Ø Strompreis.

const TODAY = new Date("2026-10-08T12:00:00");

function row(datum: string, fahrzeug: VehicleKey, km: number, preis = "", kwh = ""): ChargeRow {
  return { ...emptyRow(), datum, fahrzeug, km: String(km), preis, kwh };
}
function dataWith(rows: ChargeRow[]): AppData {
  const d = defaultData();
  d.vehicles.t03.stichtag = "";
  d.vehicles.t03.stichtagKm = "";
  d.recurringCosts = [];
  d.investitionen = [];
  for (const r of rows) d.months[r.datum.slice(0, 7)].push(r);
  return d;
}

test("Ø Strompreis = Summe Preis ÷ Summe kWh (nur Vorgänge mit beidem)", () => {
  const d = dataWith([row("2026-09-20", "t03", 1000, "30", "50"), row("2026-10-01", "t03", 1300, "30", "50"), row("2026-10-02", "t03", 1400, "9")]);
  assert.equal(strompreisProKwh(d, "t03")!.proKwh, 0.6);
});

test("Preis je km = Ø Verbrauch × Ø Strompreis", () => {
  const d = dataWith([row("2026-09-20", "t03", 1000, "30", "50"), row("2026-10-01", "t03", 1300, "30", "50")]);
  d.vehicles.t03.verbrauchKwh100 = "13";
  const p = fahrtPreisProKm(d, "t03")!;
  assert.equal(p.verbrauch, 13);
  assert.equal(p.proKwh, 0.6);
  assert.ok(Math.abs(p.proKm - 0.078) < 1e-9); // 80 km kosten 6,24 €
});

test("ohne Ø Verbrauch oder ohne Ladevorgang mit kWh gibt es keinen Preis (keine Ersatzrechnung)", () => {
  const d = dataWith([row("2026-09-20", "t03", 1000, "30", "50")]);
  d.vehicles.t03.verbrauchKwh100 = "";
  assert.equal(fahrtPreisProKm(d, "t03"), null);
  const leer = dataWith([row("2026-09-20", "t03", 1000, "30")]);
  leer.vehicles.t03.verbrauchKwh100 = "13";
  assert.equal(fahrtPreisProKm(leer, "t03"), null);
});

test("planeStrecke: je Auto Preis, Verfügbarkeit (Übergabedatum) und Leasingjahr", () => {
  const d = dataWith([row("2026-09-20", "t03", 1000, "30", "50")]);
  d.vehicles.t03.start = "2025-11-28";
  d.vehicles.t03.freiKmGesamt = 37500;
  d.vehicles.t03.verbrauchKwh100 = "13";
  d.vehicles.b10.start = "";
  const autos = planeStrecke(d, TODAY);
  assert.deepEqual(autos.map((a) => a.vehicle), ["b10", "t03"]);
  const [b10, t03] = autos;
  assert.equal(b10.verfuegbar, false);
  assert.equal(t03.verfuegbar, true);
  assert.ok(t03.preis && Math.abs(t03.preis.proKm - 0.078) < 1e-9);
  assert.equal(t03.leasingJahr!.nr, 1);
});
