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

export const DEFAULT_CARDS = ["EWE Go", "InCharge", "Aral pulse", "EnBW HyperNetz", "Chargemap", "Zuhause"];

export const VEHICLES: Record<VehicleKey, string> = {
  b10: "Leapmotor B10",
  t03: "Leapmotor T03",
};

export const REDIS_KEY = "ladeprotokoll:2026";

export const PIN_STORAGE_KEY = "efahrtenbuch_pin";
