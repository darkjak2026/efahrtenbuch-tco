"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getStoredPin } from "@/lib/client-api";

// Bauplan Teil 3 – Monitoring: Kennzahl-Kacheln, Verlaufskurven mit Meilensteinen
// und die Tabelle der Schnappschüsse. Daten von GET /api/status (PIN); im
// Testmodus sichtbar markierte Beispielwerte.

interface Kennzahlen {
  periode: string;
  erfasst_am: string;
  version: string | null;
  db_groesse_bytes: number;
  tabellen: number;
  ladevorgaenge: number;
  wuensche: number;
  orte: number;
  speichervorgaenge: number;
  datensatz_bytes: number;
  loc: number | null;
  endpunkte: number | null;
  abhaengigkeiten: number | null;
  uptime_sekunden: number | null;
  starts: number;
  fehler: number;
  api_aufrufe: number;
  backup_ok: boolean | null;
  backup_zeit: string | null;
}
interface Zeile {
  periode: string;
  art: "tag" | "monat";
  rekonstruiert: boolean;
  version: string | null;
  db_groesse_bytes: number | null;
  ladevorgaenge: number | null;
  datensatz_bytes: number | null;
  loc: number | null;
  fehler: number | null;
  backup_ok: boolean | null;
}
interface Status {
  aktuell: Kennzahlen;
  verlauf: Zeile[];
}
type Meilenstein = { datum: string; titel: string };

const de = (n: number) => n.toLocaleString("de-DE");
const kb = (b: number | null) => (b === null ? "–" : b >= 1_048_576 ? `${(b / 1_048_576).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB` : `${de(Math.round(b / 1024))} KB`);
const tag = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");
function zeit(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function dauer(s: number | null): string {
  if (s === null) return "–";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d} T ${h} Std` : h > 0 ? `${h} Std ${m} Min` : `${m} Min`;
}

// Beispielwerte nur für ?testmode=1 – sichtbar als solche markiert
function beispiel(): Status {
  const heute = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const verlauf: Zeile[] = [
    { periode: "2026-07-05", art: "tag", rekonstruiert: true, version: "1.0.0", db_groesse_bytes: null, ladevorgaenge: null, datensatz_bytes: null, loc: 3344, fehler: null, backup_ok: null },
    { periode: "2026-08-15", art: "tag", rekonstruiert: true, version: "V2.11", db_groesse_bytes: null, ladevorgaenge: null, datensatz_bytes: null, loc: 4143, fehler: null, backup_ok: null },
    { periode: "2026-09-01", art: "tag", rekonstruiert: true, version: "V2.25", db_groesse_bytes: null, ladevorgaenge: null, datensatz_bytes: null, loc: 5121, fehler: null, backup_ok: null },
    { periode: "2026-10-07", art: "tag", rekonstruiert: true, version: "2.30.00", db_groesse_bytes: null, ladevorgaenge: null, datensatz_bytes: null, loc: 8113, fehler: null, backup_ok: null },
  ];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(heute.getTime() - i * 86_400_000);
    verlauf.push({ periode: iso(d), art: "tag", rekonstruiert: false, version: "2.37.00", db_groesse_bytes: 7_900_000 + (6 - i) * 9000, ladevorgaenge: 31 + (6 - i), datensatz_bytes: 41_000 + (6 - i) * 1300, loc: 11_400, fehler: i === 3 ? 1 : 0, backup_ok: true });
  }
  return {
    aktuell: {
      periode: iso(heute), erfasst_am: heute.toISOString(), version: "2.37.00", db_groesse_bytes: 7_954_000, tabellen: 3,
      ladevorgaenge: 37, wuensche: 4, orte: 3, speichervorgaenge: 52, datensatz_bytes: 48_800, loc: 11_400, endpunkte: 9,
      abhaengigkeiten: 15, uptime_sekunden: 3 * 86400 + 5 * 3600, starts: 0, fehler: 0, api_aufrufe: 6, backup_ok: true,
      backup_zeit: new Date(heute.getTime() - 7 * 3600_000).toISOString(),
    },
    verlauf,
  };
}

// Verlaufskurve: Zeitachse über alle Punkte und Meilensteine, gestrichelt = rekonstruiert
function Kurve({ titel, punkte, meilensteine, format }: {
  titel: string;
  punkte: { datum: string; wert: number; rek: boolean }[];
  meilensteine: Meilenstein[];
  format: (n: number) => string;
}) {
  const W = 340, H = 164, L = 8, R = 8, T = 36, B = 22;
  const tage = [...punkte.map((p) => p.datum), ...meilensteine.map((m) => m.datum)].sort();
  if (!punkte.length) return <p className="mon-leer">{titel}: noch keine Werte.</p>;
  const t0 = Date.parse(tage[0]), t1 = Math.max(Date.parse(tage[tage.length - 1]), t0 + 86_400_000);
  const max = Math.max(...punkte.map((p) => p.wert)) * 1.1 || 1;
  const x = (d: string) => L + ((Date.parse(d) - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => H - B - (v / max) * (H - T - B);
  const linie = (pts: typeof punkte) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.datum).toFixed(1)} ${y(p.wert).toFixed(1)}`).join(" ");
  const rek = punkte.filter((p) => p.rek);
  const echt = punkte.filter((p) => !p.rek);
  const letzter = punkte[punkte.length - 1];
  // Eng beieinanderliegende Meilensteine: Marke abwechselnd eine Reihe höher
  const reihe: number[] = [];
  meilensteine.forEach((m, i) => {
    const eng = i > 0 && x(m.datum) - x(meilensteine[i - 1].datum) < 16;
    reihe.push(eng ? 1 - reihe[i - 1] : 0);
  });
  return (
    <figure className="mon-kurve">
      <figcaption>
        {titel} <b>{format(letzter.wert)}</b>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titel}, Verlauf`}>
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} className="mon-achse" />
        {meilensteine.map((m, i) => (
          <g key={m.datum + i}>
            <line x1={x(m.datum)} y1={T - 8 - reihe[i] * 15} x2={x(m.datum)} y2={H - B} className="mon-ms-linie" />
            <circle cx={Math.min(x(m.datum), W - 8)} cy={T - 12 - reihe[i] * 15} r="7" className="mon-ms-punkt" />
            <text x={Math.min(x(m.datum), W - 8)} y={T - 9 - reihe[i] * 15} textAnchor="middle" className="mon-ms-nr">
              {i + 1}
            </text>
          </g>
        ))}
        {rek.length > 0 && <path d={linie(echt.length ? [...rek, echt[0]] : rek)} className="mon-linie mon-linie-rek" />}
        {echt.length > 0 && <path d={linie(echt)} className="mon-linie" />}
        {punkte.map((p) => (
          <circle key={p.datum + p.rek} cx={x(p.datum)} cy={y(p.wert)} r="2.5" className={p.rek ? "mon-pt mon-pt-rek" : "mon-pt"} />
        ))}
        <text x={L} y={H - 6} className="mon-achse-txt">{tag(tage[0])}</text>
        <text x={W - R} y={H - 6} textAnchor="end" className="mon-achse-txt">{tag(tage[tage.length - 1])}</text>
      </svg>
    </figure>
  );
}

export default function MonitoringView({
  meilensteine,
  copyBtn,
}: {
  meilensteine: Meilenstein[];
  copyBtn: (key: string, title: string, text: string) => ReactNode;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [testmodus] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("testmode") === "1");
  const [laeuft, setLaeuft] = useState(false);

  const laden = useCallback(async () => {
    if (testmodus) return beispiel();
    const pin = getStoredPin();
    const res = await fetch("/api/status", { headers: pin ? { "x-pin": pin } : {}, cache: "no-store" });
    if (res.status === 503) throw new Error("Monitoring gibt es nur auf dem eigenen Server (Postgres).");
    if (!res.ok) throw new Error(`Status nicht abrufbar (${res.status}).`);
    return (await res.json()) as Status;
  }, [testmodus]);

  useEffect(() => {
    let aktiv = true;
    laden()
      .then((s) => aktiv && setStatus(s))
      .catch((e: Error) => aktiv && setFehler(e.message));
    return () => {
      aktiv = false;
    };
  }, [laden]);

  const jetzt = async () => {
    if (testmodus) return;
    setLaeuft(true);
    try {
      const pin = getStoredPin();
      const res = await fetch("/api/status", { method: "POST", headers: pin ? { "x-pin": pin } : {} });
      if (!res.ok) throw new Error(`Schnappschuss fehlgeschlagen (${res.status}).`);
      setStatus(await laden());
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setLaeuft(false);
    }
  };

  const a = status?.aktuell;
  const kacheln: [string, string, string?][] = a
    ? [
        ["Version", a.version ? `v${a.version}` : "–"],
        ["Uptime", dauer(a.uptime_sekunden), a.starts ? `${a.starts}× gestartet heute` : undefined],
        ["Datenbank", kb(a.db_groesse_bytes), `${a.tabellen} Tabellen`],
        ["Datensatz", kb(a.datensatz_bytes), `${de(a.speichervorgaenge)} Speichervorgänge`],
        ["Ladevorgänge", de(a.ladevorgaenge), `${a.wuensche} Wünsche · ${a.orte} Orte`],
        ["Fehler heute", de(a.fehler)],
        ["Routendienst heute", de(a.api_aufrufe), "Aufrufe, kostenlos"],
        ["Letzte Sicherung", a.backup_ok === null ? "noch keine Meldung" : a.backup_ok ? "OK" : "FEHLER", a.backup_zeit ? zeit(a.backup_zeit) : undefined],
        ["Codezeilen (LOC)", a.loc === null ? "–" : de(a.loc)],
        ["Endpunkte", a.endpunkte === null ? "–" : de(a.endpunkte)],
        ["Abhängigkeiten", a.abhaengigkeiten === null ? "–" : de(a.abhaengigkeiten)],
      ]
    : [];
  const kachelText = kacheln.map(([k, v, s]) => `${k}: ${v}${s ? ` (${s})` : ""}`).join("\n");
  const tageswerte = (status?.verlauf ?? []).filter((z) => z.art === "tag");
  const tabelle = [...(status?.verlauf ?? [])].reverse();

  return (
    <>
      {testmodus && <p className="mon-hinweis">Testmodus: alle Werte unten sind Beispielwerte, keine echten Messungen.</p>}
      {fehler && <p className="mon-hinweis mon-hinweis-fehler">{fehler}</p>}
      {!status && !fehler && <p className="mon-leer">Lade Kennzahlen …</p>}

      {a && (
        <>
          <article className="bp-block">
            <div className="bp-block-head">
              <h4>Aktuelle Werte</h4>
              {copyBtn("mon-kacheln", `Monitoring – aktuelle Werte (${zeit(a.erfasst_am)})`, kachelText)}
            </div>
            <p className="bp-meta">Gemessen: {zeit(a.erfasst_am)}</p>
            <div className="mon-kacheln">
              {kacheln.map(([k, v, s]) => (
                <div className={"mon-kachel" + (k === "Letzte Sicherung" && a.backup_ok === false ? " mon-kachel-alarm" : "")} key={k}>
                  <span className="mon-k">{k}</span>
                  <b className="mon-v">{v}</b>
                  {s && <span className="mon-s">{s}</span>}
                </div>
              ))}
            </div>
            <button type="button" className="bp-copy mon-jetzt" onClick={jetzt} disabled={laeuft || testmodus}>
              {laeuft ? "Schnappschuss läuft …" : "Schnappschuss jetzt"}
            </button>
          </article>

          <article className="bp-block">
            <div className="bp-block-head">
              <h4>Verlauf</h4>
            </div>
            <Kurve
              titel="Datenbankgröße"
              punkte={tageswerte.filter((z) => z.db_groesse_bytes !== null).map((z) => ({ datum: z.periode, wert: z.db_groesse_bytes!, rek: false }))}
              meilensteine={meilensteine}
              format={kb}
            />
            <Kurve
              titel="Datensatz (alle Ladevorgänge)"
              punkte={tageswerte.filter((z) => z.datensatz_bytes !== null).map((z) => ({ datum: z.periode, wert: z.datensatz_bytes!, rek: false }))}
              meilensteine={meilensteine}
              format={kb}
            />
            <Kurve
              titel="Codezeilen"
              punkte={tageswerte.filter((z) => z.loc !== null).map((z) => ({ datum: z.periode, wert: z.loc!, rek: z.rekonstruiert }))}
              meilensteine={meilensteine}
              format={de}
            />
            <p className="bp-meta">Gestrichelt: aus der Git-Historie rekonstruiert (je Woche der letzte Commit).</p>
            <ol className="mon-ms-liste">
              {meilensteine.map((m) => (
                <li key={m.datum + m.titel}>
                  <b>{tag(m.datum)}</b> {m.titel}
                </li>
              ))}
            </ol>
          </article>

          <article className="bp-block">
            <div className="bp-block-head">
              <h4>Schnappschüsse</h4>
            </div>
            <div className="mon-tabelle-wrap">
              <table className="mon-tabelle">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Version</th>
                    <th>DB</th>
                    <th>Ladev.</th>
                    <th>LOC</th>
                    <th>Fehler</th>
                    <th>Backup</th>
                  </tr>
                </thead>
                <tbody>
                  {tabelle.map((z) => (
                    <tr key={z.art + z.periode + z.rekonstruiert} className={z.rekonstruiert ? "mon-rek" : undefined}>
                      <td>
                        {z.art === "monat" ? `Monat ${tag(z.periode).slice(3)}` : tag(z.periode)}
                        {z.rekonstruiert && " (rek.)"}
                      </td>
                      <td>{z.version ?? "–"}</td>
                      <td>{z.db_groesse_bytes === null ? "–" : kb(z.db_groesse_bytes)}</td>
                      <td>{z.ladevorgaenge ?? "–"}</td>
                      <td>{z.loc === null ? "–" : de(z.loc)}</td>
                      <td>{z.fehler ?? "–"}</td>
                      <td>{z.backup_ok === null ? "–" : z.backup_ok ? "OK" : "FEHLER"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </>
  );
}
