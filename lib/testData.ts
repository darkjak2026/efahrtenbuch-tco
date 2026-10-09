import { DEFAULT_CARDS, LAST_MONTH_FALLBACK, MONTHS } from "./constants";
import { emptyRow } from "./data";
import type { AppData, ChargeRow, VehicleKey } from "./types";

// Deterministic PRNG (mulberry32) so Testmodus shows the same fictional data
// every time instead of a different random mess on every reload.
function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STATIONS = [
  "Aldi - Dölauer",
  "Rewe Glauchaer Straße",
  "EWE Go Heideallee",
  "Aral pulse Bad Berka",
  "EnBW HyperNetz Weimar",
  "Zuhause Wallbox",
  "Ionity Rasthof Nord",
  "Autobahn Schnelllader",
];

// Roughly matches the real per-vehicle usage pattern (t03 as the daily
// driver, b10 driven less) so TCO/km-Stand behavior looks plausible across
// the full 28-month leasing period, not just a handful of months.
const VEHICLE_PROFILE: Record<VehicleKey, { startKm: number; kmPerMonth: number }> = {
  b10: { startKm: 400, kmPerMonth: 850 },
  t03: { startKm: 7500, kmPerMonth: 1150 },
};

export function generateTestData(): AppData {
  const rnd = mulberry32(20260701);
  const months: AppData["months"] = {};
  const kmState: Record<VehicleKey, number> = {
    b10: VEHICLE_PROFILE.b10.startKm,
    t03: VEHICLE_PROFILE.t03.startKm,
  };

  // Nur bis zum Ende der Leasingzeit (der Speicherbereich reicht weiter)
MONTHS.filter((m) => m.key <= LAST_MONTH_FALLBACK).forEach((m) => {
    const [y, mo] = m.key.split("-").map(Number);
    const rows: ChargeRow[] = [];

    // t03 als Vielfahrer zuerst würfeln (8-14 Ladevorgänge/Monat, entspricht dem
    // echten August mit 13); b10 bekommt daraus abgeleitet ein Viertel weniger.
    const t03Sessions = 8 + Math.floor(rnd() * 7);
    const sessionsByVehicle: Record<VehicleKey, number> = {
      t03: t03Sessions,
      b10: Math.max(1, Math.round(t03Sessions * 0.75)),
    };

    (["b10", "t03"] as VehicleKey[]).forEach((vehicle) => {
      const profile = VEHICLE_PROFILE[vehicle];
      const sessions = sessionsByVehicle[vehicle];
      for (let i = 0; i < sessions; i++) {
        const day = 1 + Math.floor(rnd() * 27);
        const datum = `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const driven = (profile.kmPerMonth / sessions) * (0.6 + rnd() * 0.8);
        kmState[vehicle] += driven;

        const reichweiteVorher = 20 + Math.floor(rnd() * 150);
        const reichweiteNachher = reichweiteVorher + 60 + Math.floor(rnd() * 200);
        const kwh = 10 + rnd() * 25;
        const preisProKwh = (0.3 + rnd() * 0.55).toFixed(2);
        const preis = (kwh * parseFloat(preisProKwh)).toFixed(2);
        // ~8% unfinished (nur "Vor" erfasst) - realistischer Mix, testet auch
        // das "unvollständig"-Badge in der Lade-Historie.
        const incomplete = rnd() < 0.08;

        rows.push({
          ...emptyRow(),
          datum,
          fahrzeug: vehicle,
          karte: DEFAULT_CARDS[Math.floor(rnd() * DEFAULT_CARDS.length)],
          preisProKwh,
          ladestation: STATIONS[Math.floor(rnd() * STATIONS.length)],
          reichweiteVorher: String(reichweiteVorher),
          reichweiteNachher: incomplete ? "" : String(reichweiteNachher),
          dauer: incomplete ? "" : `${Math.floor(rnd() * 2)}:${String(Math.floor(rnd() * 59)).padStart(2, "0")}`,
          kwh: incomplete ? "" : kwh.toFixed(2),
          preis: incomplete ? "" : preis,
          km: String(Math.round(kmState[vehicle])),
        });
      }
    });

    months[m.key] = rows.length ? rows.sort((a, b) => (a.datum || "").localeCompare(b.datum || "")) : [emptyRow()];
  });

  return {
    _rev: 0,
    cardsList: DEFAULT_CARDS.slice(),
    vehicles: {
      b10: { leasing: 331.51, versicherung: 78.4, start: "2026-07-01", stichtag: "2026-07-01", stichtagKm: VEHICLE_PROFILE.b10.startKm, stichtagLadekosten: 120, freiKmProJahr: 15000, freiKmGesamt: "", leasingMonate: 36, kmBeiLeasingbeginn: 0, mehrKmCent: 8, minderKmCent: 4, verbrauchKwh100: 16.5 },
      t03: { leasing: 149.0, versicherung: 81.83, start: "2025-10-16", stichtag: "2026-07-01", stichtagKm: VEHICLE_PROFILE.t03.startKm, stichtagLadekosten: 696, freiKmProJahr: 13000, freiKmGesamt: "", leasingMonate: 36, kmBeiLeasingbeginn: 0, mehrKmCent: 8, minderKmCent: 4, verbrauchKwh100: 13 },
    },
    recurringCosts: [
      { anbieter: "Aral pulse", zweck: "Schnellladen-Abo", fahrzeug: "t03", betrag: "2.99", start: "2026-07-01" },
      { anbieter: "ADAC", zweck: "Pannenschutz", fahrzeug: "", betrag: "6.90", start: "2026-07-01" },
    ],
    erfassungStart: "2026-07-01",
    investitionen: [
      { datum: "2025-11-13", fahrzeug: "t03", beschreibung: "Schutzausstattung", betrag: "800" },
      { datum: "2026-08-01", fahrzeug: "b10", beschreibung: "Wallbox-Installation", betrag: "650" },
    ],
    months,
    featureRequests: [{ ts: "2026-07-01||10:00", text: "Beispiel-Idee zum Ausprobieren im Testmodus.", status: "offen" }],
    places: [
      { name: "Zuhause", label: "Marktplatz 1, 06108 Halle (Saale)", lat: 51.4828, lon: 11.9697 },
      { name: "Arbeit", label: "Hauptbahnhof, 99084 Erfurt", lat: 50.9725, lon: 11.0383 },
    ],
  };
}
