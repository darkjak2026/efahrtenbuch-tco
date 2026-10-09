import { VEHICLES } from "./constants";
import { allRows, fmtNum, leasingJahr, leasingKm, parseNum, rowKmDriven, vehicleStats, type LeasingJahr } from "./data";
import type { AppData, VehicleKey } from "./types";

// Planung: Kosten einer Strecke je Auto und der Vorschlag, welches Auto die
// Leasing-Freikilometer am besten ausnutzt. Reine Funktionen, siehe planning.test.ts.

const ORDER: VehicleKey[] = ["b10", "t03"];
const DAY = 86_400_000;
// Lokales Datum "JJJJ-MM-TT" (Einträge mit Datum nach heute zählen nicht)
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Ladekosten je km aus den Ladevorgängen der letzten 90 Tage (sonst aller):
// Summe Preis ÷ Summe "km seit letztem Laden". Das sind die echten Zusatzkosten
// einer Fahrt - Leasing und Versicherung fallen ohnehin an.
export function ladenProKm(data: AppData, v: VehicleKey, today: Date = new Date()): number | null {
  const bis = isoDay(today);
  const rows = allRows(data).filter((r) => r.fahrzeug === v && r.datum && r.datum <= bis);
  const since = isoDay(new Date(today.getTime() - 90 * DAY));
  const pick = (rs: typeof rows) => {
    let eur = 0;
    let km = 0;
    for (const r of rs) {
      const d = rowKmDriven(data, r);
      if (d && d > 0 && parseNum(r.preis) > 0) {
        eur += parseNum(r.preis);
        km += d;
      }
    }
    return km > 0 ? eur / km : null;
  };
  return pick(rows.filter((r) => r.datum >= since)) ?? pick(rows);
}

// TCO je km wie in den Karten oben (alle Kosten seit Leasingbeginn ÷ km-Stand).
export function tcoProKm(data: AppData, v: VehicleKey): number | null {
  const s = vehicleStats(data, v);
  return s.kmStand > 0 ? s.tco / s.kmStand : null;
}

// Typische volle Reichweite: der obere Wert (80. Perzentil) der Reichweite nach
// dem Laden in den letzten 60 Tagen (sonst aller) - passt sich Sommer/Winter an.
export function typischeReichweite(data: AppData, v: VehicleKey, today: Date = new Date()): number | null {
  const bis = isoDay(today);
  const rows = allRows(data).filter((r) => r.fahrzeug === v && r.datum && r.datum <= bis && parseNum(r.reichweiteNachher) > 0);
  const since = isoDay(new Date(today.getTime() - 60 * DAY));
  const pick = (rs: typeof rows) => {
    const vals = rs.map((r) => parseNum(r.reichweiteNachher)).sort((a, b) => a - b);
    if (!vals.length) return null;
    return vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.8))];
  };
  return pick(rows.filter((r) => r.datum >= since)) ?? pick(rows);
}

// Zuletzt erfasster Akkustand: Reichweite nach dem letzten vollständigen Ladevorgang.
export function letzteReichweite(data: AppData, v: VehicleKey, today: Date = new Date()): { km: number; datum: string } | null {
  const bis = isoDay(today);
  const rows = allRows(data)
    .filter((r) => r.fahrzeug === v && r.datum && r.datum <= bis && parseNum(r.reichweiteNachher) > 0)
    .sort((a, b) => b.datum.localeCompare(a.datum));
  return rows.length ? { km: parseNum(rows[0].reichweiteNachher), datum: rows[0].datum } : null;
}

// Ladestopps für eine Strecke: erst die aktuelle Reichweite, danach je volle Ladung
// ca. 80 % der typischen Reichweite (man lädt unterwegs selten auf 100 %).
export function ladestopps(km: number, aktuell: number | null, typisch: number | null): number | null {
  if (!typisch || typisch <= 0) return null;
  const start = aktuell ?? typisch;
  if (km <= start) return 0;
  return Math.ceil((km - start) / (typisch * 0.8));
}

export interface PlanAuto {
  vehicle: VehicleKey;
  name: string;
  verfuegbar: boolean; // Übergabedatum gesetzt
  zusatzkosten: number | null; // km × Laden je km
  vollkosten: number | null; // km × TCO je km
  puffer: number | null; // Leasingkilometer Luft (+) bzw. voraus (−) gegenüber dem gleichmäßigen Plan
  leasingJahr: LeasingJahr | null; // laufendes Jahreskontingent (Rest bis zum Stichtag)
  leasingText: string | null; // Satz für die Erklärung, z. B. „… bleiben noch 1.104 Leasingkilometer“
  restKm: number | null; // übrige Freikilometer
  mehrKmRisiko: number | null; // € falls die Fahrt am Ende Mehrkilometer verursacht
  ladestopps: number | null;
  reichweite: { typisch: number | null; letzte: { km: number; datum: string } | null };
}

export interface PlanErgebnis {
  autos: PlanAuto[];
  empfehlung: VehicleKey | null;
  grund: string;
}

// Vorschlag "Freikilometer ausgleichen": das Auto mit mehr Puffer gegenüber seinem
// zeitanteiligen Plan. Bei fast gleichem Puffer (< 2 % der Freikilometer) zählen
// Ladestopps, dann die Zusatzkosten.
export function planeStrecke(data: AppData, km: number, today: Date = new Date()): PlanErgebnis {
  const autos: PlanAuto[] = ORDER.map((v) => {
    const veh = data.vehicles[v];
    const verfuegbar = !!veh.start;
    const l = leasingKm(data, v, today);
    const laden = ladenProKm(data, v, today);
    const tco = tcoProKm(data, v);
    const typisch = typischeReichweite(data, v, today);
    const letzte = letzteReichweite(data, v, today);
    const jahr = leasingJahr(data, v, today);
    const puffer = jahr?.voraus === null || jahr?.voraus === undefined ? null : -jahr.voraus;
    const stich = jahr ? jahr.stichtag.split("-").reverse().join(".") : "";
    const leasingText =
      jahr && jahr.rest !== null
        ? jahr.rest >= 0
          ? `Im ${jahr.nr}. Leasingjahr bleiben bis zum Stichtag ${stich} noch ${fmtNum(jahr.rest, 0)} Leasingkilometer` +
            (jahr.rest - km >= 0
              ? ` – nach dieser Fahrt ${fmtNum(jahr.rest - km, 0)}.`
              : ` – diese Fahrt ginge ${fmtNum(km - jahr.rest, 0)} km darüber.`)
          : `Im ${jahr.nr}. Leasingjahr ist das Kontingent schon um ${fmtNum(-jahr.rest, 0)} km überschritten (Stichtag ${stich}); es wird ins nächste Jahr übertragen.`
        : null;
    // Hochgerechneter Stand am Leasingende; liegt er schon über den Freikilometern,
    // kostet jeder weitere km den Mehrkilometer-Preis.
    let mehrKmRisiko: number | null = null;
    const mehrCent = parseNum(veh.mehrKmCent);
    if (mehrCent > 0 && l.gefahren !== null && l.anteilZeit && l.anteilZeit > 0) {
      const hochgerechnet = l.gefahren / l.anteilZeit;
      mehrKmRisiko = hochgerechnet + km > l.inklusiveKm ? (Math.min(km, hochgerechnet + km - l.inklusiveKm) * mehrCent) / 100 : 0;
    }
    return {
      vehicle: v,
      name: VEHICLES[v].nickname,
      verfuegbar,
      zusatzkosten: laden === null ? null : laden * km,
      vollkosten: tco === null ? null : tco * km,
      puffer,
      leasingJahr: jahr,
      leasingText,
      restKm: l.rest,
      mehrKmRisiko,
      ladestopps: ladestopps(km, letzte?.km ?? null, typisch),
      reichweite: { typisch, letzte },
    };
  });

  const kandidaten = autos.filter((a) => a.verfuegbar);
  if (kandidaten.length === 0) return { autos, empfehlung: null, grund: "Für kein Auto ist ein Übergabedatum eingetragen." };
  if (kandidaten.length === 1) {
    const a = kandidaten[0];
    const andere = autos.find((x) => x !== a)!;
    return { autos, empfehlung: a.vehicle, grund: `${andere.name} ist noch nicht übergeben – ${a.name} ist das einzige Auto.` };
  }
  const [x, y] = kandidaten;
  const inkl = (v: VehicleKey) => leasingKm(data, v, today).inklusiveKm || 1;
  const px = x.puffer ?? 0;
  const py = y.puffer ?? 0;
  const knapp = Math.abs(px / inkl(x.vehicle) - py / inkl(y.vehicle)) < 0.02;
  let sieger = px >= py ? x : y;
  const p = sieger.puffer ?? 0;
  let grund =
    p >= 0
      ? `${sieger.name} hat im laufenden Leasingjahr mehr Leasingkilometer übrig – ${fmtNum(Math.round(p), 0)} km Luft gegenüber einer gleichmäßigen Verteilung.`
      : `${sieger.name} ist bei den Leasingkilometern weniger weit voraus (${fmtNum(Math.round(-p), 0)} km) – so verteilen sich die Kilometer gleichmäßiger.`;
  if (knapp) {
    const sx = x.ladestopps ?? 0;
    const sy = y.ladestopps ?? 0;
    if (sx !== sy) {
      sieger = sx < sy ? x : y;
      grund = `Bei den Leasingkilometern liegen beide etwa gleich – ${sieger.name} braucht weniger Ladestopps.`;
    } else {
      sieger = (x.zusatzkosten ?? Infinity) <= (y.zusatzkosten ?? Infinity) ? x : y;
      grund = `Bei den Leasingkilometern liegen beide etwa gleich – ${sieger.name} ist für diese Fahrt günstiger.`;
    }
  }
  return { autos, empfehlung: sieger.vehicle, grund };
}
