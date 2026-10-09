"use client";

import { emptyRecurring } from "@/lib/data";
import { DATE_RANGE_MAX, DATE_RANGE_MIN, VEHICLES, vehicleShortLabel } from "@/lib/constants";
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
              min="0"
              value={data.vehicles.b10.leasing}
              onChange={(e) => updateData((d) => { d.vehicles.b10.leasing = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_versicherung">🛡️ Versicherung € / Monat</label>
            <input
              type="number"
              step="0.01"
              id="b10_versicherung"
              min="0"
              value={data.vehicles.b10.versicherung}
              onChange={(e) => updateData((d) => { d.vehicles.b10.versicherung = e.target.value.replace(/-/g, ""); })}
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
          <div className="field-row">
            <label htmlFor="b10_freiKmProJahr">🛣️ Freikilometer / Jahr (Leasing)</label>
            <input
              type="number"
              step="100"
              id="b10_freiKmProJahr"
              min="0"
              value={data.vehicles.b10.freiKmProJahr}
              onChange={(e) => updateData((d) => { d.vehicles.b10.freiKmProJahr = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_freiKmGesamt">🛣️ Freikilometer gesamt laut Vertrag (statt pro Jahr)</label>
            <input
              type="number"
              step="100"
              id="b10_freiKmGesamt"
              min="0"
              value={data.vehicles.b10.freiKmGesamt}
              onChange={(e) => updateData((d) => { d.vehicles.b10.freiKmGesamt = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_leasingMonate">⏱️ Leasinglaufzeit in Monaten</label>
            <input
              type="number"
              step="1"
              id="b10_leasingMonate"
              min="0"
              value={data.vehicles.b10.leasingMonate}
              onChange={(e) => updateData((d) => { d.vehicles.b10.leasingMonate = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_verbrauch">⚡ Ø Verbrauch (kWh/100 km, für die Planung)</label>
            <input
              type="number"
              step="0.1"
              id="b10_verbrauch"
              min="0"
              value={data.vehicles.b10.verbrauchKwh100}
              onChange={(e) => updateData((d) => { d.vehicles.b10.verbrauchKwh100 = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_mehrKmCent">➕ Mehrkilometer (Cent je km, laut Vertrag)</label>
            <input
              type="number"
              step="0.1"
              id="b10_mehrKmCent"
              min="0"
              value={data.vehicles.b10.mehrKmCent}
              onChange={(e) => updateData((d) => { d.vehicles.b10.mehrKmCent = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_minderKmCent">➖ Minderkilometer-Vergütung (Cent je km)</label>
            <input
              type="number"
              step="0.1"
              id="b10_minderKmCent"
              min="0"
              value={data.vehicles.b10.minderKmCent}
              onChange={(e) => updateData((d) => { d.vehicles.b10.minderKmCent = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_kmBeiLeasingbeginn">📟 km-Stand bei Übergabe (leer = 0)</label>
            <input
              type="number"
              step="1"
              id="b10_kmBeiLeasingbeginn"
              min="0"
              value={data.vehicles.b10.kmBeiLeasingbeginn}
              onChange={(e) => updateData((d) => { d.vehicles.b10.kmBeiLeasingbeginn = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_stichtag">🏁 Stichtag (Startwerte)</label>
            <input
              type="date"
              id="b10_stichtag"
              min={DATE_RANGE_MIN}
              max={DATE_RANGE_MAX}
              value={data.vehicles.b10.stichtag}
              onChange={(e) => updateData((d) => { d.vehicles.b10.stichtag = e.target.value; })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_stichtagKm">📟 km-Stand am Stichtag</label>
            <input
              type="number"
              step="1"
              id="b10_stichtagKm"
              min="0"
              value={data.vehicles.b10.stichtagKm}
              onChange={(e) => updateData((d) => { d.vehicles.b10.stichtagKm = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="b10_stichtagLadekosten">⚡ Ladekosten bis Stichtag €</label>
            <input
              type="number"
              step="0.01"
              id="b10_stichtagLadekosten"
              min="0"
              value={data.vehicles.b10.stichtagLadekosten}
              onChange={(e) => updateData((d) => { d.vehicles.b10.stichtagLadekosten = e.target.value.replace(/-/g, ""); })}
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
              min="0"
              value={data.vehicles.t03.leasing}
              onChange={(e) => updateData((d) => { d.vehicles.t03.leasing = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_versicherung">🛡️ Versicherung € / Monat</label>
            <input
              type="number"
              step="0.01"
              id="t03_versicherung"
              min="0"
              value={data.vehicles.t03.versicherung}
              onChange={(e) => updateData((d) => { d.vehicles.t03.versicherung = e.target.value.replace(/-/g, ""); })}
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
          <div className="field-row">
            <label htmlFor="t03_freiKmProJahr">🛣️ Freikilometer / Jahr (Leasing)</label>
            <input
              type="number"
              step="100"
              id="t03_freiKmProJahr"
              min="0"
              value={data.vehicles.t03.freiKmProJahr}
              onChange={(e) => updateData((d) => { d.vehicles.t03.freiKmProJahr = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_freiKmGesamt">🛣️ Freikilometer gesamt laut Vertrag (statt pro Jahr)</label>
            <input
              type="number"
              step="100"
              id="t03_freiKmGesamt"
              min="0"
              value={data.vehicles.t03.freiKmGesamt}
              onChange={(e) => updateData((d) => { d.vehicles.t03.freiKmGesamt = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_leasingMonate">⏱️ Leasinglaufzeit in Monaten</label>
            <input
              type="number"
              step="1"
              id="t03_leasingMonate"
              min="0"
              value={data.vehicles.t03.leasingMonate}
              onChange={(e) => updateData((d) => { d.vehicles.t03.leasingMonate = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_verbrauch">⚡ Ø Verbrauch (kWh/100 km, für die Planung)</label>
            <input
              type="number"
              step="0.1"
              id="t03_verbrauch"
              min="0"
              value={data.vehicles.t03.verbrauchKwh100}
              onChange={(e) => updateData((d) => { d.vehicles.t03.verbrauchKwh100 = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_mehrKmCent">➕ Mehrkilometer (Cent je km, laut Vertrag)</label>
            <input
              type="number"
              step="0.1"
              id="t03_mehrKmCent"
              min="0"
              value={data.vehicles.t03.mehrKmCent}
              onChange={(e) => updateData((d) => { d.vehicles.t03.mehrKmCent = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_minderKmCent">➖ Minderkilometer-Vergütung (Cent je km)</label>
            <input
              type="number"
              step="0.1"
              id="t03_minderKmCent"
              min="0"
              value={data.vehicles.t03.minderKmCent}
              onChange={(e) => updateData((d) => { d.vehicles.t03.minderKmCent = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_kmBeiLeasingbeginn">📟 km-Stand bei Übergabe (leer = 0)</label>
            <input
              type="number"
              step="1"
              id="t03_kmBeiLeasingbeginn"
              min="0"
              value={data.vehicles.t03.kmBeiLeasingbeginn}
              onChange={(e) => updateData((d) => { d.vehicles.t03.kmBeiLeasingbeginn = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_stichtag">🏁 Stichtag (Startwerte)</label>
            <input
              type="date"
              id="t03_stichtag"
              min={DATE_RANGE_MIN}
              max={DATE_RANGE_MAX}
              value={data.vehicles.t03.stichtag}
              onChange={(e) => updateData((d) => { d.vehicles.t03.stichtag = e.target.value; })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_stichtagKm">📟 km-Stand am Stichtag</label>
            <input
              type="number"
              step="1"
              id="t03_stichtagKm"
              min="0"
              value={data.vehicles.t03.stichtagKm}
              onChange={(e) => updateData((d) => { d.vehicles.t03.stichtagKm = e.target.value.replace(/-/g, ""); })}
            />
          </div>
          <div className="field-row">
            <label htmlFor="t03_stichtagLadekosten">⚡ Ladekosten bis Stichtag €</label>
            <input
              type="number"
              step="0.01"
              id="t03_stichtagLadekosten"
              min="0"
              value={data.vehicles.t03.stichtagLadekosten}
              onChange={(e) => updateData((d) => { d.vehicles.t03.stichtagLadekosten = e.target.value.replace(/-/g, ""); })}
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
                    min="0"
                    value={rec.betrag}
                    onChange={(e) => updateData((d) => { d.recurringCosts[idx].betrag = e.target.value.replace(/-/g, ""); })}
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
                    onClick={() => {
                      const label = [rec.anbieter, rec.zweck].filter(Boolean).join(" – ") || "diese Position";
                      if (!window.confirm(`"${label}" wirklich löschen?`)) return;
                      updateData((d) => {
                        d.recurringCosts.splice(idx, 1);
                        if (d.recurringCosts.length === 0) d.recurringCosts.push(emptyRecurring());
                      });
                    }}
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
