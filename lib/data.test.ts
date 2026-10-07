import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultData, emptyRow, monthKmDriven } from "./data";
import type { AppData, ChargeRow, VehicleKey } from "./types";

function row(datum: string, fahrzeug: VehicleKey, km: number): ChargeRow {
  return { ...emptyRow(), datum, fahrzeug, km: String(km) };
}

function dataWith(rows: ChargeRow[]): AppData {
  const d = defaultData();
  d.vehicles.t03.stichtag = "";
  d.vehicles.t03.stichtagKm = "";
  for (const r of rows) d.months[r.datum.slice(0, 7)].push(r);
  return d;
}

test("km im Monat = letzter Stand im Monat minus letzter Stand davor", () => {
  const d = dataWith([row("2026-09-28", "t03", 10000), row("2026-10-05", "t03", 10300), row("2026-10-20", "t03", 10650)]);
  const km = monthKmDriven(d, "2026-10");
  assert.equal(km.perVehicle.t03, 650);
  assert.equal(km.perVehicle.b10, null);
  assert.equal(km.total, 650);
});

test("Ladung am letzten Tag des Monats zählt mit (keine Zeitzonen-Verschiebung)", () => {
  const d = dataWith([row("2026-09-30", "t03", 10000), row("2026-10-31", "t03", 10400)]);
  assert.equal(monthKmDriven(d, "2026-10").perVehicle.t03, 400);
  assert.equal(monthKmDriven(d, "2026-09").perVehicle.t03, 0);
});

test("erster Monat eines Fahrzeugs rechnet ab dem ersten Stand im Monat", () => {
  const d = dataWith([row("2026-10-03", "b10", 500), row("2026-10-25", "b10", 1700)]);
  assert.equal(monthKmDriven(d, "2026-10").perVehicle.b10, 1200);
});

test("Summe über beide Autos", () => {
  const d = dataWith([
    row("2026-09-30", "t03", 10000),
    row("2026-10-15", "t03", 10200),
    row("2026-09-30", "b10", 3000),
    row("2026-10-15", "b10", 3500),
  ]);
  assert.equal(monthKmDriven(d, "2026-10").total, 700);
});

test("ohne Stände ist die Summe leer statt 0", () => {
  assert.equal(monthKmDriven(dataWith([]), "2026-10").total, null);
});
