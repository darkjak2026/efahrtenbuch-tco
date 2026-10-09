"use client";

import { useEffect, useRef, useState } from "react";
import {
  luftlinieKm,
  routeAvailable,
  routeDistance,
  searchAddresses,
  suggestAddresses,
  type GeoPoint,
} from "@/lib/client-api";
import { allRows, fmtEUR, fmtNum, vehicleStats } from "@/lib/data";
import { reverseGeocodeAddress } from "@/lib/gps";
import { planeStrecke, tcoProKm } from "@/lib/planning";
import type { AppData, VehicleKey } from "@/lib/types";

// Planung (Menüpunkt, v2.45.00, Mockup „Variante C“): eine Route aus ein oder zwei
// Etappen (Hin- und Rückfahrt getrennt berechnet). Je Auto eine schmale Kachel: Linie
// mit Wendepunkt, Kosten je Etappe und gesamt (km × TCO/Alltime des Autos), darunter
// die Leasingkilometer bis zum Stichtag. Eine Zeile darüber nennt die Empfehlung.

type Field = "from" | "to";
interface FieldState {
  text: string;
  point: GeoPoint | null;
  results: GeoPoint[];
  busy: boolean;
}
interface Etappe {
  von: string;
  nach: string;
  km: number;
  minutes: number | null;
}
const emptyField = (): FieldState => ({ text: "", point: null, results: [], busy: false });
const kurz = (label: string) => label.split(",")[0].trim();
const datum = (iso: string) => iso.split("-").reverse().join(".");
const dauer = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

export default function PlanningPanel({
  data,
  updateData,
  pin,
  testMode,
  showToast,
}: {
  data: AppData;
  updateData: (fn: (d: AppData) => void) => void;
  pin: string | null;
  testMode: boolean;
  showToast: (msg: string) => void;
}) {
  const [fields, setFields] = useState<Record<Field, FieldState>>({ from: emptyField(), to: emptyField() });
  const [aktiv, setAktiv] = useState<Field>("from");
  const [orsReady, setOrsReady] = useState<boolean | null>(null);
  const [roundTrip, setRoundTrip] = useState(true);
  // Beide Richtungen werden immer berechnet; bei „Einfache Fahrt“ zählt nur die Hinfahrt.
  const [route, setRoute] = useState<{ hin: Etappe; rueck: Etappe | null; source: string } | null>(null);
  const [manualKm, setManualKm] = useState("");
  const [manualOffen, setManualOffen] = useState(false);
  const [routing, setRouting] = useState(false);
  const [naming, setNaming] = useState<{ field: Field; name: string } | null>(null);
  const timers = useRef<Record<Field, ReturnType<typeof setTimeout> | null>>({ from: null, to: null });

  useEffect(() => {
    let cancelled = false;
    if (testMode || !pin) {
      queueMicrotask(() => !cancelled && setOrsReady(false));
    } else {
      routeAvailable(pin).then((ok) => !cancelled && setOrsReady(ok));
    }
    return () => {
      cancelled = true;
    };
  }, [pin, testMode]);

  const patch = (f: Field, p: Partial<FieldState>) => setFields((s) => ({ ...s, [f]: { ...s[f], ...p } }));

  // Vorschläge zuerst in der Nähe: beim Ziel rund um den Start (und umgekehrt),
  // sonst rund um den letzten Ladeort mit Koordinaten.
  const naheBei = (f: Field): { lat: number; lon: number } | null => {
    const andere = fields[f === "to" ? "from" : "to"].point;
    if (andere) return { lat: andere.lat, lon: andere.lon };
    const letzte = allRows(data)
      .filter((r) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)) && r.lat !== "" && r.lon !== "")
      .sort((a, b) => b.datum.localeCompare(a.datum))[0];
    return letzte ? { lat: Number(letzte.lat), lon: Number(letzte.lon) } : null;
  };

  const onType = (f: Field, text: string) => {
    patch(f, { text, point: null, results: [] });
    setRoute(null);
    if (timers.current[f]) clearTimeout(timers.current[f]!);
    // Vorschläge beim Tippen nur über den eigenen Server (GraphHopper bzw. OpenRouteService)
    if (orsReady && pin && text.trim().length >= 3) {
      timers.current[f] = setTimeout(async () => {
        patch(f, { busy: true });
        const results = await suggestAddresses(pin, text, naheBei(f));
        patch(f, { results, busy: false });
      }, 350);
    }
  };

  const onSearch = async (f: Field) => {
    const q = fields[f].text.trim();
    if (q.length < 3) return;
    patch(f, { busy: true });
    const results = await searchAddresses(q);
    patch(f, { results, busy: false });
    if (!results.length) showToast("Keine passende Adresse gefunden");
  };

  const choose = (f: Field, p: GeoPoint) => {
    patch(f, { text: p.label, point: p, results: [] });
    setRoute(null);
    if (f === "from" && !fields.to.point) setAktiv("to");
  };

  const swap = () => {
    setFields((s) => ({ from: s.to, to: s.from }));
    setRoute(null);
  };

  const useGps = () => {
    if (!("geolocation" in navigator)) return showToast("Standort wird von diesem Browser nicht unterstützt");
    patch("from", { busy: true });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const label = (await reverseGeocodeAddress(lat, lon)) ?? `Aktueller Standort (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
        choose("from", { label, lat, lon });
        patch("from", { busy: false });
      },
      () => {
        patch("from", { busy: false });
        showToast("Standort konnte nicht ermittelt werden");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const calculate = async () => {
    const a = fields.from.point;
    const b = fields.to.point;
    if (!a || !b) return;
    const von = kurz(a.label);
    const nach = kurz(b.label);
    if (testMode) {
      const km = luftlinieKm(a, b) * 1.25;
      setRoute({ hin: { von, nach, km, minutes: null }, rueck: { von: nach, nach: von, km, minutes: null }, source: "Testmodus: Luftlinie × 1,25" });
      return;
    }
    if (!pin) return;
    setRouting(true);
    // Hin- und Rückfahrt getrennt: Einbahnstraßen und Auffahrten machen den Rückweg oft etwas anders
    const [h, r] = await Promise.all([routeDistance(pin, a, b), routeDistance(pin, b, a)]);
    setRouting(false);
    if (h.ok) {
      setRoute({
        hin: { von, nach, km: h.km, minutes: h.minutes },
        rueck: r.ok ? { von: nach, nach: von, km: r.km, minutes: r.minutes } : { von: nach, nach: von, km: h.km, minutes: h.minutes },
        source: h.dienst,
      });
    } else {
      showToast(h.reason === "no-key" ? "Routendienst noch nicht eingerichtet – bitte km selbst eingeben" : "Strecke konnte nicht berechnet werden");
      setManualOffen(true);
    }
  };

  const savePlace = () => {
    if (!naming) return;
    const p = fields[naming.field].point;
    const name = naming.name.trim().slice(0, 40);
    if (!p || !name) return;
    updateData((d) => {
      d.places = [...(d.places || []).filter((x) => x.name.toLowerCase() !== name.toLowerCase()), { name, label: p.label, lat: p.lat, lon: p.lon }];
    });
    showToast(`„${name}“ gespeichert`);
    setNaming(null);
  };

  // Etappen der Route: berechnet oder (ohne Routendienst) aus den selbst eingegebenen km
  const manual = Number(manualKm.replace(",", ".")) || 0;
  const vonText = fields.from.point ? kurz(fields.from.point.label) : "Start";
  const nachText = fields.to.point ? kurz(fields.to.point.label) : "Ziel";
  const etappen: Etappe[] = route
    ? roundTrip && route.rueck
      ? [route.hin, route.rueck]
      : [route.hin]
    : manual > 0
      ? roundTrip
        ? [
            { von: vonText, nach: nachText, km: manual, minutes: null },
            { von: nachText, nach: vonText, km: manual, minutes: null },
          ]
        : [{ von: vonText, nach: nachText, km: manual, minutes: null }]
      : [];
  const km = etappen.reduce((s, e) => s + e.km, 0);
  const minuten = etappen.length > 0 && etappen.every((e) => e.minutes !== null) ? etappen.reduce((s, e) => s + (e.minutes ?? 0), 0) : null;
  const plan = km > 0 ? planeStrecke(data, km) : null;
  const places = data.places || [];

  const fieldRow = (f: Field) => {
    const st = fields[f];
    return (
      <div className={"plan2-feld" + (aktiv === f ? " aktiv" : "")}>
        <span className={"plan2-punkt plan2-punkt-" + f} aria-hidden="true" />
        <input
          id={`plan-${f}`}
          type="text"
          autoComplete="off"
          aria-label={f === "from" ? "Start" : "Ziel"}
          placeholder={f === "from" ? "Start eingeben …" : "Ziel eingeben …"}
          value={st.text}
          maxLength={160}
          onFocus={() => setAktiv(f)}
          onChange={(e) => onType(f, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearch(f);
            }
          }}
        />
        {st.busy && <span className="plan2-busy">…</span>}
        {f === "from" && (
          <button type="button" className="plan2-ico" title="Aktueller Standort" aria-label="Aktueller Standort als Start" onClick={useGps}>
            📍
          </button>
        )}
        {!orsReady && (
          <button type="button" className="plan2-ico" title="Adresse suchen" aria-label="Adresse suchen" onClick={() => onSearch(f)}>
            🔎
          </button>
        )}
      </div>
    );
  };

  const resultList = (f: Field) =>
    fields[f].results.length > 0 && (
      <ul className="plan-results">
        {fields[f].results.map((r, i) => (
          <li key={`${r.lat},${r.lon},${i}`}>
            <button type="button" onClick={() => choose(f, r)}>
              {r.label}
            </button>
          </li>
        ))}
      </ul>
    );

  const speichernLink = (f: Field) => {
    const st = fields[f];
    if (!st.point || places.some((p) => p.lat === st.point!.lat && p.lon === st.point!.lon)) return null;
    return naming?.field === f ? (
      <div className="plan-name-row">
        <input
          type="text"
          autoFocus
          placeholder="Name, z. B. Oma"
          value={naming.name}
          maxLength={40}
          onChange={(e) => setNaming({ field: f, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && savePlace()}
        />
        <button type="button" className="plan-small-btn" onClick={savePlace}>
          Speichern
        </button>
      </div>
    ) : (
      <button type="button" className="plan-link" onClick={() => setNaming({ field: f, name: "" })}>
        ☆ „{kurz(st.point.label)}“ als Ort speichern
      </button>
    );
  };

  // Schmale Kachel je Auto (Variante C): Linie mit Wendepunkt, Kosten je Etappe und gesamt
  const kachel = (v: VehicleKey) => {
    const a = plan?.autos.find((x) => x.vehicle === v);
    if (!a) return null;
    const preis = tcoProKm(data, v);
    const s = vehicleStats(data, v);
    const istEmpfohlen = plan?.empfehlung === v;
    if (!a.verfuegbar || preis === null) {
      return (
        <div key={v} className={`plan2-kachel plan2-kachel-${v} plan2-aus`}>
          <div className="plan2-kopf">
            <b>{a.name}</b>
            <span>{a.verfuegbar ? "noch keine km erfasst" : "noch nicht übergeben"}</span>
          </div>
        </div>
      );
    }
    const zwei = etappen.length === 2;
    const j = a.leasingJahr;
    return (
      <div key={v} className={`plan2-kachel plan2-kachel-${v}` + (istEmpfohlen ? " plan2-empfohlen" : "")}>
        <div className="plan2-kopf">
          <b>{a.name}</b>
          <span className="plan2-summe">{fmtEUR(km * preis)}</span>
        </div>
        <svg className="plan2-linie" viewBox="0 0 260 64" role="img" aria-label={zwei ? "Hin- und Rückfahrt" : "Einfache Fahrt"}>
          {zwei ? <path d="M14 20 H226 a12 12 0 0 1 0 24 H14" /> : <path d="M14 32 H238" />}
          <circle className="plan2-start" cx="14" cy={zwei ? 20 : 32} r="5" />
          {zwei && <circle className="plan2-start" cx="14" cy="44" r="5" />}
          <circle className="plan2-ziel" cx={zwei ? 238 : 244} cy="32" r="6" />
          <text x="124" y={zwei ? 13 : 24} textAnchor="middle">
            {zwei ? "Hin: " : ""}
            {fmtNum(etappen[0].km, 1)} km · {fmtEUR(etappen[0].km * preis)}
          </text>
          {zwei && (
            <text x="124" y="61" textAnchor="middle">
              Zurück: {fmtNum(etappen[1].km, 1)} km · {fmtEUR(etappen[1].km * preis)}
            </text>
          )}
        </svg>
        <div className="plan2-rechnung">
          {fmtNum(km, 1)} km × {fmtNum(preis, 2)} €/km (TCO/Alltime)
          <details>
            <summary>So gerechnet</summary>
            <p>
              {fmtNum(preis, 2)} €/km ist der TCO/Alltime-Wert des {a.name}: alle Kosten seit der Übergabe ({fmtEUR(s.tco)}) ÷
              alle gefahrenen km ({fmtNum(s.kmStand, 0)} km). Er ändert sich mit jedem Ladevorgang und jedem Monat.
              {a.zusatzkosten !== null && <> Davon ist Strom für diese Route ca. {fmtEUR(a.zusatzkosten)}.</>}
            </p>
          </details>
        </div>
        {j && j.rest !== null && (
          <div className={"plan2-leasing" + (j.rest - km < 0 ? " plan2-leasing-ueber" : "")}>
            {j.rest - km >= 0
              ? `Bis zum ${datum(j.stichtag)} verbleiben nach dieser Fahrt noch ${fmtNum(j.rest - km, 0)} km.`
              : `Bis zum ${datum(j.stichtag)} liegt diese Fahrt ${fmtNum(km - j.rest, 0)} km über dem Kontingent.`}
          </div>
        )}
      </div>
    );
  };

  const empfohlen = plan?.autos.find((a) => a.vehicle === plan.empfehlung);

  return (
    <div className="plan">
      <section className="plan-card">
        {orsReady === false && !testMode && (
          <p className="plan-note">Routendienst nicht erreichbar – Adressen mit 🔎 suchen oder km selbst eingeben.</p>
        )}
        <div className="plan2-route">
          {fieldRow("from")}
          {aktiv === "from" && resultList("from")}
          <button type="button" className="plan2-tausch" title="Start und Ziel tauschen" aria-label="Start und Ziel tauschen" onClick={swap}>
            ⇅
          </button>
          {fieldRow("to")}
          {aktiv === "to" && resultList("to")}
        </div>
        {places.length > 0 && (
          <div className="plan-chips">
            {places.map((p) => (
              <button type="button" key={p.name} className="plan-chip" title={`${p.label} als ${aktiv === "from" ? "Start" : "Ziel"}`} onClick={() => choose(aktiv, p)}>
                ★ {p.name}
              </button>
            ))}
          </div>
        )}
        {speichernLink("from")}
        {speichernLink("to")}
        <div className="plan2-seg" role="group" aria-label="Art der Fahrt">
          <button type="button" className={!roundTrip ? "an" : ""} aria-pressed={!roundTrip} onClick={() => setRoundTrip(false)}>
            Einfache Fahrt
          </button>
          <button type="button" className={roundTrip ? "an" : ""} aria-pressed={roundTrip} onClick={() => setRoundTrip(true)}>
            Hin &amp; zurück
          </button>
        </div>
        <button type="button" className="plan-go" disabled={!fields.from.point || !fields.to.point || routing} onClick={calculate}>
          {routing ? "Berechne …" : "Route berechnen"}
        </button>
        {!route &&
          (manualOffen ? (
            <div className="plan-manual">
              <label htmlFor="plan-km">Entfernung einfach (km):</label>
              <input
                id="plan-km"
                type="number"
                min="0"
                inputMode="decimal"
                value={manualKm}
                onChange={(e) => setManualKm(e.target.value.replace(/-/g, ""))}
              />
            </div>
          ) : (
            <button type="button" className="plan2-manuell-link" onClick={() => setManualOffen(true)}>
              km lieber selbst eingeben
            </button>
          ))}
      </section>

      {plan && (
        <section className="plan2-ergebnis">
          <div className="plan2-kopfzeile">
            <b>{fmtNum(km, 1)} km</b>
            <span>
              {etappen.length === 2 ? "Hin & zurück" : "Einfache Fahrt"}
              {minuten !== null && ` · ca. ${dauer(minuten)}`}
              {route && ` · ${route.source}`}
            </span>
          </div>
          {empfohlen && (
            <div className={`plan2-empfehlung plan2-empfehlung-${empfohlen.vehicle}`}>
              <b>Empfehlung: {empfohlen.name}</b> – {plan.grund}
            </div>
          )}
          <div className="plan2-kacheln">{(["b10", "t03"] as VehicleKey[]).map((v) => kachel(v))}</div>
        </section>
      )}
    </div>
  );
}
