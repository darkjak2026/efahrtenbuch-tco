"use client";

import { useState } from "react";
import { VEHICLES } from "@/lib/constants";
import { locateStation } from "@/lib/gps";
import type { ChargeRow, VehicleKey } from "@/lib/types";

export default function EntryFormModal({
  title,
  initial,
  cardOptions,
  onSave,
  onDelete,
  onClose,
  showToast,
}: {
  title: string;
  initial: ChargeRow;
  cardOptions: string[];
  onSave: (row: ChargeRow) => void;
  onDelete?: () => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const [form, setForm] = useState<ChargeRow>(initial);
  const [locating, setLocating] = useState(false);

  const patch = (fields: Partial<ChargeRow>) => setForm((f) => ({ ...f, ...fields }));

  const options = cardOptions.includes(form.karte) || !form.karte ? cardOptions : [...cardOptions, form.karte];

  return (
    <div className="fab-overlay" onClick={onClose}>
      <div className="fab-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>

        <div className="field-row">
          <label>Datum</label>
          <input type="date" value={form.datum} onChange={(e) => patch({ datum: e.target.value })} />
        </div>
        <div className="field-row">
          <label>Fahrzeug</label>
          <select value={form.fahrzeug} onChange={(e) => patch({ fahrzeug: e.target.value as "" | VehicleKey })}>
            <option value="">–</option>
            {Object.entries(VEHICLES).map(([val, lbl]) => (
              <option key={val} value={val}>
                {lbl.replace("Leapmotor ", "")}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label>Ladekarte</label>
          <select value={form.karte} onChange={(e) => patch({ karte: e.target.value })}>
            <option value="">– wählen –</option>
            {options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label>Ladestation</label>
          <div className="station-cell">
            <input
              type="text"
              placeholder="Name der Ladestation"
              value={form.ladestation}
              onChange={(e) => patch({ ladestation: e.target.value })}
            />
            <button
              type="button"
              className={"locate-btn" + (locating ? " busy" : "")}
              title="Standort per GPS abrufen und Ladestation nachschlagen"
              disabled={locating}
              onClick={() => {
                setLocating(true);
                locateStation(
                  form.ladestation,
                  (result) => {
                    setLocating(false);
                    patch({ lat: result.lat, lon: result.lon, ladestation: result.ladestation });
                    showToast(result.toast);
                  },
                  (msg) => {
                    setLocating(false);
                    showToast(msg);
                  }
                );
              }}
            >
              📍
            </button>
          </div>
        </div>
        <div className="field-row">
          <label>Akku % vorher</label>
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            placeholder="%"
            value={form.akkuVorher}
            onChange={(e) => patch({ akkuVorher: e.target.value })}
          />
        </div>
        <div className="field-row">
          <label>Akku % nachher</label>
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            placeholder="%"
            value={form.akkuNachher}
            onChange={(e) => patch({ akkuNachher: e.target.value })}
          />
        </div>
        <div className="field-row">
          <label>Dauer (hh:mm)</label>
          <input type="text" placeholder="hh:mm" value={form.dauer} onChange={(e) => patch({ dauer: e.target.value })} />
        </div>
        <div className="field-row">
          <label>kWh</label>
          <input type="number" step="0.01" min="0" value={form.kwh} onChange={(e) => patch({ kwh: e.target.value })} />
        </div>
        <div className="field-row">
          <label>Preis €</label>
          <input type="number" step="0.01" min="0" value={form.preis} onChange={(e) => patch({ preis: e.target.value })} />
        </div>
        <div className="field-row">
          <label>km-Stand</label>
          <input type="number" step="1" min="0" placeholder="km" value={form.km} onChange={(e) => patch({ km: e.target.value })} />
        </div>

        <div className="fab-modal-actions">
          {onDelete && (
            <button type="button" className="btn btn-ghost fab-delete" onClick={onDelete}>
              Löschen
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(form)}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
