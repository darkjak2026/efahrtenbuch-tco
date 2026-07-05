"use client";

import { useState } from "react";
import { MONTHS, VEHICLES } from "@/lib/constants";
import { emptyRow, maybeAutofillPreis } from "@/lib/data";
import { locateStation } from "@/lib/gps";
import type { AppData, ChargeRow, VehicleKey } from "@/lib/types";

function monthKeyFromDate(datum: string): string | null {
  if (!datum) return null;
  const key = datum.slice(0, 7);
  return MONTHS.some((m) => m.key === key) ? key : null;
}

export default function AddEntryFab({
  data,
  activeMonth,
  updateData,
  setActiveMonth,
  showToast,
}: {
  data: AppData;
  activeMonth: string;
  updateData: (fn: (d: AppData) => void) => void;
  setActiveMonth: (key: string) => void;
  showToast: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ChargeRow>(emptyRow());
  const [locating, setLocating] = useState(false);

  const patch = (fields: Partial<ChargeRow>) => setForm((f) => ({ ...f, ...fields }));

  const close = () => {
    setOpen(false);
    setForm(emptyRow());
  };

  const save = () => {
    const row: ChargeRow = { ...form };
    maybeAutofillPreis(data, row);
    const targetMonth = monthKeyFromDate(row.datum) ?? activeMonth;

    updateData((d) => {
      const rows = d.months[targetMonth];
      const emptyIdx = rows.findIndex(
        (r) => !r.datum && !r.fahrzeug && !r.karte && !r.ladestation && !r.kwh && !r.preis && !r.km
      );
      if (emptyIdx !== -1) rows[emptyIdx] = row;
      else rows.push(row);
    });

    if (targetMonth !== activeMonth) setActiveMonth(targetMonth);
    showToast("Ladevorgang eingetragen");
    close();
  };

  const cardOptions = data.cardsList;

  return (
    <>
      <button type="button" className="fab" title="Ladevorgang eintragen" onClick={() => setOpen(true)}>
        +
      </button>

      {open && (
        <div className="fab-overlay" onClick={close}>
          <div className="fab-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Ladevorgang eintragen</h3>

            <div className="field-row">
              <label>Datum</label>
              <input type="date" value={form.datum} onChange={(e) => patch({ datum: e.target.value })} />
            </div>
            <div className="field-row">
              <label>Fahrzeug</label>
              <select
                value={form.fahrzeug}
                onChange={(e) => patch({ fahrzeug: e.target.value as "" | VehicleKey })}
              >
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
                {cardOptions.map((c) => (
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
              <button type="button" className="btn btn-ghost" onClick={close}>
                Abbrechen
              </button>
              <button type="button" className="btn btn-primary" onClick={save}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
