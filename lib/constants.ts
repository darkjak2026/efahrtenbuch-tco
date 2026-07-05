import type { MonthMeta, VehicleKey } from "./types";

export const MONTHS: MonthMeta[] = [
  { key: "2026-07", label: "Juli" },
  { key: "2026-08", label: "August" },
  { key: "2026-09", label: "September" },
  { key: "2026-10", label: "Oktober" },
  { key: "2026-11", label: "November" },
  { key: "2026-12", label: "Dezember" },
];

export const DEFAULT_CARDS = ["EWE Go", "InCharge", "Aral pulse", "EnBW HyperNetz", "Chargemap", "Zuhause"];

export const VEHICLES: Record<VehicleKey, string> = {
  b10: "Leapmotor B10",
  t03: "Leapmotor T03",
};

export const REDIS_KEY = "ladeprotokoll:2026";

export const PIN_STORAGE_KEY = "efahrtenbuch_pin";
