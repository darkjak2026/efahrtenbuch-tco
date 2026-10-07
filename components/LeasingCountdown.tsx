"use client";

import { fmtNum, leasingKm } from "@/lib/data";
import type { AppData, VehicleKey } from "@/lib/types";

// Freikilometer-Countdown aus dem Leasingvertrag: verbleibende km groß, darunter
// ein Balken gefahren/übrig mit Markierung, wo man zeitanteilig stehen dürfte.
export default function LeasingCountdown({ data, vehicle }: { data: AppData; vehicle: VehicleKey }) {
  const l = leasingKm(data, vehicle);
  if (l.inklusiveKm <= 0) return null;
  const over = l.rest !== null && l.rest < 0;
  const usedPct = l.anteilGefahren !== null ? Math.min(100, l.anteilGefahren * 100) : 0;
  const ende = l.ende ? l.ende.split("-").reverse().join(".") : null;

  return (
    <div className={`lkm lkm-${vehicle}`}>
      <div className="lkm-head">
        <span className="lkm-label">{over ? "Mehrkilometer" : "Leasing-km übrig"}</span>
        <span className={"lkm-rest" + (over ? " lkm-over" : "")}>
          {l.rest === null ? "–" : fmtNum(Math.abs(l.rest), 0)} <small>km</small>
        </span>
      </div>
      <div
        className="lkm-bar"
        role="img"
        aria-label={
          l.gefahren === null
            ? "Noch kein km-Stand"
            : `${fmtNum(l.gefahren, 0)} von ${fmtNum(l.inklusiveKm, 0)} Freikilometern gefahren`
        }
      >
        <i className="lkm-used" style={{ width: `${usedPct}%` }} />
        {l.anteilZeit !== null && <b className="lkm-plan" style={{ left: `${l.anteilZeit * 100}%` }} />}
      </div>
      <div className="lkm-caption">
        {l.gefahren === null ? (
          <>Noch kein km-Stand erfasst</>
        ) : (
          <>
            {fmtNum(l.gefahren, 0)} / {fmtNum(l.inklusiveKm, 0)} km
          </>
        )}
      </div>
      {l.planAbweichung !== null && (
        <div className={"lkm-plan-text" + (l.planAbweichung > 0 ? " lkm-plan-over" : " lkm-plan-ok")}>
          {l.planAbweichung > 0
            ? `${fmtNum(l.planAbweichung, 0)} km über Plan`
            : `${fmtNum(-l.planAbweichung, 0)} km unter Plan`}
          {ende && <span className="lkm-end"> · bis {ende}</span>}
        </div>
      )}
      {l.anteilZeit === null && <div className="lkm-hint">Übergabedatum fehlt (Fixkosten)</div>}
      {l.startKmGeschaetzt && l.gefahren !== null && (
        <div className="lkm-hint">ab 0 km gerechnet – km bei Übergabe in Fixkosten prüfen</div>
      )}
    </div>
  );
}
