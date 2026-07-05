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

// Erfassungsstart (Juli 2026) bis zum Ende des 36-monatigen Leasingzeitraums (Oktober 2028).
export const MONTHS: MonthMeta[] = generateMonths(2026, 7, 2028, 10);

// Today's month key, clamped into the supported range — used as the default active tab.
export function currentMonthKey(): string {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (key < MONTHS[0].key) return MONTHS[0].key;
  if (key > MONTHS[MONTHS.length - 1].key) return MONTHS[MONTHS.length - 1].key;
  return key;
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
