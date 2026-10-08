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
import { fmtEUR, fmtNum } from "@/lib/data";
import { reverseGeocodeAddress } from "@/lib/gps";
import { planeStrecke } from "@/lib/planning";
import type { AppData } from "@/lib/types";

// Planung (Menüpunkt): Strecke zwischen zwei Adressen, Kosten je Auto und der
// Vorschlag, mit welchem Auto die Leasing-Freikilometer am besten ausgenutzt werden.

type Field = "from" | "to";
interface FieldState {
  text: string;
  point: GeoPoint | null;
  results: GeoPoint[];
  busy: boolean;
}
const emptyField = (): FieldState => ({ text: "", point: null, results: [], busy: false });

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
  const [orsReady, setOrsReady] = useState<boolean | null>(null);
  const [roundTrip, setRoundTrip] = useState(false);
  const [route, setRoute] = useState<{ km: number; minutes: number | null; source: string } | null>(null);
  const [manualKm, setManualKm] = useState("");
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

  const onType = (f: Field, text: string) => {
    patch(f, { text, point: null, results: [] });
    setRoute(null);
    if (timers.current[f]) clearTimeout(timers.current[f]!);
    // Vorschläge beim Tippen nur über den eigenen Server (OpenRouteService)
    if (orsReady && pin && text.trim().length >= 3) {
      timers.current[f] = setTimeout(async () => {
        patch(f, { busy: true });
        const results = await suggestAddresses(pin, text);
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
    if (testMode) {
      setRoute({ km: luftlinieKm(a, b) * 1.25, minutes: null, source: "Testmodus: Luftlinie × 1,25" });
      return;
    }
    if (!pin) return;
    setRouting(true);
    const r = await routeDistance(pin, a, b);
    setRouting(false);
    if (r.ok) setRoute({ km: r.km, minutes: r.minutes, source: "OpenRouteService" });
    else showToast(r.reason === "no-key" ? "Routendienst noch nicht eingerichtet – bitte km selbst eingeben" : "Strecke konnte nicht berechnet werden");
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

  const oneWay = route ? route.km : Number(manualKm.replace(",", ".")) || 0;
  const km = oneWay * (roundTrip ? 2 : 1);
  const plan = km > 0 ? planeStrecke(data, km) : null;
  const places = data.places || [];

  const fieldBox = (f: Field, label: string) => {
    const st = fields[f];
    return (
      <div className="plan-field">
        <label htmlFor={`plan-${f}`}>{label}</label>
        <div className="plan-input-row">
          <input
            id={`plan-${f}`}
            type="text"
            autoComplete="off"
            placeholder={f === "from" ? "Startadresse" : "Zieladresse"}
            value={st.text}
            maxLength={160}
            onChange={(e) => onType(f, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearch(f);
              }
            }}
          />
          {f === "from" && (
            <button type="button" className="plan-icon-btn" title="Aktueller Standort" aria-label="Aktueller Standort" onClick={useGps}>
              📍
            </button>
          )}
          <button type="button" className="plan-icon-btn" title="Suchen" aria-label="Adresse suchen" onClick={() => onSearch(f)}>
            🔎
          </button>
        </div>
        {st.busy && <div className="plan-hint">Suche …</div>}
        {st.results.length > 0 && (
          <ul className="plan-results">
            {st.results.map((r, i) => (
              <li key={`${r.lat},${r.lon},${i}`}>
                <button type="button" onClick={() => choose(f, r)}>
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {places.length > 0 && (
          <div className="plan-chips">
            {places.map((p) => (
              <button type="button" key={p.name} className="plan-chip" title={p.label} onClick={() => choose(f, p)}>
                {p.name}
              </button>
            ))}
          </div>
        )}
        {st.point && !places.some((p) => p.lat === st.point!.lat && p.lon === st.point!.lon) && (
          naming?.field === f ? (
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
              ☆ als Ort speichern
            </button>
          )
        )}
      </div>
    );
  };

  return (
    <div className="plan">
      <section className="plan-card">
        <h2 className="plan-title">Strecke</h2>
        {orsReady === false && !testMode && (
          <p className="plan-note">
            Der Routendienst ist noch nicht eingerichtet (Schlüssel fehlt). Adressen lassen sich mit 🔎 suchen, die
            Entfernung bitte unten selbst eintragen.
          </p>
        )}
        {fieldBox("from", "Start")}
        {fieldBox("to", "Ziel")}
        <label className="plan-check">
          <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} /> Hin- und Rückfahrt
        </label>
        <button
          type="button"
          className="plan-go"
          disabled={!fields.from.point || !fields.to.point || routing}
          onClick={calculate}
        >
          {routing ? "Berechne …" : "Strecke berechnen"}
        </button>
        {route ? (
          <p className="plan-route">
            <b>{fmtNum(km, 0)} km</b>
            {route.minutes !== null && <> · ca. {Math.floor((route.minutes * (roundTrip ? 2 : 1)) / 60)} h {(route.minutes * (roundTrip ? 2 : 1)) % 60} min</>}
            <span> ({route.source})</span>
          </p>
        ) : (
          <div className="plan-manual">
            <label htmlFor="plan-km">oder Entfernung einfach (km):</label>
            <input
              id="plan-km"
              type="number"
              min="0"
              inputMode="decimal"
              value={manualKm}
              onChange={(e) => setManualKm(e.target.value.replace(/-/g, ""))}
            />
          </div>
        )}
      </section>

      {plan && (
        <section className="plan-card">
          <h2 className="plan-title">Mit welchem Auto?</h2>
          {plan.empfehlung && (
            <div className={`plan-reco plan-reco-${plan.empfehlung}`}>
              <b>Empfehlung: {plan.autos.find((a) => a.vehicle === plan.empfehlung)!.name}</b>
              <span>{plan.grund}</span>
            </div>
          )}
          <div className="plan-cars">
            {plan.autos.map((a) => (
              <div key={a.vehicle} className={`plan-car plan-car-${a.vehicle}` + (a.verfuegbar ? "" : " plan-car-off") + (a.vehicle === plan.empfehlung ? " plan-car-win" : "")}>
                <div className="plan-car-name">{a.name}</div>
                {!a.verfuegbar ? (
                  <div className="plan-hint">noch nicht übergeben</div>
                ) : (
                  <>
                    <div className="plan-cost">{a.zusatzkosten === null ? "–" : fmtEUR(a.zusatzkosten)}</div>
                    <div className="plan-hint">Zusatzkosten (Strom)</div>
                    <div className="plan-sub">
                      Vollkosten-Anteil: {a.vollkosten === null ? "–" : fmtEUR(a.vollkosten)}
                    </div>
                    {a.puffer !== null && (
                      <div className={"plan-sub " + (a.puffer >= 0 ? "plan-ok" : "plan-bad")}>
                        {fmtNum(Math.abs(a.puffer), 0)} km {a.puffer >= 0 ? "unter" : "über"} Plan
                      </div>
                    )}
                    <div className="plan-sub">
                      {a.ladestopps === null
                        ? "Reichweite unbekannt"
                        : a.ladestopps === 0
                          ? "ohne Ladestopp"
                          : `ca. ${a.ladestopps} Ladestopp${a.ladestopps > 1 ? "s" : ""}`}
                      {a.reichweite.letzte && (
                        <span className="plan-hint">
                          {" "}
                          (zuletzt {a.reichweite.letzte.km} km am {a.reichweite.letzte.datum.split("-").reverse().join(".")})
                        </span>
                      )}
                    </div>
                    {a.mehrKmRisiko !== null && a.mehrKmRisiko > 0 && (
                      <div className="plan-sub plan-bad">Mehrkilometer-Risiko: {fmtEUR(a.mehrKmRisiko)}</div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="plan-note">
            Zusatzkosten = Strecke × Ladekosten je km der letzten 90 Tage. Leasing und Versicherung zahlt ihr ohnehin; der
            Vollkosten-Anteil zeigt die Strecke mit dem TCO je km.
          </p>
        </section>
      )}
    </div>
  );
}
