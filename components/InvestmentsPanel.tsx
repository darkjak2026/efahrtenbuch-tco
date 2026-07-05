"use client";

import { emptyInvest, fmtEUR, parseNum } from "@/lib/data";
import { vehicleShortLabel } from "@/lib/constants";
import type { AppData, VehicleKey } from "@/lib/types";

const FAHRZEUG_OPTIONS: Array<["" | VehicleKey, string]> = [
  ["", "Haushalt"],
  ["b10", vehicleShortLabel("b10")],
  ["t03", vehicleShortLabel("t03")],
];

export default function InvestmentsPanel({
  data,
  updateData,
}: {
  data: AppData;
  updateData: (fn: (d: AppData) => void) => void;
}) {
  return (
    <>
      <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
        Einmalkosten, z.B. Wallbox-Kauf — werden über 36 Monate (Leasingdauer) abgeschrieben.
      </p>
      <div className="recurring-list">
        {data.investitionen.map((inv, idx) => {
          const monthly = parseNum(inv.betrag) / 36;
          return (
            <div className="recurring-card" key={idx}>
              <div className="recurring-row">
                <label>Beschreibung</label>
                <input
                  type="text"
                  value={inv.beschreibung}
                  placeholder="z.B. Wallbox-Kauf"
                  onChange={(e) => updateData((d) => { d.investitionen[idx].beschreibung = e.target.value; })}
                />
              </div>
              <div className="recurring-row">
                <label>Datum &amp; Fahrzeug</label>
                <div className="recurring-row-combo">
                  <input
                    type="date"
                    value={inv.datum}
                    onChange={(e) => updateData((d) => { d.investitionen[idx].datum = e.target.value; })}
                  />
                  <select
                    value={inv.fahrzeug}
                    onChange={(e) => updateData((d) => { d.investitionen[idx].fahrzeug = e.target.value as "" | VehicleKey; })}
                  >
                    {FAHRZEUG_OPTIONS.map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="recurring-row">
                <label>Betrag €</label>
                <div className="recurring-row-combo">
                  <input
                    type="number"
                    step="0.01"
                    value={inv.betrag}
                    onChange={(e) => updateData((d) => { d.investitionen[idx].betrag = e.target.value; })}
                  />
                  {monthly > 0 && <span className="monthly-equiv">≈ {fmtEUR(monthly)} / Monat (36 Mon.)</span>}
                </div>
              </div>
              <div className="recurring-meta">
                <button
                  type="button"
                  className="mini-del"
                  title="Position löschen"
                  onClick={() =>
                    updateData((d) => {
                      d.investitionen.splice(idx, 1);
                      if (d.investitionen.length === 0) d.investitionen.push(emptyInvest());
                    })
                  }
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button className="add-mini" onClick={() => updateData((d) => { d.investitionen.push(emptyInvest()); })}>
        + Position hinzufügen
      </button>
    </>
  );
}
