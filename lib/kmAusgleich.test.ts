import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultData, emptyRow, kmAusgleich, kmPrognose, migrate } from "./data";
import type { VehicleFixedCosts } from "./types";

// Erfundene Vertragswerte (öffentliches Repo): 40.000 Freikilometer, Freibetrag 2.000 km,
// Mehr-km 10 ct bis 50.000, darüber 20 ct; Minder-km 5 ct ab 30.000, darunter 2 ct.
function vertrag(extra: Partial<VehicleFixedCosts> = {}): VehicleFixedCosts {
  return {
    ...defaultData().vehicles.b10,
    mehrKmCent: 10,
    mehrKmSchwelle: 50000,
    mehrKmCent2: 20,
    minderKmCent: 5,
    minderKmSchwelle: 30000,
    minderKmCent2: 2,
    freigrenzeKm: 2000,
    ...extra,
  };
}
const INKL = 40000;
const euro = (n: number) => Math.round(n * 100) / 100;

test("innerhalb des Freibetrags: 0 € in beide Richtungen", () => {
  assert.deepEqual(kmAusgleich(vertrag(), INKL, 42000), { art: "frei", abweichungKm: 2000, berechnetKm: 0, betrag: 0 });
  assert.equal(kmAusgleich(vertrag(), INKL, 38000).betrag, 0);
  assert.equal(kmAusgleich(vertrag(), INKL, 40000).art, "frei");
});

test("Mehr-km: Freibetrag wird abgezogen, nur der Rest kostet Preis 1", () => {
  const a = kmAusgleich(vertrag(), INKL, 45000);
  assert.equal(a.art, "mehr");
  assert.equal(a.berechnetKm, 3000);
  assert.equal(euro(a.betrag), 300);
});

test("Mehr-km: genau auf der Schwelle noch komplett Preis 1", () => {
  const a = kmAusgleich(vertrag(), INKL, 50000);
  assert.equal(a.berechnetKm, 8000);
  assert.equal(euro(a.betrag), 800);
});

test("Mehr-km: über der Schwelle Preis 2", () => {
  const a = kmAusgleich(vertrag(), INKL, 53000);
  assert.equal(a.berechnetKm, 11000);
  assert.equal(euro(a.betrag), 8000 * 0.1 + 3000 * 0.2);
});

test("Mehr-km: Schwelle unterhalb des Freibetrags – alles über dem Freibetrag zu Preis 2", () => {
  const a = kmAusgleich(vertrag({ mehrKmSchwelle: 41000 }), INKL, 45000);
  assert.equal(a.berechnetKm, 3000);
  assert.equal(euro(a.betrag), 600);
});

test("Minder-km: Erstattung negativ, Preis 1 oberhalb der Schwelle", () => {
  const a = kmAusgleich(vertrag(), INKL, 33000);
  assert.equal(a.art, "minder");
  assert.equal(a.berechnetKm, 5000);
  assert.equal(euro(a.betrag), -250);
});

test("Minder-km: genau auf der Schwelle noch komplett Preis 1", () => {
  const a = kmAusgleich(vertrag(), INKL, 30000);
  assert.equal(a.berechnetKm, 8000);
  assert.equal(euro(a.betrag), -400);
});

test("Minder-km: unter der Schwelle Preis 2", () => {
  const a = kmAusgleich(vertrag(), INKL, 25000);
  assert.equal(a.berechnetKm, 13000);
  assert.equal(euro(a.betrag), -(8000 * 0.05 + 5000 * 0.02));
});

test("ohne zweite Stufe gilt ein Preis wie bisher", () => {
  const v = vertrag({ mehrKmSchwelle: "", mehrKmCent2: "", minderKmSchwelle: "", minderKmCent2: "" });
  assert.equal(euro(kmAusgleich(v, INKL, 60000).betrag), 18000 * 0.1);
  assert.equal(euro(kmAusgleich(v, INKL, 20000).betrag), -18000 * 0.05);
});

test("Schwelle ohne zweiten Preis wird ignoriert", () => {
  assert.equal(euro(kmAusgleich(vertrag({ mehrKmCent2: "" }), INKL, 60000).betrag), 18000 * 0.1);
});

test("ohne Freibetrag zählt jede Abweichung", () => {
  assert.equal(euro(kmAusgleich(vertrag({ freigrenzeKm: "" }), INKL, 40100).betrag), 10);
});

test("migrate ergänzt Staffel, Freibetrag 2.500 und leere Stammdaten bei alten Datensätzen", () => {
  const alt = defaultData() as unknown as { vehicles: Record<string, Record<string, unknown>> };
  for (const k of ["b10", "t03"]) {
    delete alt.vehicles[k].freigrenzeKm;
    delete alt.vehicles[k].mehrKmSchwelle;
    delete alt.vehicles[k].stammdaten;
  }
  alt.vehicles.t03.stammdaten = { farbe: "Grün" };
  const d = migrate(alt);
  assert.equal(d.vehicles.b10.freigrenzeKm, 2500);
  assert.equal(d.vehicles.b10.mehrKmSchwelle, "");
  assert.equal(d.vehicles.b10.stammdaten.fin, "");
  assert.equal(d.vehicles.t03.stammdaten.farbe, "Grün");
  assert.equal(d.vehicles.t03.stammdaten.kennzeichen, "");
});

test("Prognose: erst ab 30 Tagen, dann Tempo hochgerechnet auf die Laufzeit", () => {
  const d = defaultData();
  const v = d.vehicles.b10;
  Object.assign(v, vertrag(), { start: "2026-01-01", leasingMonate: 36, freiKmGesamt: 40000, kmBeiLeasingbeginn: 0 });
  d.months["2026-07"].push({ ...emptyRow(), datum: "2026-07-01", fahrzeug: "b10", km: "10000" });
  assert.equal(kmPrognose(d, "b10", new Date("2026-01-20T12:00:00")), null);
  const p = kmPrognose(d, "b10", new Date("2027-01-01T00:00:00"))!; // 365 Tage, 10.000 km
  assert.equal(p.ende, "2029-01-01");
  assert.ok(Math.abs(p.kmEnde - 30027) < 30); // 1.096 Tage Laufzeit
  assert.equal(p.ausgleich.art, "minder");
  assert.equal(p.preiseFehlen, false);
});
