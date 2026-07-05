import { MONTHS, DEFAULT_CARDS } from "./constants";
import type { AppData, ChargeRow, Investition, RecurringCost, VehicleKey } from "./types";

export function emptyRow(): ChargeRow {
  return { datum: "", fahrzeug: "", karte: "", ladestation: "", lat: "", lon: "", dauer: "", kwh: "", preis: "", km: "" };
}
export function emptyInvest(): Investition {
  return { datum: "", fahrzeug: "", beschreibung: "", betrag: "" };
}
export function emptyRecurring(): RecurringCost {
  return { beschreibung: "", fahrzeug: "", betrag: "", start: "" };
}

export function defaultData(): AppData {
  const months: AppData["months"] = {};
  MONTHS.forEach((m) => {
    months[m.key] = [emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow()];
  });
  return {
    cardsList: DEFAULT_CARDS.slice(),
    cardTarife: {},
    vehicles: {
      b10: { leasing: 331.51, versicherung: "", start: "" },
      t03: { leasing: 149.0, versicherung: "", start: "" },
    },
    recurringCosts: [emptyRecurring()],
    erfassungStart: "2026-07-01",
    investitionen: [emptyInvest()],
    months,
  };
}

// Fills in any missing fields on a partial/older document so the app never chokes on legacy data.
export function migrate(raw: unknown): AppData {
  const def = defaultData();
  const d = (raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {}) as Record<string, unknown> & Partial<AppData> & { abos?: Record<string, string | number> };

  if (!d.cardsList || !(d.cardsList as string[]).length) d.cardsList = def.cardsList;
  if (!d.cardTarife) d.cardTarife = {};
  if (!d.vehicles) d.vehicles = def.vehicles;
  if (!d.erfassungStart) d.erfassungStart = def.erfassungStart;
  if (!d.investitionen) d.investitionen = def.investitionen;
  if (!d.months) d.months = def.months;

  if (!d.recurringCosts) {
    d.recurringCosts = [];
    if (d.abos) {
      Object.entries(d.abos).forEach(([karte, fee]) => {
        if (parseFloat(String(fee).replace(",", ".")) > 0) {
          (d.recurringCosts as RecurringCost[]).push({ beschreibung: karte + " (Abo)", fahrzeug: "", betrag: String(fee), start: d.erfassungStart as string });
        }
      });
    }
    if ((d.recurringCosts as RecurringCost[]).length === 0) (d.recurringCosts as RecurringCost[]).push(emptyRecurring());
    delete d.abos;
  }

  MONTHS.forEach((m) => {
    const months = d.months as AppData["months"];
    if (!months[m.key]) months[m.key] = [emptyRow()];
    months[m.key] = months[m.key].map((r) => Object.assign(emptyRow(), r));
  });
  d.investitionen = (d.investitionen as Investition[]).map((i) => Object.assign(emptyInvest(), i));
  d.recurringCosts = (d.recurringCosts as RecurringCost[]).map((r) => Object.assign(emptyRecurring(), r));

  return d as AppData;
}

export function parseNum(v: string | number | undefined | null): number {
  if (v === "" || v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export function durationToMinutes(v: string): number {
  if (!v) return 0;
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(v.trim());
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function minutesToDuration(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h + ":" + String(m).padStart(2, "0");
}

export function fmtEUR(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function fmtNum(n: number, d = 2): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function monthsElapsed(startStr: string, endRef?: Date): number {
  if (!startStr) return 0;
  const start = new Date(startStr);
  const now = endRef || new Date();
  if (isNaN(start.getTime()) || start > now) return 0;
  const days = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  return days / 30.44;
}

export function allRows(data: AppData): ChargeRow[] {
  const out: ChargeRow[] = [];
  MONTHS.forEach((m) => (data.months[m.key] || []).forEach((r) => out.push(r)));
  return out;
}

export interface VehicleStats {
  ladekosten: number;
  leasingKosten: number;
  versicherungKosten: number;
  investKosten: number;
  recurringKosten: number;
  tco: number;
  kmDriven: number;
  kmCount: number;
}

export function vehicleStats(data: AppData, key: VehicleKey): VehicleStats {
  const rows = allRows(data).filter((r) => r.fahrzeug === key);
  const ladekosten = rows.reduce((s, r) => s + parseNum(r.preis), 0);
  const kms = rows.map((r) => parseNum(r.km)).filter((v) => v > 0);
  const kmDriven = kms.length >= 2 ? Math.max(...kms) - Math.min(...kms) : 0;
  const v = data.vehicles[key];
  const months = monthsElapsed(v.start);
  const leasingKosten = parseNum(v.leasing) * months;
  const versicherungKosten = parseNum(v.versicherung) * months;
  const investKosten = data.investitionen.filter((i) => i.fahrzeug === key).reduce((s, i) => s + parseNum(i.betrag), 0);
  const recurringKosten = data.recurringCosts
    .filter((r) => r.fahrzeug === key)
    .reduce((s, r) => s + parseNum(r.betrag) * monthsElapsed(r.start || v.start || data.erfassungStart), 0);
  const tco = ladekosten + leasingKosten + versicherungKosten + investKosten + recurringKosten;
  return { ladekosten, leasingKosten, versicherungKosten, investKosten, recurringKosten, tco, kmDriven, kmCount: kms.length };
}

export function householdRecurring(data: AppData): number {
  return data.recurringCosts
    .filter((r) => !r.fahrzeug)
    .reduce((s, r) => s + parseNum(r.betrag) * monthsElapsed(r.start || data.erfassungStart), 0);
}

export interface HouseholdStats {
  tco: number;
  kmDriven: number;
  recurring: number;
  investHaushalt: number;
}

export function householdStats(data: AppData, b10: VehicleStats, t03: VehicleStats): HouseholdStats {
  const investHaushalt = data.investitionen
    .filter((i) => i.fahrzeug !== "b10" && i.fahrzeug !== "t03")
    .reduce((s, i) => s + parseNum(i.betrag), 0);
  const recurring = householdRecurring(data);
  const tco = b10.tco + t03.tco + recurring + investHaushalt;
  const kmDriven = b10.kmDriven + t03.kmDriven;
  return { tco, kmDriven, recurring, investHaushalt };
}

export function monthTotals(data: AppData, key: string) {
  const rows = data.months[key] || [];
  let kwh = 0,
    preis = 0,
    minutes = 0;
  rows.forEach((r) => {
    kwh += parseNum(r.kwh);
    preis += parseNum(r.preis);
    minutes += durationToMinutes(r.dauer);
  });
  return { kwh, preis, minutes };
}

export function maybeAutofillPreis(data: AppData, row: ChargeRow): void {
  const tarif = parseNum(data.cardTarife[row.karte]);
  if (tarif > 0 && parseNum(row.kwh) > 0 && !parseNum(row.preis)) {
    row.preis = (parseNum(row.kwh) * tarif).toFixed(2);
  }
}

export function vehicleKmWindowUpTo(data: AppData, vehicleKey: VehicleKey, cutoffDateStr: string | null): number | null {
  const cutoff = cutoffDateStr ? new Date(cutoffDateStr) : null;
  let best: number | null = null;
  let bestDate: Date | null = null;
  allRows(data).forEach((r) => {
    if (r.fahrzeug !== vehicleKey) return;
    const km = parseNum(r.km);
    if (km <= 0 || !r.datum) return;
    const d = new Date(r.datum);
    if (cutoff && d > cutoff) return;
    if (!bestDate || d > bestDate) {
      bestDate = d;
      best = km;
    }
  });
  return best;
}

export interface MonthStatementFixItem {
  label: string;
  betrag: number;
}

export interface MonthStatement {
  monthKey: string;
  label: string;
  jahr: number;
  rows: ChargeRow[];
  kwh: number;
  ladekosten: number;
  kmInfo: Record<VehicleKey, number | null>;
  kmCombined: number | null;
  fixcosts: MonthStatementFixItem[];
  fixSum: number;
  investThisMonth: MonthStatementFixItem[];
  investSum: number;
  gesamtMonat: number;
  eurProKm: number | null;
}

export function computeMonthStatement(data: AppData, monthKey: string): MonthStatement {
  const meta = MONTHS.find((m) => m.key === monthKey)!;
  const rows = data.months[monthKey] || [];
  const [y, m] = monthKey.split("-").map(Number);
  const lastDayDate = new Date(y, m, 0);
  const lastDay = lastDayDate.toISOString().slice(0, 10);
  const prevLastDay = new Date(y, m - 1, 0).toISOString().slice(0, 10);

  const kwh = rows.reduce((s, r) => s + parseNum(r.kwh), 0);
  const ladekosten = rows.reduce((s, r) => s + parseNum(r.preis), 0);

  const kmInfo = {} as Record<VehicleKey, number | null>;
  (["b10", "t03"] as VehicleKey[]).forEach((v) => {
    const start = vehicleKmWindowUpTo(data, v, prevLastDay);
    const end = vehicleKmWindowUpTo(data, v, lastDay);
    kmInfo[v] = start !== null && end !== null && end >= start ? end - start : null;
  });
  const kmCombined = kmInfo.b10 !== null && kmInfo.t03 !== null ? kmInfo.b10 + kmInfo.t03 : null;

  const fixcosts: MonthStatementFixItem[] = [];
  (["b10", "t03"] as VehicleKey[]).forEach((v) => {
    const veh = data.vehicles[v];
    if (veh.start && veh.start <= lastDay) {
      if (parseNum(veh.leasing) > 0) fixcosts.push({ label: `Leasing ${v.toUpperCase()}`, betrag: parseNum(veh.leasing) });
      if (parseNum(veh.versicherung) > 0) fixcosts.push({ label: `Versicherung ${v.toUpperCase()}`, betrag: parseNum(veh.versicherung) });
    }
  });
  data.recurringCosts.forEach((r) => {
    const start = r.start || data.erfassungStart;
    if (start && start <= lastDay && parseNum(r.betrag) > 0) {
      const scope = r.fahrzeug ? r.fahrzeug.toUpperCase() : "Haushalt";
      fixcosts.push({ label: `${r.beschreibung || "Wiederkehrende Kosten"} (${scope})`, betrag: parseNum(r.betrag) });
    }
  });

  const investThisMonth = data.investitionen
    .filter((i) => i.datum && i.datum.slice(0, 7) === monthKey)
    .map((i) => ({ label: `${i.beschreibung || "Investition"} (${i.fahrzeug ? i.fahrzeug.toUpperCase() : "Haushalt"})`, betrag: parseNum(i.betrag) }));

  const fixSum = fixcosts.reduce((s, f) => s + f.betrag, 0);
  const investSum = investThisMonth.reduce((s, f) => s + f.betrag, 0);
  const gesamtMonat = ladekosten + fixSum + investSum;
  const eurProKm = kmCombined && kmCombined > 0 ? gesamtMonat / kmCombined : null;

  return {
    monthKey,
    label: meta.label,
    jahr: y,
    rows,
    kwh,
    ladekosten,
    kmInfo,
    kmCombined,
    fixcosts,
    fixSum,
    investThisMonth,
    investSum,
    gesamtMonat,
    eurProKm,
  };
}
