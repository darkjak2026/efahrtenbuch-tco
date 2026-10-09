import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultData, emptyRow } from "./data";
import { ladenAlltimeProKm, ladestopps, ladenProKm, planeStrecke, typischeReichweite } from "./planning";
import type { AppData, ChargeRow, VehicleKey } from "./types";

const TODAY = new Date("2026-10-08T12:00:00");

function row(datum: string, fahrzeug: VehicleKey, km: number, preis = "", reichweiteNachher = ""): ChargeRow {
  return { ...emptyRow(), datum, fahrzeug, km: String(km), preis, reichweiteNachher };
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

test("Laden je km = Ladekosten ÷ km seit letztem Laden", () => {
  const d = dataWith([row("2026-09-20", "t03", 10000), row("2026-10-01", "t03", 10200, "20"), row("2026-10-06", "t03", 10500, "30")]);
  assert.equal(ladenProKm(d, "t03", TODAY), 50 / 500);
});

test("typische Reichweite = oberer Wert der Reichweiten nach dem Laden", () => {
  const d = dataWith([150, 230, 240, 250, 260].map((r, i) => row(`2026-10-0${i + 1}`, "t03", 10000 + i * 100, "", String(r))));
  assert.equal(typischeReichweite(d, "t03", TODAY), 260);
});

test("Ladestopps: erst aktuelle Reichweite, dann je 80 % der typischen", () => {
  assert.equal(ladestopps(100, 150, 250), 0);
  assert.equal(ladestopps(300, 150, 250), 1); // 150 + 200
  assert.equal(ladestopps(400, 150, 250), 2);
  assert.equal(ladestopps(100, null, null), null);
});

test("Vorschlag: B10 noch nicht übergeben -> t03 ist das einzige Auto", () => {
  const d = dataWith([row("2026-10-01", "t03", 10000)]);
  d.vehicles.t03.start = "2025-11-28";
  d.vehicles.b10.start = "";
  const p = planeStrecke(d, 120, TODAY);
  assert.equal(p.empfehlung, "t03");
  assert.match(p.grund, /noch nicht übergeben/);
  assert.equal(p.autos.find((a) => a.vehicle === "b10")!.verfuegbar, false);
});

test("Vorschlag: das Auto mit mehr Puffer unter Plan gewinnt", () => {
  const d = dataWith([row("2026-10-01", "t03", 20000), row("2026-10-01", "b10", 2000)]);
  for (const v of ["b10", "t03"] as VehicleKey[]) {
    d.vehicles[v].start = "2025-10-08";
    d.vehicles[v].leasingMonate = 36;
    d.vehicles[v].freiKmProJahr = 15000;
    d.vehicles[v].kmBeiLeasingbeginn = 0;
  }
  const p = planeStrecke(d, 100, TODAY);
  assert.equal(p.empfehlung, "b10"); // b10: 2.000 km nach einem Jahr, t03: 20.000 km
  assert.match(p.grund, /BIO-Leapy hat im laufenden Leasingjahr mehr Leasingkilometer übrig/);
});

test("Mehrkilometer-Risiko nur, wenn die Hochrechnung über den Freikilometern liegt", () => {
  const d = dataWith([row("2026-10-01", "t03", 15000)]);
  d.vehicles.t03.start = "2025-10-08";
  d.vehicles.t03.leasingMonate = 36;
  d.vehicles.t03.freiKmGesamt = 39000;
  d.vehicles.t03.kmBeiLeasingbeginn = 0;
  d.vehicles.t03.mehrKmCent = 10;
  const t03 = planeStrecke(d, 200, TODAY).autos.find((a) => a.vehicle === "t03")!;
  assert.ok(t03.mehrKmRisiko! > 0); // ~45.000 km hochgerechnet > 39.000
  assert.equal(Math.round(t03.mehrKmRisiko! * 100), 2000); // 200 km × 10 ct
});

test("Planung: Preis der Fahrt = km × Ladekosten je km seit Übergabe", () => {
  const d = dataWith([row("2026-09-20", "t03", 1000, "40"), row("2026-10-01", "t03", 2000, "60")]);
  d.vehicles.t03.stichtagLadekosten = "";
  d.vehicles.t03.start = "2025-11-28";
  const l = ladenAlltimeProKm(d, "t03")!;
  assert.equal(l.ladekosten, 100);
  assert.equal(l.km, 2000);
  assert.equal(l.proKm, 0.05);
  const p = planeStrecke(d, 80, TODAY);
  assert.equal(p.autos.find((a) => a.vehicle === "t03")!.zusatzkosten, 4);
});
