"use client";

import { useRef } from "react";
import { VEHICLES } from "@/lib/constants";
import { emptyRow, fmtEUR, fmtNum, maybeAutofillPreis, minutesToDuration, monthTotals, parseNum } from "@/lib/data";
import { exportCsv, exportJson, exportPdf, exportXlsx, importJson } from "@/lib/exports";
import { locateStation } from "@/lib/gps";
import type { AppData, VehicleKey } from "@/lib/types";
import { MONTHS } from "@/lib/constants";

export default function ChargeTable({
  data,
  activeMonth,
  updateData,
  showToast,
}: {
  data: AppData;
  activeMonth: string;
  updateData: (fn: (d: AppData) => void) => void;
  showToast: (msg: string) => void;
}) {
  const importFileRef = useRef<HTMLInputElement>(null);

  const rows = data.months[activeMonth] || [];
  const totals = monthTotals(data, activeMonth);
  const allMax = Math.max(1, ...MONTHS.map((m) => monthTotals(data, m.key).kwh));
  const pct = Math.round((totals.kwh / allMax) * 100);

  const cumulative = rows.reduce<{ kwh: number; preis: number }[]>((acc, row) => {
    const prevKwh = acc.length ? acc[acc.length - 1].kwh : 0;
    const prevPreis = acc.length ? acc[acc.length - 1].preis : 0;
    acc.push({ kwh: prevKwh + parseNum(row.kwh), preis: prevPreis + parseNum(row.preis) });
    return acc;
  }, []);
  const grandTotal = cumulative.length ? cumulative[cumulative.length - 1] : { kwh: 0, preis: 0 };

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

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: 120 }}>Datum</th>
              <th style={{ width: 90 }}>Fahrzeug</th>
              <th>Ladekarte</th>
              <th style={{ width: 170 }}>Ladestation</th>
              <th style={{ width: 105 }}>Dauer</th>
              <th style={{ width: 80 }}>kWh</th>
              <th style={{ width: 100 }}>Preis €</th>
              <th style={{ width: 100 }}>km-Stand</th>
              <th style={{ width: 90 }}>kWh kum.</th>
              <th style={{ width: 110 }}>€ kum.</th>
              <th className="actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const cardOptions = data.cardsList.slice();
              if (row.karte && !cardOptions.includes(row.karte)) cardOptions.push(row.karte);

              return (
                <tr key={idx}>
                  <td data-label="Datum">
                    <input
                      type="date"
                      value={row.datum}
                      onChange={(e) => updateData((d) => { d.months[activeMonth][idx].datum = e.target.value; })}
                    />
                  </td>
                  <td data-label="Fahrzeug">
                    <select
                      value={row.fahrzeug}
                      onChange={(e) => updateData((d) => { d.months[activeMonth][idx].fahrzeug = e.target.value as "" | VehicleKey; })}
                    >
                      <option value="">–</option>
                      {Object.entries(VEHICLES).map(([val, lbl]) => (
                        <option key={val} value={val}>
                          {lbl.replace("Leapmotor ", "")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Ladekarte">
                    <select
                      value={row.karte}
                      onChange={(e) =>
                        updateData((d) => {
                          const r = d.months[activeMonth][idx];
                          r.karte = e.target.value;
                          maybeAutofillPreis(d, r);
                        })
                      }
                    >
                      <option value="">– wählen –</option>
                      {cardOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Ladestation">
                    <div className="station-cell">
                      <input
                        type="text"
                        placeholder="Name der Ladestation"
                        value={row.ladestation || ""}
                        onChange={(e) => updateData((d) => { d.months[activeMonth][idx].ladestation = e.target.value; })}
                      />
                      <button
                        type="button"
                        className="locate-btn"
                        title="Standort per GPS abrufen und Ladestation nachschlagen"
                        onClick={(e) => {
                          const btn = e.currentTarget;
                          btn.classList.add("busy");
                          btn.disabled = true;
                          locateStation(
                            row.ladestation || "",
                            (result) => {
                              btn.classList.remove("busy");
                              btn.disabled = false;
                              updateData((d) => {
                                const r = d.months[activeMonth][idx];
                                r.lat = result.lat;
                                r.lon = result.lon;
                                r.ladestation = result.ladestation;
                              });
                              showToast(result.toast);
                            },
                            (msg) => {
                              btn.classList.remove("busy");
                              btn.disabled = false;
                              showToast(msg);
                            }
                          );
                        }}
                      >
                        📍
                      </button>
                    </div>
                  </td>
                  <td data-label="Dauer">
                    <input
                      type="text"
                      placeholder="hh:mm"
                      value={row.dauer}
                      onChange={(e) => updateData((d) => { d.months[activeMonth][idx].dauer = e.target.value; })}
                    />
                  </td>
                  <td className="num" data-label="kWh">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.kwh}
                      onChange={(e) =>
                        updateData((d) => {
                          const r = d.months[activeMonth][idx];
                          r.kwh = e.target.value;
                          maybeAutofillPreis(d, r);
                        })
                      }
                    />
                  </td>
                  <td className="num" data-label="Preis €">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.preis}
                      onChange={(e) => updateData((d) => { d.months[activeMonth][idx].preis = e.target.value; })}
                    />
                  </td>
                  <td className="num" data-label="km-Stand">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="km"
                      value={row.km}
                      onChange={(e) => updateData((d) => { d.months[activeMonth][idx].km = e.target.value; })}
                    />
                  </td>
                  <td className="num" data-label="kWh kum.">
                    {fmtNum(cumulative[idx].kwh)}
                  </td>
                  <td className="num" data-label="€ kum.">
                    {fmtEUR(cumulative[idx].preis)}
                  </td>
                  <td className="actions">
                    <button
                      className="del-btn"
                      title="Zeile löschen"
                      onClick={() =>
                        updateData((d) => {
                          const list = d.months[activeMonth];
                          list.splice(idx, 1);
                          if (list.length === 0) list.push(emptyRow());
                        })
                      }
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ textAlign: "right" }}>
                Summe
              </td>
              <td>{fmtNum(grandTotal.kwh)}</td>
              <td>{fmtEUR(grandTotal.preis)}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => updateData((d) => { d.months[activeMonth].push(emptyRow()); })}>
          + Zeile hinzufügen
        </button>
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
