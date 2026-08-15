"use client";

import { useState } from "react";
import { MONTHS, vehicleShortLabel } from "@/lib/constants";
import {
  completionMessage,
  durationToMinutes,
  fmtEUR,
  fmtNum,
  hasNachValues,
  isChargeIncomplete,
  isEmptyRow,
  maybeAutofillPreis,
  minutesToDuration,
  monthKeyFromDate,
  monthTotals,
  parseNum,
  reichweiteColorClass,
} from "@/lib/data";
import type { AppData, ChargeRow } from "@/lib/types";
import ConfettiBurst from "./ConfettiBurst";
import EntryFormModal from "./EntryFormModal";

export default function ChargeTable({
  data,
  activeMonth,
  updateData,
  setActiveMonth,
  showToast,
  celebrateRow,
  onEntryCompleted,
}: {
  data: AppData;
  activeMonth: string;
  updateData: (fn: (d: AppData) => void) => void;
  setActiveMonth: (key: string) => void;
  showToast: (msg: string) => void;
  celebrateRow: ChargeRow | null;
  onEntryCompleted: (row: ChargeRow) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const rows = data.months[activeMonth] || [];
  const totals = monthTotals(data, activeMonth);
  const allMax = Math.max(1, ...MONTHS.map((m) => monthTotals(data, m.key).kwh));
  const pct = Math.round((totals.kwh / allMax) * 100);
  const activeMonthLabel = MONTHS.find((m) => m.key === activeMonth)?.label ?? activeMonth;

  const visibleRows = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => !isEmptyRow(row))
    .sort((a, b) => (b.row.datum || "").localeCompare(a.row.datum || ""));

  const commitEdit = (updated: ChargeRow, sourceIdx: number, message = "Ladevorgang aktualisiert") => {
    const targetMonth = monthKeyFromDate(updated.datum) ?? activeMonth;
    updateData((d) => {
      d.months[activeMonth].splice(sourceIdx, 1);
      const targetRows = d.months[targetMonth];
      const emptyIdx = targetRows.findIndex(isEmptyRow);
      if (emptyIdx !== -1) targetRows[emptyIdx] = updated;
      else targetRows.push(updated);
    });
    if (targetMonth !== activeMonth) setActiveMonth(targetMonth);
    showToast(message);
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
          <div className="label">{activeMonthLabel} im Verhältnis zu den anderen Monaten</div>
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
          const incomplete = isChargeIncomplete(row);
          const justCompleted = row === celebrateRow;
          return (
            <button
              type="button"
              key={idx}
              className={
                "entry-card" +
                (incomplete ? " entry-card-incomplete" : "") +
                (justCompleted ? " entry-card-just-completed" : "")
              }
              onClick={() => setEditingIdx(idx)}
            >
              {justCompleted && <ConfettiBurst />}
              <div className="entry-card-top">
                <span className="entry-date">{row.datum || "ohne Datum"}</span>
                <span className={"entry-vehicle-badge" + (row.fahrzeug ? " " + row.fahrzeug : "")}>{vehicleLabel}</span>
                {incomplete && <span className="entry-badge-incomplete">unvollständig</span>}
                {row.notiz && <span className="entry-notiz-hint">Notiz</span>}
                <span className="entry-price">{row.preis ? fmtEUR(parseNum(row.preis)) : "–"}</span>
              </div>
              {row.ladestation && (
                <div className="entry-card-station">
                  <span className="entry-station">{row.ladestation}</span>
                </div>
              )}
              <div className="entry-card-bottom">
                {row.reichweiteVorher && (
                  <span className={reichweiteColorClass(row.reichweiteVorher)}>{row.reichweiteVorher} km</span>
                )}
                {row.reichweiteVorher && row.reichweiteNachher && <span className="entry-battery-arrow">→</span>}
                {row.reichweiteNachher && (
                  <span className={reichweiteColorClass(row.reichweiteNachher)}>{row.reichweiteNachher} km</span>
                )}
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
          initial={editingRow}
          data={data}
          cardOptions={data.cardsList}
          defaultSection={isChargeIncomplete(editingRow) ? "nach" : "vor"}
          onSave={(updated) => {
            const row = { ...updated };
            maybeAutofillPreis(row);
            const justCompleted = !hasNachValues(editingRow) && hasNachValues(row);
            commitEdit(row, editingIdx!, justCompleted ? completionMessage() : undefined);
            if (justCompleted) onEntryCompleted(row);
          }}
          onDelete={() => deleteEntry(editingIdx!)}
          onClose={() => setEditingIdx(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}
