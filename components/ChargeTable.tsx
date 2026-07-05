"use client";

import { useState } from "react";
import { MONTHS, vehicleShortLabel } from "@/lib/constants";
import {
  durationToMinutes,
  fmtEUR,
  fmtNum,
  isEmptyRow,
  maybeAutofillPreis,
  minutesToDuration,
  monthKeyFromDate,
  monthTotals,
  parseNum,
} from "@/lib/data";
import type { AppData, ChargeRow } from "@/lib/types";
import EntryFormModal from "./EntryFormModal";
import BatteryIcon from "./BatteryIcon";

export default function ChargeTable({
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
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const rows = data.months[activeMonth] || [];
  const totals = monthTotals(data, activeMonth);
  const allMax = Math.max(1, ...MONTHS.map((m) => monthTotals(data, m.key).kwh));
  const pct = Math.round((totals.kwh / allMax) * 100);

  const visibleRows = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => !isEmptyRow(row))
    .sort((a, b) => (b.row.datum || "").localeCompare(a.row.datum || ""));

  const commitEdit = (updated: ChargeRow, sourceIdx: number) => {
    const targetMonth = monthKeyFromDate(updated.datum) ?? activeMonth;
    updateData((d) => {
      d.months[activeMonth].splice(sourceIdx, 1);
      const targetRows = d.months[targetMonth];
      const emptyIdx = targetRows.findIndex(isEmptyRow);
      if (emptyIdx !== -1) targetRows[emptyIdx] = updated;
      else targetRows.push(updated);
    });
    if (targetMonth !== activeMonth) setActiveMonth(targetMonth);
    showToast("Ladevorgang aktualisiert");
    setEditingIdx(null);
  };

  const deleteEntry = (idx: number) => {
    updateData((d) => {
      d.months[activeMonth].splice(idx, 1);
    });
    showToast("Ladevorgang gelöscht");
    setEditingIdx(null);
  };

  const editingRow = editingIdx !== null ? rows[editingIdx] : null;

  return (
    <>
      <div className="summary-row">
        <div className="stat">
          <div className="label">Geladene Energie</div>
          <div className="value">{fmtNum(totals.kwh)} kWh</div>
        </div>
        <div className="stat">
          <div className="label">Ladekosten</div>
          <div className="value">{fmtEUR(totals.preis)}</div>
        </div>
        <div className="stat">
          <div className="label">Ladezeit gesamt</div>
          <div className="value">{minutesToDuration(totals.minutes)} h</div>
        </div>
        <div className="bar-wrap">
          <div className="label">Verhältnis zu den übrigen Monaten (Juli–Dezember)</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="bar-caption">
            {fmtNum(totals.kwh)} kWh · {pct}% des bisher stärksten Monats
          </div>
        </div>
      </div>

      <div className="entry-list">
        {visibleRows.length === 0 && <div className="entry-list-empty">Keine Ladevorgänge in diesem Monat.</div>}
        {visibleRows.map(({ row, idx }) => {
          const vehicleLabel = row.fahrzeug ? vehicleShortLabel(row.fahrzeug) : "–";
          return (
            <button type="button" key={idx} className="entry-card" onClick={() => setEditingIdx(idx)}>
              <div className="entry-card-top">
                <span className="entry-date">{row.datum || "ohne Datum"}</span>
                <span className={"entry-vehicle-badge" + (row.fahrzeug ? " " + row.fahrzeug : "")}>{vehicleLabel}</span>
                {row.notiz && <span className="entry-notiz-hint">Notiz</span>}
                <span className="entry-price">{row.preis ? fmtEUR(parseNum(row.preis)) : "–"}</span>
              </div>
              <div className="entry-card-bottom">
                {row.ladestation && <span className="entry-station">{row.ladestation}</span>}
                {row.akkuVorher && <BatteryIcon percent={parseNum(row.akkuVorher)} />}
                {row.akkuVorher && row.akkuNachher && <span className="entry-battery-arrow">→</span>}
                {row.akkuNachher && <BatteryIcon percent={parseNum(row.akkuNachher)} />}
                {row.kwh && <span>{row.kwh} kWh</span>}
                {row.dauer && (
                  <span>
                    ⏳ {durationToMinutes(row.dauer)} min
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {editingRow && (
        <EntryFormModal
          title="Ladevorgang bearbeiten"
          initial={editingRow}
          data={data}
          cardOptions={data.cardsList}
          cardTarife={data.cardTarife}
          onSave={(updated) => {
            const row = { ...updated };
            maybeAutofillPreis(data.cardTarife, row);
            commitEdit(row, editingIdx!);
          }}
          onDelete={() => deleteEntry(editingIdx!)}
          onClose={() => setEditingIdx(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}
