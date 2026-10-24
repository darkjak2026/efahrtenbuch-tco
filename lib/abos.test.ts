import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultData, monthCosts, vehicleStats } from "./data";

// v2.50.01: wiederkehrende Kosten „Beide (50/50)“ werden erst geteilt, wenn beide Autos
// übergeben sind; vorher trägt das schon übergebene Auto sie allein.

const iso = (tageZurueck: number) => {
  const d = new Date(Date.now() - tageZurueck * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function daten(t03Start: string, b10Start: string, aboStart: string, betrag: string) {
  const d = defaultData();
  d.vehicles.t03.start = t03Start;
  d.vehicles.b10.start = b10Start;
  d.recurringCosts = [{ anbieter: "Aral Pulse", zweck: "Schnellladen", fahrzeug: "beide", betrag, start: aboStart }];
  return d;
}

test("Alltime: allein, solange das andere Auto fehlt, danach 50/50 – zusammen der volle Betrag", () => {
  // 30,44 € je Monat = 1 € je Tag; Abo seit 100 Tagen, B10 erst seit 20 Tagen
  const d = daten(iso(200), iso(20), iso(100), "30.44");
  const t03 = vehicleStats(d, "t03").recurringKosten;
  const b10 = vehicleStats(d, "b10").recurringKosten;
  assert.ok(Math.abs(t03 - 90) < 1.1, `t03 ${t03}`); // 80 Tage allein + 20 Tage zur Hälfte
  assert.ok(Math.abs(b10 - 10) < 1.1, `b10 ${b10}`); // 20 Tage zur Hälfte
  assert.ok(Math.abs(t03 + b10 - 100) < 1.1);
});

test("Alltime: Auto ohne Übergabedatum trägt nichts, das andere alles", () => {
  const d = daten(iso(200), "", iso(100), "30.44");
  assert.equal(vehicleStats(d, "b10").recurringKosten, 0);
  assert.ok(Math.abs(vehicleStats(d, "t03").recurringKosten - 100) < 1.1);
});

test("Monatsübersicht: vor der zweiten Übergabe voll beim Leapy, ab dem Übergabemonat halbiert", () => {
  const d = daten("2025-11-28", "2026-10-16", "2026-03-01", "2.99");
  const sep = monthCosts(d, "2026-09").perVehicle;
  assert.equal(sep.t03.abos, 2.99);
  assert.equal(sep.b10.abos, 0);
  const okt = monthCosts(d, "2026-10").perVehicle;
  assert.equal(okt.t03.abos, 1.495);
  assert.equal(okt.b10.abos, 1.495);
});
