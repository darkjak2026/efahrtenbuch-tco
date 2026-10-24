import { test } from "node:test";
import assert from "node:assert/strict";
import { MONTHS } from "./constants";
import { defaultData, monthCosts, tageAnteil, vehicleStats } from "./data";

// v2.50.01: wiederkehrende Kosten „Beide (50/50)“ werden erst geteilt, wenn beide Autos
// übergeben sind. v2.51.00: alles tagesgenau; Alltime = Summe der Monate.

const nah = (a: number, b: number) => Math.abs(a - b) < 1e-6;

function daten(t03Start: string, b10Start: string, aboStart: string, betrag: string) {
  const d = defaultData();
  d.vehicles.t03.start = t03Start;
  d.vehicles.b10.start = b10Start;
  d.recurringCosts = [{ anbieter: "Aral Pulse", zweck: "Schnellladen", fahrzeug: "beide", betrag, start: aboStart }];
  return d;
}

test("tageAnteil: Tage ÷ Tage im Monat, über Monatsgrenzen hinweg", () => {
  assert.ok(nah(tageAnteil(31, "2026-10-16", "2026-10-24"), 9)); // 9 von 31 Tagen
  assert.ok(nah(tageAnteil(30, "2026-11-01", "2026-11-30"), 30));
  assert.ok(nah(tageAnteil(100, "2026-10-01", "2026-11-30"), 200)); // zwei volle Monate
  assert.ok(nah(tageAnteil(28, "2027-02-28", "2027-03-01"), 1 + 28 / 31));
  assert.equal(tageAnteil(100, "2026-11-01", "2026-10-31"), 0);
});

test("Alltime: allein, solange das andere Auto fehlt, danach 50/50 – zusammen der volle Betrag", () => {
  // 31 € je Monat; Abo ab 01.03.2026, B10 ab 16.10.2026, Stand 31.10.2026
  const d = daten("2025-11-28", "2026-10-16", "2026-03-01", "31");
  const t03 = vehicleStats(d, "t03", "2026-10-31").recurringKosten;
  const b10 = vehicleStats(d, "b10", "2026-10-31").recurringKosten;
  assert.ok(nah(t03, 7 * 31 + 15 + 8), `t03 ${t03}`); // März–Sept voll, 1.–15.10. voll, 16.–31.10. halb
  assert.ok(nah(b10, 8), `b10 ${b10}`); // 16.–31.10. halb
  assert.ok(nah(t03 + b10, 8 * 31));
});

test("Alltime: Auto ohne Übergabedatum trägt nichts, das andere alles", () => {
  const d = daten("2025-11-28", "", "2026-03-01", "31");
  assert.equal(vehicleStats(d, "b10", "2026-10-31").recurringKosten, 0);
  assert.ok(nah(vehicleStats(d, "t03", "2026-10-31").recurringKosten, 8 * 31));
});

test("Monatsübersicht: vor der zweiten Übergabe voll beim Leapy, im Übergabemonat ab dem Tag halbiert", () => {
  const d = daten("2025-11-28", "2026-10-16", "2026-03-01", "2.99");
  const sep = monthCosts(d, "2026-09", "2026-12-31").perVehicle;
  assert.ok(nah(sep.t03.abos, 2.99));
  assert.equal(sep.b10.abos, 0);
  const okt = monthCosts(d, "2026-10", "2026-12-31").perVehicle;
  assert.ok(nah(okt.t03.abos, (2.99 * 15) / 31 + (1.495 * 16) / 31));
  assert.ok(nah(okt.b10.abos, (1.495 * 16) / 31));
  const nov = monthCosts(d, "2026-11", "2026-12-31").perVehicle;
  assert.ok(nah(nov.t03.abos, 1.495) && nah(nov.b10.abos, 1.495));
});

test("einheitliche Grundlage: Summe der Monate = TCO/Alltime (B10, Stand mitten im Monat)", () => {
  const d = defaultData();
  d.vehicles.t03.start = "2025-11-28";
  d.vehicles.b10.start = "2026-10-16";
  d.vehicles.b10.leasing = 300;
  d.vehicles.b10.versicherung = 120;
  d.recurringCosts = [{ anbieter: "Abo", zweck: "", fahrzeug: "beide", betrag: "3", start: "2026-03-01" }];
  d.investitionen = [{ datum: "2026-10-16", fahrzeug: "b10", beschreibung: "Sonderzahlung", betrag: "3600" }];
  d.months["2026-10"].push({ ...d.months["2026-10"][0], datum: "2026-10-20", fahrzeug: "b10", preis: "40", km: "200" });
  const heute = "2027-02-14";
  const s = vehicleStats(d, "b10", heute);
  const monate = MONTHS.map((m) => m.key).filter((k) => k <= heute.slice(0, 7));
  const summe = monate.reduce((acc, k) => acc + monthCosts(d, k, heute).perVehicle.b10.gesamt, 0);
  assert.ok(nah(summe, s.tco), `Monate ${summe} vs Alltime ${s.tco}`);
  // Oktober: 16 von 31 Tagen; Investitionsrate 3600 ÷ 36 = 100 je Monat
  const okt = monthCosts(d, "2026-10", heute).perVehicle.b10;
  assert.ok(nah(okt.leasing, (300 * 16) / 31) && nah(okt.invest, (100 * 16) / 31));
  assert.equal(okt.laden, 40);
});

test("€/km teilt durch die gefahrenen km seit Übergabe, nicht durch den Tachostand", () => {
  const d = defaultData();
  d.vehicles.b10.start = "2026-10-16";
  d.vehicles.b10.kmBeiLeasingbeginn = 17;
  d.months["2026-10"].push({ ...d.months["2026-10"][0], datum: "2026-10-20", fahrzeug: "b10", preis: "10", km: "117" });
  const s = vehicleStats(d, "b10", "2026-10-20");
  assert.equal(s.kmStand, 117);
  assert.equal(s.kmGefahren, 100);
});
