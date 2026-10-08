"use client";

import { useRef, useState } from "react";
import { shiftMonth, todayStr, vehicleShortLabel } from "@/lib/constants";
import {
  completionMessage,
  durationToMinutes,
  fmtEUR,
  hasNachValues,
  isChargeIncomplete,
  isEmptyRow,
  ladeStand,
  maybeAutofillPreis,
  minutesToDuration,
  monthWeeks,
  type MonthWeek,
  monthKeyFromDate,
  monthTotals,
  parseNum,
  reichweiteColorClass,
  rowKmDriven,
  visibleMonths,
  weekSums,
  fmtNum,
} from "@/lib/data";
import type { AppData, ChargeRow, VehicleKey } from "@/lib/types";
import ConfettiBurst from "./ConfettiBurst";
import DayRing from "./DayRing";
import EntryFormModal from "./EntryFormModal";
import { HouseholdMonthSummary, VehicleMonthCard } from "./MonthVehicleCards";

const VEHICLE_ORDER: VehicleKey[] = ["b10", "t03"];
const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// "2026-10-05", "2026-10-11" -> "05.–11.10."; across months "28.09.–04.10." does not occur
// (weeks are cut at the month border), so day–day plus the month is enough.
const shortRange = (from: string, to: string) => `${from.slice(8, 10)}.–${to.slice(8, 10)}.${to.slice(5, 7)}.`;

type WeekSegment =
  | { kind: "week"; w: MonthWeek; nr: number }
  | { kind: "empty"; weeks: MonthWeek[]; future: boolean };

// Empty weeks (no charge of this vehicle) collapse into one slim tile per run -
// future ones as "Wochen liegen in der Zukunft", past ones as "keine Ladevorgänge". The current
// week always stays a full tile. nr = Woche im Monat (1 = die Woche mit dem 1.).
function weekSegments(weeks: MonthWeek[], own: { row: ChargeRow }[], today: string): WeekSegment[] {
  const out: WeekSegment[] = [];
  weeks.forEach((w, i) => {
    const nr = weeks.length - i; // weeks are newest first
    const isCurrent = today >= w.from && today <= w.to;
    const empty = !own.some(({ row }) => row.datum >= w.from && row.datum <= w.to);
    if (empty && !isCurrent) {
      const future = w.from > today;
      const last = out[out.length - 1];
      if (last && last.kind === "empty" && last.future === future) last.weeks.push(w);
      else out.push({ kind: "empty", weeks: [w], future });
    } else {
      out.push({ kind: "week", w, nr });
    }
  });
  return out;
}

// The seven dates (Mo–So) of the week starting at `monday`.
function weekDays(monday: string): string[] {
  const [y, m, d] = monday.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(y, m - 1, d + i);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
}

export default function ChargeTable({
  data,
  activeMonth,
  updateData,
  setActiveMonth,
  showToast,
  celebrateRow,
  onEntryCompleted,
  mode = "all",
}: {
  data: AppData;
  activeMonth: string;
  updateData: (fn: (d: AppData) => void) => void;
  setActiveMonth: (key: string) => void;
  showToast: (msg: string) => void;
  celebrateRow: ChargeRow | null;
  onEntryCompleted: (row: ChargeRow) => void;
  // Menü: "stats" = Monatskarten + Haushalt (Statistik), "history" = Wochen + Ladevorgänge (Historie)
  mode?: "all" | "stats" | "history";
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});

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

  // Wochengliederung (Variante D, Mockup vom 08.10.2026): Kalenderwochen Mo–So,
  // neueste zuerst; die aktuelle Woche ist offen, bis man sie zuklappt.
  const weeks = monthWeeks(activeMonth);
  const today = todayStr();
  const isWeekOpen = (v: VehicleKey, kw: number, isCurrent: boolean) => openWeeks[`${activeMonth}:${v}:${kw}`] ?? isCurrent;
  const toggleWeek = (v: VehicleKey, kw: number, open: boolean) =>
    setOpenWeeks((o) => ({ ...o, [`${activeMonth}:${v}:${kw}`]: !open }));

  return (
    <>
      <div className="hist-columns" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {VEHICLE_ORDER.map((v) => {
          const own = visibleRows.filter(({ row }) => row.fahrzeug === v);
          const undated = own.filter(({ row }) => !row.datum.startsWith(activeMonth));
          return (
            <div className={`hist-col hist-col-${v}`} key={v}>
              {mode !== "history" && <VehicleMonthCard data={data} monthKey={activeMonth} vehicle={v} />}
              {mode !== "stats" && (
              <div className="wk-list">
                {weekSegments(weeks, own, today).map((seg) => {
                  if (seg.kind === "empty") {
                    return (
                      <div className={"wk-empty" + (seg.future ? " wk-empty-future" : "")} key={seg.weeks.map((w) => w.kw).join("-")}>
                        ({[...seg.weeks].reverse().map((w) => `KW ${w.kw}`).join(" | ")})
                        <span>
                          {seg.future
                            ? seg.weeks.length > 1
                              ? "Wochen liegen in der Zukunft"
                              : "Woche liegt in der Zukunft"
                            : "keine Ladevorgänge"}
                        </span>
                      </div>
                    );
                  }
                  const { w, nr } = seg;
                  const inWeek = own.filter(({ row }) => row.datum >= w.from && row.datum <= w.to);
                  const sums = weekSums(data, inWeek.map(({ row }) => row));
                  const isCurrent = today >= w.from && today <= w.to;
                  const open = isWeekOpen(v, w.kw, isCurrent);
                  return (
                    <div className={"wk" + (isCurrent ? " wk-cur" : "")} key={w.kw}>
                      <button type="button" className="wk-h" aria-expanded={open} onClick={() => toggleWeek(v, w.kw, open)}>
                        <span className="wk-t">
                          <span className="wk-chev">{open ? "▾" : "▸"}</span>
                          {w.from <= today && (
                            <span className="wk-nr" title={`${nr}. Woche im Monat`}>
                              {nr}. Woche
                            </span>
                          )}
                          (KW {w.kw}) · {shortRange(w.from, w.to)}
                          {isCurrent && <span className="wk-now">jetzt</span>}
                        </span>
                        <span className="wk-v">
                          {inWeek.length === 0 ? (
                            "keine Ladevorgänge"
                          ) : (
                            <>
                              {minutesToDuration(sums.minutes)}h<i>|</i>
                              {fmtNum(sums.km, 0)}km<i>|</i>
                              <b>{fmtNum(sums.eur, 2)}€</b>
                              <i>|</i>
                              {fmtNum(sums.kwh, 0)}kWh
                            </>
                          )}
                        </span>
                        <span className="wk-days" aria-hidden="true">
                          {weekDays(w.monday).map((day, i) => {
                            const amTag = own.filter(({ row }) => row.datum === day);
                            const n = amTag.length;
                            return (
                              <span className="wk-day" key={day}>
                                {WEEKDAY_LABELS[i]}
                                <DayRing
                                  staende={amTag.map(({ row }) => ladeStand(data, row))}
                                  count={n}
                                  className={
                                    "wk-dot" +
                                    (n ? " on" : "") +
                                    (day.startsWith(activeMonth) ? "" : " out") +
                                    (day === today ? " today" : "")
                                  }
                                />
                              </span>
                            );
                          })}
                        </span>
                      </button>
                      {open && (
                        <div className="entry-list wk-body">
                          {inWeek.length === 0 ? (
                            <div className="entry-list-empty">Keine Ladevorgänge in dieser Woche.</div>
                          ) : (
                            inWeek.map((e) => renderEntry(e, true))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {undated.length > 0 && (
                  <div className="entry-list">
                    <div className="hist-unassigned-title">Ohne Datum</div>
                    {undated.map((e) => renderEntry(e, true))}
                  </div>
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>

      {mode !== "stats" && unassigned.length > 0 && (
        <div className="entry-list hist-unassigned">
          <div className="hist-unassigned-title">Ohne Fahrzeug</div>
          {unassigned.map((e) => renderEntry(e, false))}
        </div>
      )}

      {mode !== "history" && (
        <HouseholdMonthSummary data={data} monthKey={activeMonth} monthLabel={activeMonthLabel} pct={pct} />
      )}

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
