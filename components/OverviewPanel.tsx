"use client";

import { currentMonthKey, MONTHS, VEHICLES } from "@/lib/constants";
import { allRows, fmtEUR, fmtNum, isChargeIncomplete, monthCosts } from "@/lib/data";
import type { AppData, VehicleKey } from "@/lib/types";
import type { Tab } from "./BottomNav";

// Übersicht unter dem Kopfbereich: Hinweis auf unvollständige Ladevorgänge und der
// laufende Monat kurz je Auto (antippen führt in Statistik bzw. Historie).
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
            return (
              <span key={v} className={`ov-car ov-car-${v}`}>
                <b>{VEHICLES[v].nickname}</b>
                <span className="ov-big">{c.tcoKm === null ? "–" : `${fmtNum(c.tcoKm, 3)} €/km`}</span>
                <small>TCO im {label}</small>
                <span className="ov-line">
                  Bisher <b className="ov-nw">{c.km === null ? "–" : fmtNum(c.km, 0)} km</b> im {label} gefahren
                </span>
                <span className="ov-line">
                  Ladekosten bisher <b className="ov-nw">{fmtEUR(c.laden)}</b>
                </span>
              </span>
            );
          })}
        </span>
      </button>
    </div>
  );
}
