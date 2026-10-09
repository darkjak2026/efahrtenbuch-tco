import { MONTHS, DEFAULT_CARDS, LAST_MONTH_FALLBACK, monthLastDay } from "./constants";
import type { AppData, ChargeRow, Investition, MonthMeta, RecurringCost, VehicleKey } from "./types";

export function emptyRow(): ChargeRow {
  return {
    datum: "",
    fahrzeug: "",
    karte: "",
    preisProKwh: "",
    ladestation: "",
    lat: "",
    lon: "",
    reichweiteVorher: "",
    reichweiteNachher: "",
    dauer: "",
    kwh: "",
    preis: "",
    km: "",
    notiz: "",
  };
}

export function isEmptyRow(r: ChargeRow): boolean {
  return !r.datum && !r.fahrzeug && !r.karte && !r.ladestation && !r.kwh && !r.preis && !r.km;
}

export function monthKeyFromDate(datum: string): string | null {
  if (!datum) return null;
  const key = datum.slice(0, 7);
  return MONTHS.some((m) => m.key === key) ? key : null;
}
export function emptyInvest(): Investition {
  return { datum: "", fahrzeug: "", beschreibung: "", betrag: "" };
}
export function emptyRecurring(): RecurringCost {
  return { anbieter: "", zweck: "", fahrzeug: "", betrag: "", start: "" };
}

export function defaultData(): AppData {
  const months: AppData["months"] = {};
  MONTHS.forEach((m) => {
    months[m.key] = [emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow()];
  });
  return {
    _rev: 0,
    cardsList: DEFAULT_CARDS.slice(),
    vehicles: {
      b10: { leasing: 331.51, versicherung: "", start: "", stichtag: "", stichtagKm: "", stichtagLadekosten: "", freiKmProJahr: 15000, freiKmGesamt: "", leasingMonate: 36, kmBeiLeasingbeginn: "", mehrKmCent: "", minderKmCent: "" },
      t03: { leasing: 149.0, versicherung: "", start: "", stichtag: "2026-07-01", stichtagKm: 7500, stichtagLadekosten: 696, freiKmProJahr: 13000, freiKmGesamt: "", leasingMonate: 36, kmBeiLeasingbeginn: "", mehrKmCent: "", minderKmCent: "" },
    },
    recurringCosts: [emptyRecurring()],
    erfassungStart: "2026-07-01",
    investitionen: [emptyInvest()],
    months,
    featureRequests: [],
    places: [],
  };
}

export const CARD_RENAME = { alt: "Kreditkarte", neu: "AdHoc Kreditkarte" } as const;

// Fills in any missing fields on a partial/older document so the app never chokes on legacy data.
export function migrate(raw: unknown): AppData {
  const def = defaultData();
  const d = (raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {}) as Record<string, unknown> & Partial<AppData> & { abos?: Record<string, string | number> };

  if (!d.cardsList || !(d.cardsList as string[]).length) d.cardsList = def.cardsList;
  if (!d.vehicles) d.vehicles = def.vehicles;
  d.vehicles = {
    b10: Object.assign({}, def.vehicles.b10, d.vehicles.b10),
    t03: Object.assign({}, def.vehicles.t03, d.vehicles.t03),
  };
  if (!d.erfassungStart) d.erfassungStart = def.erfassungStart;
  if (!d.investitionen) d.investitionen = def.investitionen;
  if (!d.months) d.months = def.months;
  if (!d.featureRequests) d.featureRequests = def.featureRequests;
  if (!Array.isArray(d.places)) d.places = def.places;
  if (typeof d._rev !== "number") d._rev = 0;

  if (!d.recurringCosts) {
    d.recurringCosts = [];
    if (d.abos) {
      Object.entries(d.abos).forEach(([karte, fee]) => {
        if (parseFloat(String(fee).replace(",", ".")) > 0) {
          (d.recurringCosts as RecurringCost[]).push({ anbieter: karte, zweck: "Abo", fahrzeug: "", betrag: String(fee), start: d.erfassungStart as string });
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

  // v2.38.00: "Kreditkarte" heißt "AdHoc Kreditkarte" (Ad-hoc-Laden ohne Ladekarte) -
  // in der Kartenliste und in allen Ladevorgängen, einmalig und wiederholbar.
  const cards = d.cardsList as string[];
  if (cards.includes(CARD_RENAME.alt)) {
    d.cardsList = cards.includes(CARD_RENAME.neu)
      ? cards.filter((c) => c !== CARD_RENAME.alt)
      : cards.map((c) => (c === CARD_RENAME.alt ? CARD_RENAME.neu : c));
  }
  Object.values(d.months as AppData["months"]).forEach((rows) =>
    rows.forEach((r) => {
      if (r.karte === CARD_RENAME.alt) r.karte = CARD_RENAME.neu;
    })
  );
  d.investitionen = (d.investitionen as Investition[]).map((i) => Object.assign(emptyInvest(), i));
  d.recurringCosts = (d.recurringCosts as RecurringCost[]).map((r) => Object.assign(emptyRecurring(), r));

  return d as AppData;
}

export function parseNum(v: string | number | undefined | null): number {
  if (v === "" || v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// Colour-codes a Reichweite (remaining range) reading: red under 20 km, yellow
// 20–69, green 70–295, and green-with-a-gold-contour from 296 km up — the
// household's realistic max-range "Spitzenwerte" band. Empty/blank fields get
// no class at all, so "not entered yet" is never mistaken for "critically low".
export function reichweiteColorClass(value: string | number | undefined | null): string {
  if (value === "" || value === null || value === undefined) return "";
  const km = parseNum(value);
  if (km < 20) return "range-red";
  if (km < 70) return "range-yellow";
  if (km < 296) return "range-green";
  return "range-peak";
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

const INVEST_AMORTIZATION_MONTHS = 36;

function monthDiff(fromKey: string, toKey: string): number {
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

// Investments amortize over the 36-month lease term, like a monthly leasing rate,
// instead of hitting the TCO as a one-time lump sum in the month of purchase.
export function amortizedInvestment(betrag: number, startDate: string): number {
  const monthly = betrag / INVEST_AMORTIZATION_MONTHS;
  const months = Math.min(INVEST_AMORTIZATION_MONTHS, monthsElapsed(startDate));
  return monthly * months;
}

export function allRows(data: AppData): ChargeRow[] {
  const out: ChargeRow[] = [];
  MONTHS.forEach((m) => (data.months[m.key] || []).forEach((r) => out.push(r)));
  return out;
}

// --- Ladering (v2.39.00): Ladestand in % aus den Reichweiten ---
// Das Auto zeigt keine Prozent, nur „voll“. Maßstab für 100 % ist daher die
// „Reichweite neu“ der letzten (bis zu drei) als voll markierten Ladevorgänge
// bis zu diesem Tag (passt sich Sommer/Winter an); gibt es noch keine, die
// höchste bisher erfasste „Reichweite neu“ des Autos.
export function vollReichweite(data: AppData, v: VehicleKey, bisDatum?: string): number | null {
  const rows = allRows(data).filter((r) => r.fahrzeug === v && parseNum(r.reichweiteNachher) > 0);
  const voll = rows
    .filter((r) => r.voll && (!bisDatum || r.datum <= bisDatum))
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .slice(0, 3);
  const basis = voll.length ? voll : rows.filter((r) => r.voll);
  if (basis.length) {
    const recent = [...basis].sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 3);
    return recent.reduce((s, r) => s + parseNum(r.reichweiteNachher), 0) / recent.length;
  }
  const max = Math.max(0, ...rows.map((r) => parseNum(r.reichweiteNachher)));
  return max > 0 ? max : null;
}

// Ladestand vor/nach dem Laden in % (0–100). nach = null, solange „Reichweite neu“
// fehlt; ohne Haken „voll“ höchstens 99 %, damit „voll“ nur echtes 100 % bedeutet.
export function ladeStand(data: AppData, row: ChargeRow): { vor: number; nach: number | null } | null {
  if (!row.fahrzeug) return null;
  const full = vollReichweite(data, row.fahrzeug, row.datum);
  const rv = parseNum(row.reichweiteVorher);
  const rn = parseNum(row.reichweiteNachher);
  if (row.voll) {
    const ref = full ?? rn;
    return { vor: ref > 0 ? Math.min(100, Math.round((rv / ref) * 100)) : 0, nach: 100 };
  }
  if (!full) return null;
  const vor = Math.min(99, Math.round((rv / full) * 100));
  const nach = rn > 0 ? Math.max(vor, Math.min(99, Math.round((rn / full) * 100))) : null;
  return { vor, nach };
}

export interface VehicleStats {
  ladekosten: number;
  leasingKosten: number;
  versicherungKosten: number;
  investKosten: number;
  recurringKosten: number;
  tco: number;
  kmStand: number;
  kmCount: number;
  months: number;
}

export function vehicleStats(data: AppData, key: VehicleKey): VehicleStats {
  const rows = allRows(data).filter((r) => r.fahrzeug === key);
  const v = data.vehicles[key];
  const ladekosten = rows.reduce((s, r) => s + parseNum(r.preis), 0) + parseNum(v.stichtagLadekosten);
  const kms = rows.map((r) => parseNum(r.km)).filter((n) => n > 0);
  const stichtagKm = parseNum(v.stichtagKm);
  if (stichtagKm > 0) kms.push(stichtagKm);
  // Gesamt-km-Stand = höchster bekannter Wert (Baseline oder geloggt). Ein einziger
  // bekannter Wert genügt bereits, um €/km anzuzeigen — keine Differenzbildung mehr.
  const kmStand = kms.length > 0 ? Math.max(...kms) : 0;
  const months = monthsElapsed(v.start);
  // Leasingraten nur für die Laufzeit (z. B. 36 Raten), danach nicht weiter.
  const leasingKosten = parseNum(v.leasing) * Math.min(months, parseNum(v.leasingMonate) || 36);
  const versicherungKosten = parseNum(v.versicherung) * months;
  const investKosten = data.investitionen
    .filter((i) => i.fahrzeug === key)
    .reduce((s, i) => s + amortizedInvestment(parseNum(i.betrag), i.datum || v.start || data.erfassungStart), 0);
  const recurringKosten = data.recurringCosts
    .filter((r) => r.fahrzeug === key || r.fahrzeug === "beide")
    .reduce((s, r) => {
      const weight = r.fahrzeug === "beide" ? 0.5 : 1;
      return s + parseNum(r.betrag) * weight * monthsElapsed(r.start || v.start || data.erfassungStart);
    }, 0);
  const tco = ladekosten + leasingKosten + versicherungKosten + investKosten + recurringKosten;
  return { ladekosten, leasingKosten, versicherungKosten, investKosten, recurringKosten, tco, kmStand, kmCount: kms.length, months };
}

// Local calendar date as "JJJJ-MM-TT" - Date#toISOString would shift a local
// midnight back into the previous day (UTC) for German time zones.
function isoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface LeasingKm {
  inklusiveKm: number; // Freikilometer über die ganze Laufzeit
  gefahren: number | null; // seit Übergabe (null: noch kein km-Stand)
  rest: number | null; // negativ = Mehrkilometer
  anteilGefahren: number | null; // 0..1+ der Freikilometer
  anteilZeit: number | null; // 0..1 der Laufzeit (null: kein Übergabedatum)
  planAbweichung: number | null; // gefahren minus zeitanteilige Freikilometer
  startKmGeschaetzt: boolean; // kmBeiLeasingbeginn leer -> mit 0 gerechnet
  ende: string | null; // "JJJJ-MM-TT"
}

// Freikilometer-Countdown je Fahrzeug: wie viele der vertraglich enthaltenen
// km sind schon gefahren, wie viele bleiben, und liegt man über/unter dem
// zeitanteiligen Plan (gleichmäßige Verteilung über die Laufzeit).
export function leasingKm(data: AppData, key: VehicleKey, today: Date = new Date()): LeasingKm {
  const v = data.vehicles[key];
  const monate = parseNum(v.leasingMonate) || 36;
  const inklusiveKm =
    parseNum(v.freiKmGesamt) > 0 ? Math.round(parseNum(v.freiKmGesamt)) : Math.round((parseNum(v.freiKmProJahr) * monate) / 12);
  const kmStand = vehicleStats(data, key).kmStand;
  const startKmGeschaetzt = v.kmBeiLeasingbeginn === "" || v.kmBeiLeasingbeginn === null || v.kmBeiLeasingbeginn === undefined;
  const gefahren = kmStand > 0 ? Math.max(0, kmStand - parseNum(v.kmBeiLeasingbeginn)) : null;
  const rest = gefahren !== null ? inklusiveKm - gefahren : null;
  let anteilZeit: number | null = null;
  let ende: string | null = null;
  if (v.start) {
    anteilZeit = Math.min(1, monthsElapsed(v.start, today) / monate);
    const e = new Date(v.start);
    e.setMonth(e.getMonth() + monate);
    ende = isoLocalDate(e);
  }
  const anteilGefahren = gefahren !== null && inklusiveKm > 0 ? gefahren / inklusiveKm : null;
  const planAbweichung = gefahren !== null && anteilZeit !== null ? Math.round(gefahren - inklusiveKm * anteilZeit) : null;
  return { inklusiveKm, gefahren, rest, anteilGefahren, anteilZeit, planAbweichung, startKmGeschaetzt, ende };
}

// --- Leasingjahre (v2.44.00): Gesamt-Leasingkilometer ÷ Anzahl Jahre = Jahreskontingent.
// Jedes Kontingent gilt von Stichtag zu Stichtag (Übergabe + 12, 24 … Monate). Übrige
// oder zu viel gefahrene km wandern ins nächste Jahr (Entscheidung des Urhebers
// 09.10.2026): bis Ende von Jahr n stehen n × Kontingent zur Verfügung.
export interface LeasingJahr {
  nr: number; // laufendes Leasingjahr, 1-basiert
  anzahl: number; // Leasingjahre insgesamt (Laufzeit ÷ 12)
  von: string; // "JJJJ-MM-TT", Beginn des Leasingjahres
  stichtag: string; // "JJJJ-MM-TT", Beginn des nächsten Jahres bzw. Leasingende
  kontingent: number; // Gesamtkilometer ÷ Anzahl Jahre
  uebertrag: number | null; // aus den Vorjahren (+ übrig, − zu viel), null = km-Stand am Stichtag unbekannt
  verfuegbar: number | null; // Kontingent + Übertrag
  gefahrenImJahr: number | null;
  rest: number | null; // bis zum Stichtag noch übrig (negativ = darüber)
  restTage: number;
  anteilJahr: number; // 0..1, wie viel des laufenden Leasingjahres vorbei ist
  planBisHeute: number; // gleichmäßig verteilt: so viele km dürften seit Übergabe gefahren sein
  voraus: number | null; // gefahren minus Plan (positiv = schneller als geplant)
}

function addMonths(iso: string, monate: number): Date {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  d.setMonth(d.getMonth() + monate);
  return d;
}

export function leasingJahr(data: AppData, key: VehicleKey, today: Date = new Date()): LeasingJahr | null {
  const v = data.vehicles[key];
  if (!v.start) return null;
  const l = leasingKm(data, key, today);
  if (l.inklusiveKm <= 0) return null;
  const monate = parseNum(v.leasingMonate) || 36;
  const anzahl = Math.max(1, Math.round(monate / 12));
  const kontingent = l.inklusiveKm / anzahl;
  const startD = addMonths(v.start, 0);
  const endeD = addMonths(v.start, monate);
  let nr = 1;
  while (nr < anzahl && today >= addMonths(v.start, 12 * nr)) nr++;
  const vonD = addMonths(v.start, 12 * (nr - 1));
  const stichD = nr < anzahl ? addMonths(v.start, 12 * nr) : endeD;
  const tag = 86_400_000;
  const restTage = Math.max(0, Math.ceil((stichD.getTime() - today.getTime()) / tag));
  // gleichmäßiger Plan über die ganze Laufzeit (nach Tagen)
  const anteil = Math.min(1, Math.max(0, (today.getTime() - startD.getTime()) / (endeD.getTime() - startD.getTime())));
  const planBisHeute = Math.round(l.inklusiveKm * anteil);
  // km-Stand zu Beginn des Leasingjahres: letzter erfasster km-Stand vor dem Stichtag
  let gefahrenBisJahresbeginn: number | null = 0;
  if (nr > 1) {
    const von = isoLocalDate(vonD);
    const vorher = allRows(data)
      .filter((r) => r.fahrzeug === key && r.datum && r.datum < von && parseNum(r.km) > 0)
      .map((r) => parseNum(r.km));
    gefahrenBisJahresbeginn = vorher.length ? Math.max(0, Math.max(...vorher) - parseNum(v.kmBeiLeasingbeginn)) : null;
  }
  const uebertrag = gefahrenBisJahresbeginn === null ? null : Math.round((nr - 1) * kontingent - gefahrenBisJahresbeginn);
  const rest = l.gefahren === null ? null : Math.round(nr * kontingent - l.gefahren);
  return {
    nr,
    anzahl,
    von: isoLocalDate(vonD),
    stichtag: isoLocalDate(stichD),
    kontingent: Math.round(kontingent),
    uebertrag,
    verfuegbar: uebertrag === null ? null : Math.round(kontingent + uebertrag),
    gefahrenImJahr: l.gefahren === null || gefahrenBisJahresbeginn === null ? null : l.gefahren - gefahrenBisJahresbeginn,
    rest,
    restTage,
    anteilJahr: Math.min(1, Math.max(0, (today.getTime() - vonD.getTime()) / (stichD.getTime() - vonD.getTime()))),
    planBisHeute,
    voraus: l.gefahren === null ? null : l.gefahren - planBisHeute,
  };
}

// Last month inside a vehicle's lease: the month of (Übergabe + Laufzeit - 1 Tag).
// 28.11.2025 + 36 Monate -> 28.11.2028 -> letzter Leasingmonat 2028-11.
export function leaseLastMonth(data: AppData, key: VehicleKey): string | null {
  const v = data.vehicles[key];
  if (!v.start) return null;
  const end = new Date(v.start);
  if (isNaN(end.getTime())) return null;
  end.setMonth(end.getMonth() + (parseNum(v.leasingMonate) || 36));
  end.setDate(end.getDate() - 1);
  return isoLocalDate(end).slice(0, 7);
}

// Months shown in the app: from the start of recording up to the later of the
// two lease ends (clamped to the stored range).
export function visibleMonths(data: AppData): MonthMeta[] {
  const ends = (["b10", "t03"] as VehicleKey[]).map((k) => leaseLastMonth(data, k)).filter((x): x is string => !!x);
  const last = ends.length ? ends.sort().at(-1)! : LAST_MONTH_FALLBACK;
  const list = MONTHS.filter((m) => m.key <= last);
  return list.length ? list : MONTHS.slice(0, 1);
}

export function dateRangeMax(data: AppData): string {
  const list = visibleMonths(data);
  return monthLastDay(list[list.length - 1].key);
}

export function householdRecurring(data: AppData): number {
  return data.recurringCosts
    .filter((r) => !r.fahrzeug)
    .reduce((s, r) => s + parseNum(r.betrag) * monthsElapsed(r.start || data.erfassungStart), 0);
}

export interface HouseholdStats {
  tco: number;
  kmStand: number;
  recurring: number;
  investHaushalt: number;
}

export function householdStats(data: AppData, b10: VehicleStats, t03: VehicleStats): HouseholdStats {
  const investHaushalt = data.investitionen
    .filter((i) => i.fahrzeug !== "b10" && i.fahrzeug !== "t03")
    .reduce((s, i) => s + amortizedInvestment(parseNum(i.betrag), i.datum || data.erfassungStart), 0);
  const recurring = householdRecurring(data);
  const tco = b10.tco + t03.tco + recurring + investHaushalt;
  const kmStand = b10.kmStand + t03.kmStand;
  return { tco, kmStand, recurring, investHaushalt };
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

// The two "Nach"-values that actually mark a charge as finished.
export function hasNachValues(row: ChargeRow): boolean {
  return !!row.reichweiteNachher && !!row.kwh;
}

// Rows from before this rule existed were often left without Nach-Werte for
// reasons unrelated to "charge still running" — only entries from here on get
// flagged, so the household isn't retroactively swamped with old warnings.
const INCOMPLETE_FLAG_START = "2026-08-15";

// A row saved from the "Vor"-section alone (no reichweiteNachher/kwh yet) is a
// charge that's still running — surfaced in the Lade-Historie as "unvollständig"
// since Vor and Nach can be minutes or days apart in real use.
// --- Offene Ladevorgänge (v2.41.00): „Laden abschließen!“ am Knopf des Autos ---
export interface OffenerLadevorgang {
  row: ChargeRow;
  monthKey: string;
  idx: number;
}

// Unvollständige Ladevorgänge eines Autos bis heute, neueste zuerst (Datum, dann Startzeit).
export function offeneLadevorgaenge(data: AppData, v: VehicleKey, bis: string = isoLocalToday()): OffenerLadevorgang[] {
  const out: OffenerLadevorgang[] = [];
  for (const [monthKey, rows] of Object.entries(data.months)) {
    rows.forEach((row, idx) => {
      if (row.fahrzeug === v && row.datum <= bis && isChargeIncomplete(row)) out.push({ row, monthKey, idx });
    });
  }
  return out.sort((a, b) => `${b.row.datum} ${b.row.start ?? ""}`.localeCompare(`${a.row.datum} ${a.row.start ?? ""}`));
}

function isoLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Ladebeginn als Datum (lokale Zeit) aus Datum + Startzeit, sonst null.
export function ladeBeginn(row: ChargeRow): Date | null {
  if (!row.datum || !row.start || !/^\d{1,2}:\d{2}$/.test(row.start)) return null;
  const [h, m] = row.start.split(":").map(Number);
  const d = new Date(`${row.datum}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(h, m, 0, 0);
  return d;
}

// Laufzeit für den Knopf: "0:42" (h:mm) bis 24 h, danach "2 T"; null ohne Startzeit.
export function laufzeitText(row: ChargeRow, now: Date = new Date()): string | null {
  const b = ladeBeginn(row);
  if (!b) return null;
  const min = Math.max(0, Math.round((now.getTime() - b.getTime()) / 60000));
  if (min >= 24 * 60) return `${Math.floor(min / (24 * 60))} T`;
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

export function isChargeIncomplete(row: ChargeRow): boolean {
  if (!row.datum || row.datum < INCOMPLETE_FLAG_START) return false;
  return !isEmptyRow(row) && !hasNachValues(row);
}

const COMPLETION_MESSAGES = [
  "Vollständig geladen! ⚡",
  "Ladevorgang komplett erfasst.",
  "Stromkreis geschlossen. 🔌",
  "Alle Werte im Kasten. 🔋",
  "Sauber eingeladen.",
  "100 % erfasst. ⚡",
];

// A small reward for finishing a Nach-Erfassung — picked fresh each time so it
// doesn't get stale after the tenth charge of the month.
export function completionMessage(): string {
  return COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];
}

export function maybeAutofillPreis(row: ChargeRow): void {
  const tarif = parseNum(row.preisProKwh);
  if (tarif > 0 && parseNum(row.kwh) > 0 && !parseNum(row.preis)) {
    row.preis = (parseNum(row.kwh) * tarif).toFixed(2);
  }
}

export function vehicleKmWindowUpTo(data: AppData, vehicleKey: VehicleKey, cutoffDateStr: string | null): number | null {
  const cutoff = cutoffDateStr ? new Date(cutoffDateStr) : null;
  let best: number | null = null;
  let bestDate: Date | null = null;
  const consider = (km: number, dateStr: string) => {
    if (km <= 0 || !dateStr) return;
    const d = new Date(dateStr);
    if (cutoff && d > cutoff) return;
    if (!bestDate || d > bestDate) {
      bestDate = d;
      best = km;
    }
  };
  allRows(data).forEach((r) => {
    if (r.fahrzeug !== vehicleKey) return;
    consider(parseNum(r.km), r.datum);
  });
  // Die Baseline (Stichtag) zählt als zusätzlicher gültiger Messpunkt zum Stichtag-Datum.
  const veh = data.vehicles[vehicleKey];
  consider(parseNum(veh.stichtagKm), typeof veh.stichtag === "string" ? veh.stichtag : "");
  return best;
}

// Km driven since the previous charge of the same vehicle (previous = the highest
// known ODO reading strictly before this row's date, including the vehicle's
// Stichtag baseline). Null when there's nothing earlier to compare against, or
// when this row has no ODO of its own — shown in the Lade-Historie next to the
// entry's own ODO reading.
export function rowKmDriven(data: AppData, row: ChargeRow): number | null {
  if (!row.fahrzeug || !row.datum) return null;
  const rowKm = parseNum(row.km);
  if (rowKm <= 0) return null;
  const dayBefore = new Date(row.datum);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const prevKm = vehicleKmWindowUpTo(data, row.fahrzeug, dayBefore.toISOString().slice(0, 10));
  if (prevKm === null) return null;
  const driven = rowKm - prevKm;
  return driven >= 0 ? driven : null;
}

// Lowest ODO reading of a vehicle dated inside the given month (rows + Stichtag
// baseline) - the starting point for a vehicle's very first logged month, when
// there is no reading from before the month to subtract from.
function firstKmInMonth(data: AppData, vehicleKey: VehicleKey, monthKey: string): number | null {
  const kms: number[] = [];
  allRows(data).forEach((r) => {
    if (r.fahrzeug === vehicleKey && r.datum.startsWith(monthKey) && parseNum(r.km) > 0) kms.push(parseNum(r.km));
  });
  const veh = data.vehicles[vehicleKey];
  if (typeof veh.stichtag === "string" && veh.stichtag.startsWith(monthKey) && parseNum(veh.stichtagKm) > 0) {
    kms.push(parseNum(veh.stichtagKm));
  }
  return kms.length > 0 ? Math.min(...kms) : null;
}

export interface MonthKm {
  perVehicle: Record<VehicleKey, number | null>;
  // Sum over the vehicles with a known value; null only when none is known.
  total: number | null;
}

// Km driven per vehicle within a month: last ODO reading up to the month's last
// day minus the last reading before the month (or, for a vehicle's first month,
// its first reading inside the month).
export function monthKmDriven(data: AppData, monthKey: string): MonthKm {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = isoLocalDate(new Date(y, m, 0));
  const prevLastDay = isoLocalDate(new Date(y, m - 1, 0));
  const perVehicle = {} as Record<VehicleKey, number | null>;
  (["b10", "t03"] as VehicleKey[]).forEach((v) => {
    const end = vehicleKmWindowUpTo(data, v, lastDay);
    const start = vehicleKmWindowUpTo(data, v, prevLastDay) ?? firstKmInMonth(data, v, monthKey);
    perVehicle[v] = start !== null && end !== null && end >= start ? end - start : null;
  });
  const known = Object.values(perVehicle).filter((n): n is number => n !== null);
  return { perVehicle, total: known.length > 0 ? known.reduce((s, n) => s + n, 0) : null };
}

export interface VehicleMonthCosts {
  laden: number;
  leasing: number;
  versicherung: number;
  abos: number; // wiederkehrende Kosten: eigene voll, "beide" zur Hälfte
  invest: number; // Monatsrate (Betrag / 36) der eigenen Investitionen
  gesamt: number;
  km: number | null;
  ladenKm: number | null;
  tcoKm: number | null;
}

export interface MonthCosts {
  perVehicle: Record<VehicleKey, VehicleMonthCosts>;
  // Kosten ohne Fahrzeugzuordnung (Abos/Investitionen "Haushalt") - nur im Haushaltswert.
  haushaltOnly: number;
  gesamt: number;
  // Only when both vehicles have a km value for the month: otherwise one car's
  // costs would be divided by the other car's km.
  tcoKm: number | null;
  ladenKm: number | null;
}

function investRateInMonth(betrag: number, datum: string, monthKey: string): number {
  if (!datum) return 0;
  const rate = monthDiff(datum.slice(0, 7), monthKey);
  return rate >= 0 && rate < INVEST_AMORTIZATION_MONTHS ? betrag / INVEST_AMORTIZATION_MONTHS : 0;
}

// Monthly TCO per vehicle (Monatsübersicht): fixed costs count in full for every
// month from their start date on (no day-proration, same as the PDF statement).
export function monthCosts(data: AppData, monthKey: string): MonthCosts {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = isoLocalDate(new Date(y, m, 0));
  const km = monthKmDriven(data, monthKey).perVehicle;
  const rows = data.months[monthKey] || [];
  const perVehicle = {} as Record<VehicleKey, VehicleMonthCosts>;
  (["b10", "t03"] as VehicleKey[]).forEach((v) => {
    const veh = data.vehicles[v];
    const active = !!veh.start && veh.start <= lastDay;
    const laden = rows.filter((r) => r.fahrzeug === v).reduce((s, r) => s + parseNum(r.preis), 0);
    // Die n-te Rate fällt im n-ten Monat ab Übergabe an; nach der letzten Rate keine mehr
    // (Leapy: 28.11.2025 + 36 Raten -> letzte im Oktober 2028, November 2028 frei).
    const rateNr = veh.start ? monthDiff(veh.start.slice(0, 7), monthKey) : -1;
    const leasing = active && rateNr < (parseNum(veh.leasingMonate) || 36) ? parseNum(veh.leasing) : 0;
    const versicherung = active ? parseNum(veh.versicherung) : 0;
    const abos = data.recurringCosts
      .filter((r) => r.fahrzeug === v || r.fahrzeug === "beide")
      .filter((r) => {
        const start = r.start || veh.start || data.erfassungStart;
        return !!start && start <= lastDay;
      })
      .reduce((s, r) => s + parseNum(r.betrag) * (r.fahrzeug === "beide" ? 0.5 : 1), 0);
    const invest = data.investitionen
      .filter((i) => i.fahrzeug === v)
      .reduce((s, i) => s + investRateInMonth(parseNum(i.betrag), i.datum, monthKey), 0);
    const gesamt = laden + leasing + versicherung + abos + invest;
    const k = km[v];
    perVehicle[v] = {
      laden,
      leasing,
      versicherung,
      abos,
      invest,
      gesamt,
      km: k,
      ladenKm: k ? laden / k : null,
      tcoKm: k ? gesamt / k : null,
    };
  });
  const haushaltOnly =
    data.recurringCosts
      .filter((r) => !r.fahrzeug)
      .filter((r) => {
        const start = r.start || data.erfassungStart;
        return !!start && start <= lastDay;
      })
      .reduce((s, r) => s + parseNum(r.betrag), 0) +
    data.investitionen
      .filter((i) => i.fahrzeug !== "b10" && i.fahrzeug !== "t03")
      .reduce((s, i) => s + investRateInMonth(parseNum(i.betrag), i.datum, monthKey), 0);
  const gesamt = perVehicle.b10.gesamt + perVehicle.t03.gesamt + haushaltOnly;
  const kmB = perVehicle.b10.km;
  const kmT = perVehicle.t03.km;
  const kmBoth = kmB !== null && kmT !== null && kmB + kmT > 0 ? kmB + kmT : null;
  return {
    perVehicle,
    haushaltOnly,
    gesamt,
    tcoKm: kmBoth ? gesamt / kmBoth : null,
    ladenKm: kmBoth ? (perVehicle.b10.laden + perVehicle.t03.laden) / kmBoth : null,
  };
}

// ISO-Kalenderwoche (Woche mit dem ersten Donnerstag des Jahres = KW 1).
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export interface MonthWeek {
  kw: number;
  monday: string; // "JJJJ-MM-TT" - Montag der Woche (auch wenn im Vormonat)
  from: string; // erster Tag der Woche innerhalb des Monats
  to: string; // letzter Tag der Woche innerhalb des Monats
}

// Kalenderwochen (Mo–So) eines Monats, auf den Monat begrenzt, neueste zuerst.
export function monthWeeks(monthKey: string): MonthWeek[] {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: MonthWeek[] = [];
  for (let day = 1; day <= last; ) {
    const d = new Date(y, m - 1, day);
    const dow = (d.getDay() + 6) % 7; // 0 = Montag
    const monday = new Date(y, m - 1, day - dow);
    const endDay = Math.min(last, day + (6 - dow));
    out.push({
      kw: isoWeek(d),
      monday: isoLocalDate(monday),
      from: isoLocalDate(d),
      to: isoLocalDate(new Date(y, m - 1, endDay)),
    });
    day = endDay + 1;
  }
  return out.reverse();
}

export interface WeekSums {
  minutes: number;
  km: number; // Summe "km seit letztem Laden" der Ladevorgänge der Woche
  eur: number;
  kwh: number;
}

export function weekSums(data: AppData, rows: ChargeRow[]): WeekSums {
  return rows.reduce(
    (s, r) => ({
      minutes: s.minutes + durationToMinutes(r.dauer),
      km: s.km + (rowKmDriven(data, r) ?? 0),
      eur: s.eur + parseNum(r.preis),
      kwh: s.kwh + parseNum(r.kwh),
    }),
    { minutes: 0, km: 0, eur: 0, kwh: 0 }
  );
}

export const COST_KEYS = ["laden", "leasing", "versicherung", "abos", "invest"] as const;
export type CostKey = (typeof COST_KEYS)[number];

export interface CostStat {
  key: CostKey;
  eur: number;
  pct: number; // Anteil an den Monatskosten des Autos, 0..1
  prevEur: number | null;
  prevPct: number | null;
  prevMonth: string | null;
  minEur: number;
  minEurMonth: string;
  maxEur: number;
  maxEurMonth: string;
  minPct: number;
  minPctMonth: string;
  maxPct: number;
  maxPctMonth: string;
  constant: boolean; // Betrag in allen Monaten gleich (Leasing, Versicherung)
  dev: number | null; // Abweichung vom Ø der letzten 3 Vormonate, z.B. 0.12 = +12 %
  deg: number; // Trendpfeil: 0 = gleich, +10..+90 = teurer, -10..-90 = günstiger
}

// Trendpfeil in 10°-Stufen: je 5 % Abweichung 10° steiler, höchstens 90°,
// unter ±2,5 % waagerecht ("gleich").
export function trendDegrees(dev: number | null): number {
  if (dev === null || Math.abs(dev) < 0.025) return 0;
  return Math.max(-90, Math.min(90, Math.round(dev / 0.05) * 10));
}

// Statistik je Kostenart für den Lade-Ring: aktueller Monat, Vormonat, Min/Max
// (Betrag und Anteil getrennt, jeweils mit Monat) über alle bisherigen Monate
// des sichtbaren Zeitraums, Trend gegen den Ø der letzten 3 Vormonate. Monate,
// in denen für das Auto noch gar keine Kosten anfallen, zählen nicht mit.
export function costStats(data: AppData, vehicle: VehicleKey, monthKey: string): Record<CostKey, CostStat> {
  const hist = visibleMonths(data)
    .map((m) => m.key)
    .filter((k) => k <= monthKey)
    .map((k) => ({ k, c: monthCosts(data, k).perVehicle[vehicle] }))
    .filter((h) => h.c.gesamt > 0 || h.k === monthKey);
  const cur = hist[hist.length - 1];
  const prev = hist.slice(0, -1);
  const out = {} as Record<CostKey, CostStat>;
  for (const key of COST_KEYS) {
    const eurs = hist.map((h) => h.c[key]);
    const pcts = hist.map((h) => (h.c.gesamt > 0 ? h.c[key] / h.c.gesamt : 0));
    const pick = (arr: number[], better: (a: number, b: number) => boolean) =>
      arr.reduce((best, v, i) => (better(v, arr[best]) ? i : best), 0);
    const minE = pick(eurs, (a, b) => a < b);
    const maxE = pick(eurs, (a, b) => a > b);
    const minP = pick(pcts, (a, b) => a < b);
    const maxP = pick(pcts, (a, b) => a > b);
    const last3 = prev.slice(-3).map((h) => h.c[key]);
    const avg = last3.length ? last3.reduce((s, v) => s + v, 0) / last3.length : 0;
    const eur = cur.c[key];
    const dev = avg > 0 ? (eur - avg) / avg : null;
    const p = prev[prev.length - 1];
    out[key] = {
      key,
      eur,
      pct: pcts[pcts.length - 1],
      prevEur: p ? p.c[key] : null,
      prevPct: p ? (p.c.gesamt > 0 ? p.c[key] / p.c.gesamt : 0) : null,
      prevMonth: p ? p.k : null,
      minEur: eurs[minE],
      minEurMonth: hist[minE].k,
      maxEur: eurs[maxE],
      maxEurMonth: hist[maxE].k,
      minPct: pcts[minP],
      minPctMonth: hist[minP].k,
      maxPct: pcts[maxP],
      maxPctMonth: hist[maxP].k,
      constant: eurs[minE] === eurs[maxE],
      dev,
      deg: trendDegrees(dev),
    };
  }
  return out;
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
  const lastDay = isoLocalDate(new Date(y, m, 0));

  const kwh = rows.reduce((s, r) => s + parseNum(r.kwh), 0);
  const ladekosten = rows.reduce((s, r) => s + parseNum(r.preis), 0);

  const kmInfo = monthKmDriven(data, monthKey).perVehicle;
  const kmCombined = kmInfo.b10 !== null && kmInfo.t03 !== null ? kmInfo.b10 + kmInfo.t03 : null;

  const fixcosts: MonthStatementFixItem[] = [];
  (["b10", "t03"] as VehicleKey[]).forEach((v) => {
    const veh = data.vehicles[v];
    if (veh.start && veh.start <= lastDay) {
      // nur innerhalb der Laufzeit (siehe monthCosts)
      const rateNr = monthDiff(veh.start.slice(0, 7), monthKey);
      if (parseNum(veh.leasing) > 0 && rateNr < (parseNum(veh.leasingMonate) || 36))
        fixcosts.push({ label: `Leasing ${v.toUpperCase()}`, betrag: parseNum(veh.leasing) });
      if (parseNum(veh.versicherung) > 0) fixcosts.push({ label: `Versicherung ${v.toUpperCase()}`, betrag: parseNum(veh.versicherung) });
    }
  });
  data.recurringCosts.forEach((r) => {
    const start = r.start || data.erfassungStart;
    if (start && start <= lastDay && parseNum(r.betrag) > 0) {
      const scope = r.fahrzeug === "beide" ? "Beide, 50/50" : r.fahrzeug ? r.fahrzeug.toUpperCase() : "Haushalt";
      const desc = [r.anbieter, r.zweck].filter(Boolean).join(" – ") || "Wiederkehrende Kosten";
      fixcosts.push({ label: `${desc} (${scope})`, betrag: parseNum(r.betrag) });
    }
  });

  const investThisMonth = data.investitionen
    .filter((i) => i.datum)
    .map((i) => ({ i, rate: monthDiff(i.datum.slice(0, 7), monthKey) }))
    .filter(({ rate }) => rate >= 0 && rate < INVEST_AMORTIZATION_MONTHS)
    .map(({ i, rate }) => ({
      label: `${i.beschreibung || "Investition"} (${i.fahrzeug ? i.fahrzeug.toUpperCase() : "Haushalt"}, Rate ${rate + 1}/${INVEST_AMORTIZATION_MONTHS})`,
      betrag: parseNum(i.betrag) / INVEST_AMORTIZATION_MONTHS,
    }));

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
