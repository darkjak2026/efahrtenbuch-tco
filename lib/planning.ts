import { VEHICLES } from "./constants";
import { allRows, leasingJahr, parseNum, type LeasingJahr } from "./data";
import type { AppData, VehicleKey } from "./types";

// Planung (v2.50.00, Entscheidung des Urhebers 18.10.2026): eine einzige Rechnung –
// Kosten einer Strecke = km × Ø Verbrauch (fester Wert je Auto aus den Fixkosten) ×
// Ø Strompreis. Alle anderen Formeln (Ladekosten ÷ km, TCO je km, Empfehlung,
// Ladestopps, Mehrkilometer-Risiko) sind entfernt. Reine Funktionen, siehe planning.test.ts.

const ORDER: VehicleKey[] = ["b10", "t03"];

// Ø Strompreis je kWh aus den erfassten Ladevorgängen (Summe Preis ÷ Summe kWh,
// nur Vorgänge mit beidem) – die Pauschale „Ladekosten bis Stichtag“ hat keine kWh.
export function strompreisProKwh(data: AppData, v: VehicleKey): { proKwh: number; kwh: number; eur: number } | null {
  let kwh = 0;
  let eur = 0;
  for (const r of allRows(data)) {
    if (r.fahrzeug !== v) continue;
    const k = parseNum(r.kwh);
    const p = parseNum(r.preis);
    if (k > 0 && p > 0) {
      kwh += k;
      eur += p;
    }
  }
  return kwh > 0 ? { proKwh: eur / kwh, kwh, eur } : null;
}

// Kosten je km: Ø Verbrauch × Ø Strompreis. null, solange eins von beiden fehlt.
export interface FahrtPreis {
  proKm: number;
  verbrauch: number; // kWh/100 km
  proKwh: number; // €/kWh
}
export function fahrtPreisProKm(data: AppData, v: VehicleKey): FahrtPreis | null {
  const verbrauch = parseNum(data.vehicles[v].verbrauchKwh100);
  const strom = strompreisProKwh(data, v);
  return verbrauch > 0 && strom ? { proKm: (verbrauch / 100) * strom.proKwh, verbrauch, proKwh: strom.proKwh } : null;
}

export interface PlanAuto {
  vehicle: VehicleKey;
  name: string;
  verfuegbar: boolean; // Übergabedatum gesetzt
  preis: FahrtPreis | null;
  leasingJahr: LeasingJahr | null; // laufendes Jahreskontingent (Rest bis zum Stichtag)
}

export function planeStrecke(data: AppData, today: Date = new Date()): PlanAuto[] {
  return ORDER.map((v) => ({
    vehicle: v,
    name: VEHICLES[v].nickname,
    verfuegbar: !!data.vehicles[v].start,
    preis: fahrtPreisProKm(data, v),
    leasingJahr: leasingJahr(data, v, today),
  }));
}
