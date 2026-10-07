"use client";

import { useRef, useState } from "react";
import { shiftMonth, vehicleShortLabel } from "@/lib/constants";
import {
  completionMessage,
  durationToMinutes,
  fmtEUR,
  hasNachValues,
  isChargeIncomplete,
  isEmptyRow,
  maybeAutofillPreis,
  monthKeyFromDate,
  monthTotals,
  parseNum,
  reichweiteColorClass,
  rowKmDriven,
  visibleMonths,
} from "@/lib/data";
import type { AppData, ChargeRow, VehicleKey } from "@/lib/types";
import ConfettiBurst from "./ConfettiBurst";
import EntryFormModal from "./EntryFormModal";
import { HouseholdMonthSummary, VehicleMonthCard } from "./MonthVehicleCards";

const VEHICLE_ORDER: VehicleKey[] = ["b10", "t03"];

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
  const MONTHS = visibleMonths(data);
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

  // In a vehicle column the badge is implied by the column itself; only
  // entries without a vehicle (full-width list below) still show one.
  const renderEntry = ({ row, idx }: { row: ChargeRow; idx: number }, inColumn: boolean) => {
    const vehicleLabel = row.fahrzeug ? vehicleShortLabel(row.fahrzeug) : "–";
    const incomplete = isChargeIncomplete(row);
    const justCompleted = row === celebrateRow;
    const kmDriven = rowKmDriven(data, row);
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
          {!inColumn && (
            <span className={"entry-vehicle-badge" + (row.fahrzeug ? " " + row.fahrzeug : "")}>{vehicleLabel}</span>
          )}
          {incomplete && <span className="entry-badge-incomplete">unvollständig</span>}
          {row.notiz && <span className="entry-notiz-hint">Notiz</span>}
          <span className="entry-price">{row.preis ? fmtEUR(parseNum(row.preis)) : "–"}</span>
        </div>
        {row.km && (
          <div className="entry-card-km">
            <span className="entry-card-odo">ODO {parseNum(row.km)} km</span>
            {kmDriven !== null && (
            <span className="entry-card-driven">{inColumn ? `+${kmDriven} km` : `${kmDriven} km seit letztem Laden`}</span>
          )}
          </div>
        )}
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
  };

  // Wischen über die Spalten wechselt den Monat (wie in Wochenstimme).
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t0 = touch.current;
    touch.current = null;
    if (!t0) return;
    const dx = e.changedTouches[0].clientX - t0.x;
    const dy = e.changedTouches[0].clientY - t0.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      const next = shiftMonth(activeMonth, dx < 0 ? 1 : -1, MONTHS);
      if (next) setActiveMonth(next);
    }
  };

  const unassigned = visibleRows.filter(({ row }) => !row.fahrzeug);

  return (
    <>
      <div className="hist-columns" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {VEHICLE_ORDER.map((v) => {
          const own = visibleRows.filter(({ row }) => row.fahrzeug === v);
          return (
            <div className={`hist-col hist-col-${v}`} key={v}>
              <VehicleMonthCard data={data} monthKey={activeMonth} vehicle={v} />
              <div className="entry-list">
                {own.length === 0 && <div className="entry-list-empty">Keine Ladevorgänge.</div>}
                {own.map((e) => renderEntry(e, true))}
              </div>
            </div>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="entry-list hist-unassigned">
          <div className="hist-unassigned-title">Ohne Fahrzeug</div>
          {unassigned.map((e) => renderEntry(e, false))}
        </div>
      )}

      <HouseholdMonthSummary data={data} monthKey={activeMonth} monthLabel={activeMonthLabel} pct={pct} />

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
