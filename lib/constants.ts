import type { MonthMeta, VehicleKey } from "./types";

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function generateMonths(startYear: number, startMonth: number, endYear: number, endMonth: number): MonthMeta[] {
  const out: MonthMeta[] = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    out.push({ key: `${y}-${String(m).padStart(2, "0")}`, label: MONTH_NAMES[m - 1] });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

// Speicherbereich: Erfassungsstart (Juli 2026) bis Ende 2029 - deckt beide
// Leasingverträge ab. Angezeigt wird davon nur der Teil bis zum spätesten
// Leasingende (visibleMonths in lib/data.ts, berechnet aus Übergabedatum +
// Laufzeit); ohne Übergabedatum bis LAST_MONTH_FALLBACK.
export const MONTHS: MonthMeta[] = generateMonths(2026, 7, 2029, 12);
export const LAST_MONTH_FALLBACK = "2028-10";

// Last calendar day of a month key, as "JJJJ-MM-TT" (local, no UTC shift).
export function monthLastDay(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${key}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

// Datumsgrenzen, z.B. als min/max an <input type="date"> - verhindert Tippfehler
// wie ein falsches Jahr, die sonst still im aktuell offenen Monat landen würden.
// Für Ladevorgänge gilt die engere Grenze dateRangeMax(data) aus lib/data.ts.
export const DATE_RANGE_MIN = `${MONTHS[0].key}-01`;
export const DATE_RANGE_MAX = monthLastDay(MONTHS[MONTHS.length - 1].key);

// Today's month key, clamped into the supported range — used as the default active tab.
export function currentMonthKey(): string {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (key < MONTHS[0].key) return MONTHS[0].key;
  if (key > MONTHS[MONTHS.length - 1].key) return MONTHS[MONTHS.length - 1].key;
  return key;
}

// Month key `delta` months away within `list`, or null outside it.
export function shiftMonth(key: string, delta: number, list: MonthMeta[] = MONTHS): string | null {
  const i = list.findIndex((m) => m.key === key);
  const next = list[i + delta];
  return i === -1 || !next ? null : next.key;
}

// Today as an ISO date string in local time (not UTC, unlike Date#toISOString).
export function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export const DEFAULT_CARDS = ["EWE Go", "InCharge", "Aral pulse", "EnBW HyperNetz", "Chargemap", "Zuhause"];

export const VEHICLES: Record<VehicleKey, { nickname: string; official: string }> = {
  b10: { nickname: "BIO-Leapy", official: "Leapmotor B10" },
  t03: { nickname: "Leapy", official: "Leapmotor T03" },
};

export function vehicleShortLabel(key: VehicleKey): string {
  return VEHICLES[key].nickname;
}

export function vehicleFullLabel(key: VehicleKey): string {
  return `${VEHICLES[key].nickname} (${VEHICLES[key].official})`;
}

export const REDIS_KEY = "ladeprotokoll:2026";

export const PIN_STORAGE_KEY = "efahrtenbuch_pin";
