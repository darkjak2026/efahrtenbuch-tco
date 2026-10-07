export type VehicleKey = "b10" | "t03";

export interface ChargeRow {
  datum: string;
  fahrzeug: "" | VehicleKey;
  karte: string;
  preisProKwh: string;
  ladestation: string;
  lat: string | number;
  lon: string | number;
  reichweiteVorher: string;
  reichweiteNachher: string;
  dauer: string;
  kwh: string;
  preis: string;
  km: string;
  notiz: string;
}

export interface Investition {
  datum: string;
  fahrzeug: "" | VehicleKey;
  beschreibung: string;
  betrag: string;
}

export interface RecurringCost {
  anbieter: string;
  zweck: string;
  fahrzeug: "" | VehicleKey | "beide";
  betrag: string;
  start: string;
}

export interface VehicleFixedCosts {
  leasing: string | number;
  versicherung: string | number;
  start: string;
  stichtag: string;
  stichtagKm: string | number;
  stichtagLadekosten: string | number;
  // Leasing-km-Countdown: Freikilometer pro Jahr, Laufzeit in Monaten und der
  // km-Stand bei Übergabe (leer = 0, also Neuwagen).
  freiKmProJahr: string | number;
  leasingMonate: string | number;
  kmBeiLeasingbeginn: string | number;
}

export interface FeatureRequestEntry {
  ts: string; // "JJJJ-MM-TT||HH:MM"
  text: string;
  status: "offen" | "uebernommen" | "verworfen" | "erledigt";
  doneAt?: string; // "JJJJ-MM-TT||HH:MM" - wann auf "erledigt" gesetzt wurde
}

export interface AppData {
  // Optimistic-concurrency counter (see lib/redis.ts setAppData) - lets two
  // household members on different devices save without silently
  // overwriting each other. Not user-facing.
  _rev: number;
  cardsList: string[];
  vehicles: {
    b10: VehicleFixedCosts;
    t03: VehicleFixedCosts;
  };
  recurringCosts: RecurringCost[];
  erfassungStart: string;
  investitionen: Investition[];
  months: Record<string, ChargeRow[]>;
  featureRequests: FeatureRequestEntry[];
}

export interface MonthMeta {
  key: string;
  label: string;
}
