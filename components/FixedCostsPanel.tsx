"use client";

import { emptyRecurring } from "@/lib/data";
import { VEHICLES, vehicleShortLabel } from "@/lib/constants";
import Collapsible from "./Collapsible";
import type { AppData, VehicleKey } from "@/lib/types";

const FAHRZEUG_OPTIONS: Array<["" | VehicleKey, string]> = [
  ["", "Haushalt"],
  ["b10", vehicleShortLabel("b10")],
  ["t03", vehicleShortLabel("t03")],
];

const RECURRING_FAHRZEUG_OPTIONS: Array<["" | VehicleKey | "beide", string]> = [
  ...FAHRZEUG_OPTIONS,
  ["beide", "Beide (50/50)"],
];

function VehicleHeading({ vehicleKey }: { vehicleKey: VehicleKey }) {
  const { nickname, official } = VEHICLES[vehicleKey];
  return (
    <>
      <span className="vehicle-nickname">{nickname}</span> <span className="vehicle-official">({official})</span> —
      Fixkosten
    </>
  );
}

export default function FixedCostsPanel({
  data,
  updateData,
}: {
  data: AppData;
  updateData: (fn: (d: AppData) => void) => void;
}) {
  return (
    <div className="fixed-grid">
      <div className="fixed-box">
        <Collapsible title={<VehicleHeading vehicleKey="b10" />} defaultOpen={false}>
          <div className="field-row">
            <label htmlFor="b10_leasing">🚗 Leasingrate € / Monat</label>
            <input
              type="number"
              step="0.01"
              id="b10_leasing"
              value={data.vehicles.b10.leasing}
              onChange={(e) => updateData((d) => { d.vehicles.b10.leasing = e.target.value; })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_versicherung">🛡️ Versicherung € / Monat</label>
            <input
              type="number"
              step="0.01"
              id="b10_versicherung"
              value={data.vehicles.b10.versicherung}
              onChange={(e) => updateData((d) => { d.vehicles.b10.versicherung = e.target.value; })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_start">📅 Übergabedatum</label>
            <input
              type="date"
              id="b10_start"
              value={data.vehicles.b10.start}
              onChange={(e) => updateData((d) => { d.vehicles.b10.start = e.target.value; })}
            />
          </div>
        </Collapsible>
      </div>

      <div className="fixed-box">
        <Collapsible title={<VehicleHeading vehicleKey="t03" />} defaultOpen={false}>
          <div className="field-row">
            <label htmlFor="t03_leasing">🚗 Leasingrate € / Monat</label>
            <input
              type="number"
              step="0.01"
              id="t03_leasing"
              value={data.vehicles.t03.leasing}
              onChange={(e) => updateData((d) => { d.vehicles.t03.leasing = e.target.value; })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_versicherung">🛡️ Versicherung € / Monat</label>
            <input
              type="number"
              step="0.01"
              id="t03_versicherung"
              value={data.vehicles.t03.versicherung}
              onChange={(e) => updateData((d) => { d.vehicles.t03.versicherung = e.target.value; })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_start">📅 Übergabedatum</label>
            <input
              type="date"
              id="t03_start"
              value={data.vehicles.t03.start}
              onChange={(e) => updateData((d) => { d.vehicles.t03.start = e.target.value; })}
            />
          </div>
        </Collapsible>
      </div>

      <div className="fixed-box" style={{ gridColumn: "1 / -1" }}>
        <Collapsible title="🔁 Wiederkehrende Kosten" defaultOpen={false}>
          <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
            Abos, Stromtarif-Grundgebühr, Apps, finanzierte Wallbox, … &quot;Beide (50/50)&quot; rechnet die Hälfte des
            Betrags je Fahrzeug in dessen TCO ein.
          </p>
          <div className="recurring-list">
            {data.recurringCosts.map((rec, idx) => (
              <div className="recurring-card" key={idx}>
                <div className="recurring-row">
                  <label>Anbieter</label>
                  <input
                    type="text"
                    value={rec.anbieter}
                    placeholder="z.B. EWE"
                    onChange={(e) => updateData((d) => { d.recurringCosts[idx].anbieter = e.target.value; })}
                  />
                </div>
                <div className="recurring-row">
                  <label>Zweck</label>
                  <input
                    type="text"
                    value={rec.zweck}
                    placeholder="z.B. Stromtarif Grundgebühr"
                    onChange={(e) => updateData((d) => { d.recurringCosts[idx].zweck = e.target.value; })}
                  />
                </div>
                <div className="recurring-row">
                  <label>€ / Monat</label>
                  <input
                    type="number"
                    step="0.01"
                    value={rec.betrag}
                    onChange={(e) => updateData((d) => { d.recurringCosts[idx].betrag = e.target.value; })}
                  />
                </div>
                <div className="recurring-meta">
                  <select
                    value={rec.fahrzeug}
                    onChange={(e) =>
                      updateData((d) => {
                        d.recurringCosts[idx].fahrzeug = e.target.value as "" | VehicleKey | "beide";
                      })
                    }
                  >
                    {RECURRING_FAHRZEUG_OPTIONS.map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    title="seit"
                    value={rec.start}
                    onChange={(e) => updateData((d) => { d.recurringCosts[idx].start = e.target.value; })}
                  />
                  <button
                    type="button"
                    className="mini-del"
                    title="Position löschen"
                    onClick={() =>
                      updateData((d) => {
                        d.recurringCosts.splice(idx, 1);
                        if (d.recurringCosts.length === 0) d.recurringCosts.push(emptyRecurring());
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className="add-mini" onClick={() => updateData((d) => { d.recurringCosts.push(emptyRecurring()); })}>
            + Position hinzufügen
          </button>
          <div className="field-row" style={{ marginTop: 10 }}>
            <label htmlFor="erfassungStart">📅 Standard-Start (falls oben kein Datum)</label>
            <input
              type="date"
              id="erfassungStart"
              value={data.erfassungStart}
              onChange={(e) => updateData((d) => { d.erfassungStart = e.target.value; })}
            />
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
