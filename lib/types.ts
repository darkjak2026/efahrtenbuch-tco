export type VehicleKey = "b10" | "t03";

export interface ChargeRow {
  datum: string;
  fahrzeug: "" | VehicleKey;
  karte: string;
  ladestation: string;
  lat: string | number;
  lon: string | number;
  dauer: string;
  kwh: string;
  preis: string;
  km: string;
}

export interface Investition {
  datum: string;
  fahrzeug: "" | VehicleKey;
  beschreibung: string;
  betrag: string;
}

export interface RecurringCost {
  beschreibung: string;
  fahrzeug: "" | VehicleKey;
  betrag: string;
  start: string;
}

export interface VehicleFixedCosts {
  leasing: string | number;
  versicherung: string | number;
  start: string;
}

export interface AppData {
  cardsList: string[];
  cardTarife: Record<string, string | number>;
  vehicles: {
    b10: VehicleFixedCosts;
    t03: VehicleFixedCosts;
  };
  recurringCosts: RecurringCost[];
  erfassungStart: string;
  investitionen: Investition[];
  months: Record<string, ChargeRow[]>;
}

export interface MonthMeta {
  key: string;
  label: string;
}
