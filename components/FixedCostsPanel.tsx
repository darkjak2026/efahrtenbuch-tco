"use client";

import { useState } from "react";
import { emptyInvest, emptyRecurring, fmtEUR, parseNum } from "@/lib/data";
import { VEHICLES, vehicleShortLabel } from "@/lib/constants";
import { cardBadge } from "@/lib/cardBadge";
import type { AppData, VehicleKey } from "@/lib/types";

const FAHRZEUG_OPTIONS: Array<["" | VehicleKey, string]> = [
  ["", "Haushalt"],
  ["b10", vehicleShortLabel("b10")],
  ["t03", vehicleShortLabel("t03")],
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
  const [newCardName, setNewCardName] = useState("");

  return (
    <div className="fixed-grid">
      <div className="fixed-box">
        <h3>
          <VehicleHeading vehicleKey="b10" />
        </h3>
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
      </div>

      <div className="fixed-box">
        <h3>
          <VehicleHeading vehicleKey="t03" />
        </h3>
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
      </div>

      <div className="fixed-box" style={{ gridColumn: "1 / -1" }}>
        <h3>💳 Ladekarten &amp; Tarife verwalten</h3>
        <div className="card-chip-list">
          {data.cardsList.map((c) => {
            const badge = cardBadge(c);
            return (
              <div className="card-chip-v2" key={c}>
                <span className="card-badge" style={{ background: badge.color }}>
                  {badge.label}
                </span>
                <span className="card-chip-name">{c}</span>
                <span className="tarif-input-wrap">
                  <input
                    type="number"
                    step="0.01"
                    title="Optionaler Tarif in €/kWh für automatische Preisvorschläge"
                    value={data.cardTarife[c] ?? ""}
                    onChange={(e) => updateData((d) => { d.cardTarife[c] = e.target.value; })}
                  />
                  <span className="unit-suffix">€/kWh</span>
                </span>
                <button
                  type="button"
                  className="mini-del"
                  title="Karte entfernen"
                  onClick={() =>
                    updateData((d) => {
                      d.cardsList = d.cardsList.filter((x) => x !== c);
                      delete d.cardTarife[c];
                    })
                  }
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <div className="add-card-row">
          <input
            type="text"
            value={newCardName}
            onChange={(e) => setNewCardName(e.target.value)}
            placeholder="Neue Karte / Lademöglichkeit, z.B. Wallbox zuhause"
          />
          <button
            type="button"
            className="add-mini"
            onClick={() => {
              const name = newCardName.trim();
              if (!name) return;
              updateData((d) => {
                if (!d.cardsList.includes(name)) d.cardsList.push(name);
              });
              setNewCardName("");
            }}
          >
            + hinzufügen
          </button>
        </div>
        <p className="hint">
          Optionaler €/kWh-Tarif pro Karte (z.B. für &quot;Zuhause&quot;): wird beim Ausfüllen einer Ladezeile
          automatisch als Preisvorschlag genutzt, sobald kWh eingetragen ist und das Preisfeld noch leer ist —
          überschreibt nie einen bereits eingetragenen Preis.
        </p>
      </div>

      <div className="fixed-box" style={{ gridColumn: "1 / -1" }}>
        <h3>🔁 Wiederkehrende Kosten (Abos, Stromtarif-Grundgebühr, Apps, finanzierte Wallbox, …)</h3>
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
                  onChange={(e) => updateData((d) => { d.recurringCosts[idx].fahrzeug = e.target.value as "" | VehicleKey; })}
                >
                  {FAHRZEUG_OPTIONS.map(([val, lbl]) => (
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
      </div>

      <div className="fixed-box" style={{ gridColumn: "1 / -1" }}>
        <h3>🧰 Investitionen / Ausstattung (Einmalkosten, z.B. Wallbox-Kauf)</h3>
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
      </div>
    </div>
  );
}
