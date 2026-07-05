"use client";

import { useState } from "react";
import { VEHICLES } from "@/lib/constants";
import { allRows, durationToMinutes, maybeAutofillPreis, minutesToDuration, parseNum } from "@/lib/data";
import { locateStation } from "@/lib/gps";
import type { AppData, ChargeRow, VehicleKey } from "@/lib/types";
import BatteryIcon from "./BatteryIcon";

const HINT_ICONS = ["⚡", "🔌", "🚗", "🔋", "🛣️"];

export default function EntryFormModal({
  title,
  initial,
  data,
  cardOptions,
  cardTarife,
  onSave,
  onDelete,
  onClose,
  showToast,
}: {
  title: string;
  initial: ChargeRow;
  data: AppData;
  cardOptions: string[];
  cardTarife: Record<string, string | number>;
  onSave: (row: ChargeRow) => void;
  onDelete?: () => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const [form, setForm] = useState<ChargeRow>(initial);
  const [locating, setLocating] = useState(false);
  const [hintIcon] = useState(() => HINT_ICONS[Math.floor(Math.random() * HINT_ICONS.length)]);

  const patch = (fields: Partial<ChargeRow>) => setForm((f) => ({ ...f, ...fields }));

  // Only run the tariff-based price suggestion on a discrete selection (Ladekarte)
  // or once the kWh field is left (onBlur) — never on every keystroke, or a
  // half-typed kWh value (e.g. the "1" in "12.5") would freeze in a wrong price.
  const patchWithAutofill = (fields: Partial<ChargeRow>) =>
    setForm((f) => {
      const next = { ...f, ...fields };
      maybeAutofillPreis(cardTarife, next);
      return next;
    });

  const options = cardOptions.includes(form.karte) || !form.karte ? cardOptions : [...cardOptions, form.karte];

  // Last known odometer reading for the selected vehicle, excluding this very entry
  // (relevant when editing — `initial` is the actual row object from `data`).
  const lastKnownKm = (() => {
    if (!form.fahrzeug) return null;
    const candidates = allRows(data)
      .filter((r) => r.fahrzeug === form.fahrzeug && r !== initial && r.datum && parseNum(r.km) > 0)
      .sort((a, b) => b.datum.localeCompare(a.datum));
    return candidates.length ? parseNum(candidates[0].km) : null;
  })();

  const totalMinutes = durationToMinutes(form.dauer);
  const durHours = Math.floor(totalMinutes / 60);
  const durMinutes = totalMinutes % 60;
  const setDuration = (hours: number, minutes: number) => patch({ dauer: minutesToDuration(hours * 60 + minutes) });

  return (
    <div className="fab-overlay" onClick={onClose}>
      <div className="fab-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>

        <div className="field-row">
          <label>📅 Datum</label>
          <input type="date" value={form.datum} onChange={(e) => patch({ datum: e.target.value })} />
        </div>
        <div className="field-row">
          <label>🚗 Fahrzeug</label>
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
          <label>💳 Ladekarte</label>
          <select value={form.karte} onChange={(e) => patchWithAutofill({ karte: e.target.value })}>
            <option value="">– wählen –</option>
            {options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label>🔌 Ladestation</label>
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
        <div className="field-row slider-row">
          <label>🔋 Akku vorher</label>
          <div className="slider-wrap">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={form.akkuVorher || 0}
              onChange={(e) => patch({ akkuVorher: e.target.value })}
            />
            <span className="slider-value">
              <BatteryIcon percent={parseNum(form.akkuVorher)} />
            </span>
          </div>
        </div>
        <div className="field-row slider-row">
          <label>🔋 Akku nachher</label>
          <div className="slider-wrap">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={form.akkuNachher || 0}
              onChange={(e) => patch({ akkuNachher: e.target.value })}
            />
            <span className="slider-value">
              <BatteryIcon percent={parseNum(form.akkuNachher)} />
            </span>
          </div>
        </div>
        <div className="field-row">
          <label>⏱️ Dauer</label>
          <div className="duration-wheels">
            <select value={durHours} onChange={(e) => setDuration(Number(e.target.value), durMinutes)}>
              {Array.from({ length: 100 }, (_, i) => (
                <option key={i} value={i}>
                  {i} h
                </option>
              ))}
            </select>
            <select value={durMinutes} onChange={(e) => setDuration(durHours, Number(e.target.value))}>
              {Array.from({ length: 60 }, (_, i) => (
                <option key={i} value={i}>
                  {i} min
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <label>⚡ kWh</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.kwh}
            onChange={(e) => patch({ kwh: e.target.value })}
            onBlur={() => patchWithAutofill({})}
          />
        </div>
        <div className="field-row">
          <label>💶 Preis €</label>
          <input type="number" step="0.01" min="0" value={form.preis} onChange={(e) => patch({ preis: e.target.value })} />
        </div>
        <div className="field-row">
          <label>🛣️ km-Stand</label>
          <input type="number" step="1" min="0" placeholder="km" value={form.km} onChange={(e) => patch({ km: e.target.value })} />
        </div>
        {lastKnownKm !== null && (
          <div className="field-hint">
            <span className="field-hint-text">
              der {VEHICLES[form.fahrzeug as VehicleKey].replace("Leapmotor ", "")} wurde zuletzt bei einem ODO von{" "}
              {lastKnownKm} geladen
            </span>
            <span className="field-hint-icon">{hintIcon}</span>
          </div>
        )}
        <div className="field-row">
          <label>📝 Notiz</label>
          <input
            type="text"
            className="notiz-input"
            maxLength={500}
            placeholder="Optionale Notiz"
            value={form.notiz}
            onChange={(e) => patch({ notiz: e.target.value })}
          />
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
