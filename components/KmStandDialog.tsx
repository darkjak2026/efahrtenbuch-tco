"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { todayStr, VEHICLES } from "@/lib/constants";
import { fmtNum, kmPunkte, vehicleKmWindowUpTo } from "@/lib/data";
import type { AppData, VehicleKey } from "@/lib/types";

// „km-Stand aktualisieren“ (v2.52.00): Tachostand ohne Ladevorgang eintragen. Zählt für
// TCO je km, Leasingkilometer und Monats-km, erscheint aber nicht als Ladevorgang.
// Darunter die eigenen km-Stände des Autos zum Korrigieren (Löschen mit Rückfrage).

const datumDe = (iso: string) => iso.split("-").reverse().join(".");

export default function KmStandDialog({
  data,
  vehicle,
  updateData,
  showToast,
  onClose,
}: {
  data: AppData;
  vehicle: VehicleKey;
  updateData: (fn: (d: AppData) => void) => void;
  showToast: (msg: string) => void;
  onClose: () => void;
}) {
  const [datum, setDatum] = useState(todayStr());
  const [km, setKm] = useState("");
  const [loeschen, setLoeschen] = useState<number | null>(null);

  // letzter bekannter Stand bis zum gewählten Tag (Ladevorgänge, Stichtag, eigene Stände)
  const punkte = kmPunkte(data, vehicle).filter((p) => p.datum <= datum);
  const letzter = punkte.reduce<{ datum: string; km: number } | null>(
    (best, p) => (!best || p.datum > best.datum || (p.datum === best.datum && p.km > best.km) ? p : best),
    null
  );
  const bisher = vehicleKmWindowUpTo(data, vehicle, datum);
  const zahl = Number(km);
  const zuKlein = km !== "" && bisher !== null && zahl < bisher;
  const ok = km !== "" && zahl > 0 && !zuKlein && !!datum;

  const eigene = (data.kmStaende || [])
    .map((k, idx) => ({ ...k, idx }))
    .filter((k) => k.fahrzeug === vehicle)
    .sort((a, b) => b.datum.localeCompare(a.datum) || b.km - a.km)
    .slice(0, 5);

  const speichern = () => {
    if (!ok) return;
    updateData((d) => {
      if (!Array.isArray(d.kmStaende)) d.kmStaende = [];
      // ein Stand je Auto und Tag: am selben Tag ersetzen
      const i = d.kmStaende.findIndex((k) => k.fahrzeug === vehicle && k.datum === datum);
      const neu = { datum, fahrzeug: vehicle, km: zahl };
      if (i >= 0) d.kmStaende[i] = neu;
      else d.kmStaende.push(neu);
    });
    showToast(`km-Stand ${fmtNum(zahl, 0)} km gespeichert`);
    onClose();
  };

  return createPortal(
    <div className="fab-overlay" onClick={onClose}>
      <div className={`fab-modal kms kms-${vehicle}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="kms-titel">
        <h3 id="kms-titel">km-Stand · {VEHICLES[vehicle].nickname}</h3>
        <p className="kms-bisher">
          {letzter ? (
            <>
              Bisher bekannt: <b>{fmtNum(letzter.km, 0)} km</b> am {datumDe(letzter.datum)}
            </>
          ) : (
            "Noch kein km-Stand bekannt."
          )}
        </p>
        <div className="field-row">
          <label htmlFor="kms-km">📟 Tachostand (km)</label>
          <input
            id="kms-km"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            autoFocus
            value={km}
            onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") speichern();
            }}
          />
        </div>
        <div className="field-row">
          <label htmlFor="kms-datum">📅 Datum</label>
          <input id="kms-datum" type="date" max={todayStr()} value={datum} onChange={(e) => setDatum(e.target.value)} />
        </div>
        {zuKlein && <p className="kms-fehler">Kleiner als der letzte bekannte Stand ({fmtNum(bisher!, 0)} km) – bitte prüfen.</p>}
        <p className="kms-hinweis">Zählt für TCO je km, Leasingkilometer und die km im Monat – ohne einen Ladevorgang anzulegen.</p>
        <div className="kms-knoepfe">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" disabled={!ok} onClick={speichern}>
            Speichern
          </button>
        </div>
        {eigene.length > 0 && (
          <div className="kms-liste">
            <div className="kms-liste-t">Eigene km-Stände</div>
            {eigene.map((k) => (
              <div className="kms-eintrag" key={k.idx}>
                <span>
                  {datumDe(k.datum)} · <b>{fmtNum(k.km, 0)} km</b>
                </span>
                {loeschen === k.idx ? (
                  <span className="kms-frage">
                    <button
                      type="button"
                      className="kms-ja"
                      onClick={() => {
                        updateData((d) => {
                          d.kmStaende.splice(k.idx, 1);
                        });
                        setLoeschen(null);
                        showToast("km-Stand gelöscht");
                      }}
                    >
                      Löschen
                    </button>
                    <button type="button" className="kms-nein" onClick={() => setLoeschen(null)}>
                      Behalten
                    </button>
                  </span>
                ) : (
                  <button type="button" className="kms-x" aria-label={`km-Stand vom ${datumDe(k.datum)} löschen`} onClick={() => setLoeschen(k.idx)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
