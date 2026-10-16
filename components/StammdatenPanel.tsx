"use client";

import { useState } from "react";
import { VEHICLES } from "@/lib/constants";
import { leasingKm } from "@/lib/data";
import Collapsible from "./Collapsible";
import type { AppData, VehicleKey, VehicleStammdaten } from "@/lib/types";

// Fahrzeug-Stammdaten (v2.48.00): reine Information, keine Rechnung. Kennzeichen, FIN
// und Vertragsnummer sind abgedeckt, bis man „anzeigen“ tippt (Bildschirm teilen,
// Blick über die Schulter). Die Werte liegen nur im Datensatz hinter dem PIN.

const FELDER: Array<[keyof VehicleStammdaten, string, boolean]> = [
  ["modell", "🚘 Modellbezeichnung", false],
  ["farbe", "🎨 Farbe", false],
  ["kennzeichen", "🔖 Kennzeichen", true],
  ["fin", "🔢 FIN (Fahrgestellnummer)", true],
  ["leasinggeber", "🏦 Leasinggeber", false],
  ["vertragsnummer", "📄 Vertragsnummer", true],
  ["haendler", "🏪 Händler", false],
  ["hauptfahrer", "🧑 Hauptfahrer:in", false],
];

const datum = (iso: string) => iso.split("-").reverse().join(".");

function abdecken(wert: string): string {
  if (!wert) return "–";
  const sichtbar = wert.length > 6 ? wert.slice(-4) : "";
  return "•".repeat(Math.max(3, wert.length - sichtbar.length)) + sichtbar;
}

function Fahrzeug({ data, updateData, vehicleKey }: { data: AppData; updateData: (fn: (d: AppData) => void) => void; vehicleKey: VehicleKey }) {
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  const s = data.vehicles[vehicleKey].stammdaten;
  const { nickname, official } = VEHICLES[vehicleKey];
  // Leasingende = Übergabe + Laufzeit − 1 Tag (28.11.2025 + 36 Monate -> 27.11.2028)
  const ende = leasingKm(data, vehicleKey).ende;
  let endeText = "– (Übergabedatum in den Fixkosten fehlt)";
  if (ende) {
    const e = new Date(`${ende}T00:00:00`);
    e.setDate(e.getDate() - 1);
    endeText = `${datum(`${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`)} (berechnet)`;
  }
  return (
    <div className="fixed-box">
      <Collapsible
        title={
          <>
            <span className="vehicle-nickname">{nickname}</span> <span className="vehicle-official">({official})</span> — Stammdaten
          </>
        }
        defaultOpen={false}
      >
        {FELDER.map(([feld, label, geheim]) => {
          const id = `${vehicleKey}_sd_${feld}`;
          const zeigen = !geheim || offen[feld];
          return (
            <div className="field-row" key={feld}>
              <label htmlFor={id}>{label}</label>
              {zeigen ? (
                <input
                  type="text"
                  id={id}
                  autoComplete="off"
                  spellCheck={false}
                  value={s[feld]}
                  onChange={(e) => updateData((d) => { d.vehicles[vehicleKey].stammdaten[feld] = e.target.value; })}
                />
              ) : (
                <span className="stamm-geheim">
                  <span className="stamm-maske">{abdecken(s[feld])}</span>
                  <button type="button" className="stamm-zeigen" aria-label={`${label} anzeigen und bearbeiten`} onClick={() => setOffen((o) => ({ ...o, [feld]: true }))}>
                    anzeigen
                  </button>
                </span>
              )}
            </div>
          );
        })}
        <div className="field-row">
          <span className="stamm-label">📅 Leasingende</span>
          <span className="stamm-wert">{endeText}</span>
        </div>
      </Collapsible>
    </div>
  );
}

export default function StammdatenPanel({ data, updateData }: { data: AppData; updateData: (fn: (d: AppData) => void) => void }) {
  return (
    <div className="stamm-grid">
      <Fahrzeug data={data} updateData={updateData} vehicleKey="b10" />
      <Fahrzeug data={data} updateData={updateData} vehicleKey="t03" />
      <p className="stamm-hinweis">Nur zur Information, fließt in keine Rechnung ein. Kennzeichen, FIN und Vertragsnummer bleiben abgedeckt, bis du auf „anzeigen“ tippst.</p>
    </div>
  );
}
