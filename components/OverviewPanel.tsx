"use client";

import { currentMonthKey, MONTHS, VEHICLES } from "@/lib/constants";
import { allRows, fmtEUR, fmtNum, isChargeIncomplete, monthCosts, vehicleStats } from "@/lib/data";
import type { AppData, VehicleKey } from "@/lib/types";
import type { Tab } from "./BottomNav";

// Übersicht unter dem Kopfbereich: Hinweis auf unvollständige Ladevorgänge und der
// laufende Monat kurz je Auto (antippen führt in Statistik bzw. Historie).
// v2.51.00 (Entscheidung des Urhebers 24.10.2026): je Auto die Stromkosten des Monats,
// was das Auto im Monat insgesamt gekostet hat (Laden + Fixkosten tagesgenau bis heute)
// und TCO/Alltime in €/km.
export default function OverviewPanel({ data, onGo }: { data: AppData; onGo: (t: Tab) => void }) {
  const month = currentMonthKey();
  const label = MONTHS.find((m) => m.key === month)?.label ?? month;
  const costs = monthCosts(data, month);
  const incomplete = allRows(data).filter(isChargeIncomplete).length;

  return (
    <div className="ov">
      {incomplete > 0 && (
        <button type="button" className="ov-inc" onClick={() => onGo("historie")}>
          ⚠ {incomplete} {incomplete > 1 ? "Ladevorgänge" : "Ladevorgang"} unvollständig – antippen zum Ergänzen
        </button>
      )}
      <button type="button" className="ov-month" onClick={() => onGo("statistik")}>
        <span className="ov-month-t">
          {label} {month.slice(0, 4)} bisher <span>Statistik ▸</span>
        </span>
        <span className="ov-cols">
          {(["b10", "t03"] as VehicleKey[]).map((v) => {
            const c = costs.perVehicle[v];
            const s = vehicleStats(data, v);
            const alltime = s.kmGefahren > 0 ? s.tco / s.kmGefahren : null;
            return (
              <span key={v} className={`ov-car ov-car-${v}`}>
                <b>{VEHICLES[v].nickname}</b>
                <span className="ov-zeile">
                  <small>Stromkosten</small>
                  <span className="ov-wert">{fmtEUR(c.laden)}</span>
                </span>
                <span className="ov-zeile ov-zeile-gesamt">
                  <small>Insgesamt (Stromkosten + Fixkosten)</small>
                  <span className="ov-wert">{fmtEUR(c.gesamt)}</span>
                </span>
                <span className="ov-zeile">
                  <small>TCO/Alltime</small>
                  <span className="ov-wert">{alltime === null ? "–" : `${fmtNum(alltime, 2)} €/km`}</span>
                </span>
                <span className="ov-line">
                  {c.km === null ? "–" : fmtNum(c.km, 0)} km im {label}
                </span>
              </span>
            );
          })}
        </span>
        <span className="ov-hinweis">Fixkosten = Leasing, Versicherung, Abos und Investitionsraten, anteilig bis heute</span>
      </button>
    </div>
  );
}
