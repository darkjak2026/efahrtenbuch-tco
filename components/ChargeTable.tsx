"use client";

import { useRef, useState } from "react";
import { VEHICLES, MONTHS } from "@/lib/constants";
import { fmtEUR, fmtNum, isEmptyRow, maybeAutofillPreis, minutesToDuration, monthKeyFromDate, monthTotals, parseNum } from "@/lib/data";
import { exportCsv, exportJson, exportPdf, exportXlsx, importJson } from "@/lib/exports";
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
  const importFileRef = useRef<HTMLInputElement>(null);
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
          const vehicleLabel = row.fahrzeug ? VEHICLES[row.fahrzeug].replace("Leapmotor ", "") : "–";
          return (
            <button type="button" key={idx} className="entry-card" onClick={() => setEditingIdx(idx)}>
              <div className="entry-card-top">
                <span className="entry-date">{row.datum || "ohne Datum"}</span>
                <span className={"entry-vehicle-badge" + (row.fahrzeug ? " " + row.fahrzeug : "")}>{vehicleLabel}</span>
                <span className="entry-price">{row.preis ? fmtEUR(parseNum(row.preis)) : "–"}</span>
              </div>
              <div className="entry-card-bottom">
                {row.ladestation && <span className="entry-station">{row.ladestation}</span>}
                {row.akkuVorher && (
                  <span className="entry-battery">
                    <BatteryIcon percent={parseNum(row.akkuVorher)} /> {row.akkuVorher}%
                  </span>
                )}
                {row.akkuNachher && (
                  <span className="entry-battery">
                    <BatteryIcon percent={parseNum(row.akkuNachher)} /> {row.akkuNachher}%
                  </span>
                )}
                {row.kwh && <span>{row.kwh} kWh</span>}
                {row.dauer && <span>{row.dauer} h</span>}
              </div>
            </button>
          );
        })}
      </div>

      {editingRow && (
        <EntryFormModal
          title="Ladevorgang bearbeiten"
          initial={editingRow}
          cardOptions={data.cardsList}
          onSave={(updated) => {
            const row = { ...updated };
            maybeAutofillPreis(data, row);
            commitEdit(row, editingIdx!);
          }}
          onDelete={() => deleteEntry(editingIdx!)}
          onClose={() => setEditingIdx(null)}
          showToast={showToast}
        />
      )}

      <div className="toolbar" style={{ justifyContent: "flex-end" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              exportCsv(data, activeMonth);
              showToast("CSV exportiert");
            }}
          >
            CSV (Monat)
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              const ok = exportPdf(data, activeMonth);
              showToast(ok ? "PDF erzeugt" : "PDF-Bibliothek konnte nicht geladen werden (Internetverbindung prüfen)");
            }}
          >
            📄 Kontenübersicht (PDF)
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              const ok = exportXlsx(data);
              showToast(ok ? "Excel-Datei erzeugt" : "Excel-Bibliothek konnte nicht geladen werden (Internetverbindung prüfen)");
            }}
          >
            📊 Gesamtexport (Excel)
          </button>
        </div>
      </div>

      <div className="io-bar">
        <button
          className="btn btn-ghost"
          onClick={() => {
            exportJson(data);
            showToast("Sicherung heruntergeladen");
          }}
        >
          Alle Daten sichern (JSON)
        </button>
        <button className="btn btn-ghost" onClick={() => importFileRef.current?.click()}>
          Sicherung einlesen
        </button>
        <input
          type="file"
          id="importFile"
          accept="application/json"
          ref={importFileRef}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const imported = await importJson(file);
              updateData((d) => Object.assign(d, imported));
              showToast("Sicherung eingelesen");
            } catch {
              showToast("Datei konnte nicht gelesen werden");
            }
            e.target.value = "";
          }}
        />
        <p className="io-note">
          Alle Eingaben (Ladeprotokoll, Fixkosten, Ladekarten, wiederkehrende Kosten, Investitionen) werden online
          gespeichert. Zusätzlich lässt sich hier jederzeit eine JSON-Sicherung als Notfall-Kopie herunterladen.
        </p>
      </div>
    </>
  );
}
