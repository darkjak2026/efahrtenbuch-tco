import { test } from "node:test";
import assert from "node:assert/strict";
import { costStats, dateRangeMax, defaultData, trendDegrees, emptyRow, leaseLastMonth, leasingKm, monthCosts, monthKmDriven, visibleMonths } from "./data";
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

test("Monats-TCO je Auto: Laden + Leasing + Versicherung + Abos (beide = Hälfte) + Investitionsrate", () => {
  const d = dataWith([row("2026-09-30", "t03", 10000), { ...row("2026-10-20", "t03", 11000), preis: "50" }]);
  d.vehicles.t03.start = "2026-07-01";
  d.vehicles.t03.leasing = 149;
  d.vehicles.t03.versicherung = 40;
  d.recurringCosts = [
    { anbieter: "A", zweck: "", fahrzeug: "beide", betrag: "10", start: "2026-07-01" },
    { anbieter: "B", zweck: "", fahrzeug: "t03", betrag: "5", start: "2026-11-01" },
    { anbieter: "C", zweck: "", fahrzeug: "", betrag: "7", start: "2026-07-01" },
  ];
  d.investitionen = [
    { datum: "2026-08-10", fahrzeug: "t03", beschreibung: "Reifen", betrag: "720" },
    { datum: "2026-08-10", fahrzeug: "", beschreibung: "Wallbox", betrag: "360" },
  ];
  const c = monthCosts(d, "2026-10");
  const t = c.perVehicle.t03;
  assert.equal(t.laden, 50);
  assert.equal(t.leasing, 149);
  assert.equal(t.versicherung, 40);
  assert.equal(t.abos, 5); // B startet erst im November
  assert.equal(t.invest, 20);
  assert.equal(t.gesamt, 264);
  assert.equal(t.km, 1000);
  assert.equal(t.tcoKm, 0.264);
  assert.equal(t.ladenKm, 0.05);
  assert.equal(c.haushaltOnly, 17); // Abo C 7 + Wallbox 360/36
  assert.equal(c.tcoKm, null); // B10 ohne km -> kein Haushaltswert
});

test("Leasing-km-Countdown: Freikilometer, Rest, Abweichung vom Plan", () => {
  const d = dataWith([row("2026-10-01", "t03", 15000)]);
  d.vehicles.t03.start = "2025-10-01";
  d.vehicles.t03.freiKmProJahr = 13000;
  d.vehicles.t03.leasingMonate = 36;
  d.vehicles.t03.kmBeiLeasingbeginn = 10;
  const l = leasingKm(d, "t03", new Date("2026-10-01T12:00:00"));
  assert.equal(l.inklusiveKm, 39000);
  assert.equal(l.gefahren, 14990);
  assert.equal(l.rest, 24010);
  assert.equal(l.ende, "2028-10-01");
  assert.ok(l.anteilZeit! > 0.33 && l.anteilZeit! < 0.34);
  assert.ok(l.planAbweichung! > 1900 && l.planAbweichung! < 2100); // ~13.000 km Plan nach einem Jahr
  assert.equal(l.startKmGeschaetzt, false);
});

test("Leasing-km-Countdown ohne km-Stand und ohne Übergabedatum", () => {
  const d = dataWith([]);
  d.vehicles.b10.freiKmProJahr = 15000;
  const l = leasingKm(d, "b10");
  assert.equal(l.inklusiveKm, 45000);
  assert.equal(l.rest, null);
  assert.equal(l.anteilZeit, null);
  assert.equal(l.startKmGeschaetzt, true);
});
test("Leasingende und sichtbare Monate: 28.11.2025 + 36 Monate -> bis November 2028", () => {
  const d = dataWith([]);
  d.vehicles.t03.start = "2025-11-28";
  d.vehicles.t03.leasingMonate = 36;
  assert.equal(leaseLastMonth(d, "t03"), "2028-11");
  assert.equal(visibleMonths(d).at(-1)?.key, "2028-11");
  assert.equal(dateRangeMax(d), "2028-11-30");
});

test("sichtbare Monate reichen bis zum späteren Leasingende, ohne Übergabedatum bis Oktober 2028", () => {
  const d = dataWith([]);
  d.vehicles.t03.start = "";
  d.vehicles.b10.start = "";
  assert.equal(visibleMonths(d).at(-1)?.key, "2028-10");
  d.vehicles.t03.start = "2025-10-16";
  d.vehicles.b10.start = "2026-07-01";
  assert.equal(leaseLastMonth(d, "t03"), "2028-10");
  assert.equal(leaseLastMonth(d, "b10"), "2029-06");
  assert.equal(visibleMonths(d).at(-1)?.key, "2029-06");
  assert.equal(visibleMonths(d)[0].key, "2026-07");
});
test("Trendpfeil: 10°-Stufen je 5 %, unter 2,5 % waagerecht, höchstens 90°", () => {
  assert.equal(trendDegrees(null), 0);
  assert.equal(trendDegrees(0.02), 0);
  assert.equal(trendDegrees(0.05), 10);
  assert.equal(trendDegrees(-0.12), -20);
  assert.equal(trendDegrees(3), 90);
});

test("Kostenstatistik: Vormonat, Min/Max mit Monat, Trend gegen Ø der 3 Vormonate", () => {
  const d = dataWith([
    { ...row("2026-07-10", "t03", 1000), preis: "100" },
    { ...row("2026-08-10", "t03", 2000), preis: "200" },
    { ...row("2026-09-10", "t03", 3000), preis: "150" },
    { ...row("2026-10-10", "t03", 4000), preis: "180" },
  ]);
  d.vehicles.t03.start = "2026-07-01";
  d.vehicles.t03.leasing = 100;
  d.vehicles.t03.versicherung = "";
  d.recurringCosts = [];
  d.investitionen = [];
  const s = costStats(d, "t03", "2026-10");
  assert.equal(s.laden.eur, 180);
  assert.equal(s.laden.prevEur, 150);
  assert.equal(s.laden.prevMonth, "2026-09");
  assert.equal(s.laden.minEur, 100);
  assert.equal(s.laden.minEurMonth, "2026-07");
  assert.equal(s.laden.maxEur, 200);
  assert.equal(s.laden.maxEurMonth, "2026-08");
  assert.equal(s.laden.deg, 40); // 180 gegen Ø 150 = +20 % -> 4 Stufen à 10°
  assert.equal(s.leasing.constant, true);
  assert.equal(s.leasing.deg, 0);
  assert.equal(s.leasing.maxPctMonth, "2026-07"); // 100/200 = 50 % war der höchste Anteil
});