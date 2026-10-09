"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { VEHICLES } from "@/lib/constants";
import { fmtNum, leasingJahr, leasingKm } from "@/lib/data";
import type { AppData, VehicleKey } from "@/lib/types";

// Leasingkilometer-Countdown (v2.44.00): groß das laufende Jahreskontingent bis zum
// Stichtag (Gesamtkilometer ÷ Leasingjahre, Übertrag aus dem Vorjahr eingerechnet),
// Balken gefahren/verfügbar mit Markierung des gleichmäßigen Plans. Ein Tipp auf die
// Zahl öffnet ein Overlay mit den Gesamtkilometern und allen Leasingjahren.

const datum = (iso: string) => iso.split("-").reverse().join(".");

export default function LeasingCountdown({ data, vehicle }: { data: AppData; vehicle: VehicleKey }) {
  const [gesamtOffen, setGesamtOffen] = useState(false);
  const l = leasingKm(data, vehicle);
  if (l.inklusiveKm <= 0) return null;
  const j = leasingJahr(data, vehicle);

  // Ohne Übergabedatum: wie bisher auf die Gesamtkilometer bezogen
  if (!j) {
    return (
      <div className={`lkm lkm-${vehicle}`}>
        <div className="lkm-head">
          <span className="lkm-label">Leasingkilometer</span>
          <span className="lkm-rest">
            {fmtNum(l.inklusiveKm, 0)} <small>km</small>
          </span>
        </div>
        <div className="lkm-hint">Übergabedatum fehlt (Fixkosten)</div>
      </div>
    );
  }

  const over = j.rest !== null && j.rest < 0;
  const verfuegbar = j.verfuegbar ?? j.kontingent;
  const usedPct = j.gefahrenImJahr !== null && verfuegbar > 0 ? Math.min(100, (j.gefahrenImJahr / verfuegbar) * 100) : 0;
  // Planmarke im Jahresbalken: Anteil des Leasingjahres, der schon vorbei ist
  const planPct = j.anteilJahr * 100;

  return (
    <div className={`lkm lkm-${vehicle}`}>
      <div className="lkm-head">
        <span className="lkm-label">
          {over ? "Über dem Kontingent" : "Leasingkilometer übrig"}
          <small>
            {j.nr}. Leasingjahr · bis {datum(j.stichtag)}
          </small>
        </span>
        <button
          type="button"
          className={"lkm-rest lkm-rest-btn" + (over ? " lkm-over" : "")}
          aria-label="Gesamtkilometer des Leasings anzeigen"
          onClick={() => setGesamtOffen(true)}
        >
          {j.rest === null ? "–" : fmtNum(Math.abs(j.rest), 0)} <small>km</small>
        </button>
      </div>
      <div
        className="lkm-bar"
        role="img"
        aria-label={
          j.gefahrenImJahr === null
            ? "km-Stand zu Beginn des Leasingjahres unbekannt"
            : `${fmtNum(j.gefahrenImJahr, 0)} von ${fmtNum(verfuegbar, 0)} Leasingkilometern dieses Jahres gefahren`
        }
      >
        <i className="lkm-used" style={{ width: `${usedPct}%` }} />
        <b className="lkm-plan" style={{ left: `${planPct}%` }} />
      </div>
      <div className="lkm-caption">
        {j.gefahrenImJahr === null ? (
          <>Kontingent {fmtNum(j.kontingent, 0)} km</>
        ) : (
          <>
            {fmtNum(j.gefahrenImJahr, 0)} / {fmtNum(verfuegbar, 0)} km
            {j.uebertrag ? (
              <span className="lkm-end">
                {" "}
                (inkl. {j.uebertrag > 0 ? "+" : "−"}
                {fmtNum(Math.abs(j.uebertrag), 0)} km Übertrag)
              </span>
            ) : null}
          </>
        )}
      </div>
      {j.voraus !== null && (
        <div className={"lkm-plan-text" + (j.voraus > 0 ? " lkm-plan-over" : " lkm-plan-ok")}>
          {j.voraus > 0 ? `${fmtNum(j.voraus, 0)} km schneller als geplant` : `${fmtNum(-j.voraus, 0)} km Luft zum Plan`}
          <span className="lkm-end"> · noch {j.restTage} Tage</span>
        </div>
      )}
      {l.startKmGeschaetzt && l.gefahren !== null && (
        <div className="lkm-hint">ab 0 km gerechnet – km bei Übergabe in Fixkosten prüfen</div>
      )}

      {gesamtOffen &&
        createPortal(
          <div className="fab-overlay" onClick={() => setGesamtOffen(false)}>
            <div className={`fab-modal lkm-gesamt lkm-gesamt-${vehicle}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Leasingkilometer gesamt">
              <h3>Leasingkilometer · {VEHICLES[vehicle].nickname}</h3>
              <div className="lkm-gesamt-zahl">
                {l.rest === null ? "–" : fmtNum(Math.abs(l.rest), 0)} <small>km {l.rest !== null && l.rest < 0 ? "darüber" : "übrig"}</small>
              </div>
              <p className="lkm-gesamt-text">
                von <b>{fmtNum(l.inklusiveKm, 0)} km</b> für die ganze Laufzeit
                {l.ende ? ` bis ${datum(l.ende)}` : ""}; gefahren {l.gefahren === null ? "–" : `${fmtNum(l.gefahren, 0)} km`}.
              </p>
              <ul className="lkm-jahre">
                {Array.from({ length: j.anzahl }, (_, i) => {
                  const nr = i + 1;
                  const status = nr < j.nr ? "vorbei" : nr === j.nr ? "läuft" : "kommt";
                  return (
                    <li key={nr} className={"lkm-jahr lkm-jahr-" + (nr === j.nr ? "jetzt" : status)}>
                      <span>{nr}. Leasingjahr</span>
                      <b>{fmtNum(j.kontingent, 0)} km</b>
                      <small>{status}</small>
                    </li>
                  );
                })}
              </ul>
              <p className="lkm-gesamt-hint">
                {fmtNum(l.inklusiveKm, 0)} km ÷ {j.anzahl} Jahre = {fmtNum(j.kontingent, 0)} km je Leasingjahr. Übrige oder
                zu viel gefahrene km wandern ins nächste Jahr.
              </p>
              <button type="button" className="btn btn-primary lkm-gesamt-zu" onClick={() => setGesamtOffen(false)}>
                Schließen
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
