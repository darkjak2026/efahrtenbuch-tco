import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultData, emptyRow, leasingKm, migrate, monthKmDriven, rowKmDriven, vehicleKmWindowUpTo, vehicleStats } from "./data";
import type { ChargeRow } from "./types";

// v2.52.00: km-Stand ohne Ladevorgang („km-Stand aktualisieren“)

function mitLaden() {
  const d = defaultData();
  d.vehicles.b10.start = "2026-10-16";
  d.vehicles.b10.kmBeiLeasingbeginn = 17;
  const r = (datum: string, km: string): ChargeRow => ({ ...emptyRow(), datum, fahrzeug: "b10", km, preis: "10" });
  d.months["2026-10"].push(r("2026-10-16", "69"), r("2026-10-22", "403"));
  return d;
}

test("eigener km-Stand zählt für Tachostand, gefahrene km und Leasingkilometer", () => {
  const d = mitLaden();
  d.kmStaende = [{ datum: "2026-10-24", fahrzeug: "b10", km: 451 }];
  const s = vehicleStats(d, "b10", "2026-10-24");
  assert.equal(s.kmStand, 451);
  assert.equal(s.kmGefahren, 434);
  assert.equal(leasingKm(d, "b10").gefahren, 434);
});

test("eigener km-Stand zählt für die km im Monat", () => {
  const d = mitLaden();
  assert.equal(monthKmDriven(d, "2026-10").perVehicle.b10, 403 - 69);
  d.kmStaende = [{ datum: "2026-10-24", fahrzeug: "b10", km: 451 }];
  assert.equal(monthKmDriven(d, "2026-10").perVehicle.b10, 451 - 69);
});

test("„km seit letztem Laden“ ignoriert eigene km-Stände", () => {
  const d = mitLaden();
  d.kmStaende = [{ datum: "2026-10-20", fahrzeug: "b10", km: 300 }];
  const laden22 = d.months["2026-10"].find((r) => r.datum === "2026-10-22")!;
  assert.equal(rowKmDriven(d, laden22), 403 - 69);
  assert.equal(vehicleKmWindowUpTo(d, "b10", "2026-10-21"), 300); // für Monats-km zählt er
});

test("am selben Tag gilt der höhere Stand; alte Datensätze bekommen eine leere Liste", () => {
  const d = mitLaden();
  d.kmStaende = [{ datum: "2026-10-22", fahrzeug: "b10", km: 410 }];
  assert.equal(vehicleKmWindowUpTo(d, "b10", "2026-10-22"), 410);
  const alt = defaultData() as unknown as Record<string, unknown>;
  delete alt.kmStaende;
  assert.deepEqual(migrate(alt).kmStaende, []);
});
