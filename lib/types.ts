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
  // „Akku ist voll geladen (100 %)“ bei „Reichweite neu“ (v2.39.00) – Maßstab für den Ladering
  voll?: boolean;
  // Ladeziel 80 % (v2.49.00, Wunsch vom 18.10.2026): das Auto hat am Ladelimit aufgehört.
  // Schließt voll aus; der Ladering endet bei 80 %, Reichweite ÷ 0,8 schätzt die volle Reichweite.
  ziel80?: boolean;
  // Startzeit „HH:MM“ (v2.41.00), gespeichert beim Erfassen von „Vor“ – für „Laden abschließen!“
  start?: string;
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
  // Gesamtlaufleistung laut Vertrag; wenn gesetzt, gilt sie statt freiKmProJahr × Laufzeit.
  freiKmGesamt: string | number;
  leasingMonate: string | number;
  kmBeiLeasingbeginn: string | number;
  // Leasingvertrag: Preis je Mehrkilometer und Vergütung je Minderkilometer, in Cent.
  mehrKmCent: string | number;
  minderKmCent: string | number;
  // Staffel (v2.48.00): optionale 2. Stufe. Schwellen sind Gesamt-km seit Übergabe –
  // Mehr-km über der Schwelle kosten mehrKmCent2, Minder-km unter der Schwelle
  // bringen minderKmCent2. Leer = ein einziger Preis wie bisher.
  mehrKmSchwelle: string | number;
  mehrKmCent2: string | number;
  minderKmSchwelle: string | number;
  minderKmCent2: string | number;
  // Freibetrag: so viele km Abweichung bleiben in beide Richtungen unberechnet.
  freigrenzeKm: string | number;
  // Ø Verbrauch in kWh/100 km (v2.47.00) – Grundlage der Kosten in der Planung
  verbrauchKwh100: string | number;
  stammdaten: VehicleStammdaten;
}

// Reine Information zum Fahrzeug (v2.48.00), keine Rechenlogik. Persönliche Werte
// stehen nur im Datensatz hinter dem PIN, nie im öffentlichen Code.
export interface VehicleStammdaten {
  modell: string;
  farbe: string;
  kennzeichen: string;
  fin: string;
  leasinggeber: string;
  vertragsnummer: string;
  haendler: string;
  hauptfahrer: string;
}

export interface FeatureRequestEntry {
  ts: string; // "JJJJ-MM-TT||HH:MM"
  text: string;
  status: "offen" | "uebernommen" | "verworfen" | "erledigt";
  doneAt?: string; // "JJJJ-MM-TT||HH:MM" - wann auf "erledigt" gesetzt wurde
}

// Gespeicherter Ort für den Streckenrechner (Planung)
export interface Place {
  name: string;
  label: string; // Adresse, wie sie angezeigt wird
  lat: number;
  lon: number;
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
  places: Place[];
  // Umzug: gesetzt im alten Speicher (Upstash/Vercel), sobald die App auf den
  // eigenen Server umgezogen ist - die alte Adresse zeigt dann nur noch einen
  // Hinweis mit Link und nimmt keine Änderungen mehr an. Steht bewusst im
  // Datensatz (hinter dem PIN) und nicht im öffentlichen Code.
  movedTo?: string;
}

export interface MonthMeta {
  key: string;
  label: string;
}
