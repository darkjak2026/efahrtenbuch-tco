"use client";

import { currentMonthKey, MONTHS, VEHICLES } from "@/lib/constants";
import { allRows, fmtEUR, fmtNum, isChargeIncomplete, monthCosts } from "@/lib/data";
import type { AppData, VehicleKey } from "@/lib/types";
import type { Tab } from "./BottomNav";

// Übersicht unter dem Kopfbereich: Hinweis auf unvollständige Ladevorgänge und der
// laufende Monat kurz je Auto (antippen führt in Statistik bzw. Historie).
// v2.51.00 (Entscheidung des Urhebers 24.10.2026): je Auto die Stromkosten des Monats,
// was das Auto im Monat insgesamt gekostet hat (Stromkosten + Fixkosten, seit v2.53.00
// voll je angefangenem Monat). TCO/Alltime steht nur oben in der Kachel (v2.52.02).
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
          <span className="ov-monat">
            <b>{label}</b> {month.slice(0, 4)} bisher
          </span>
          <span>Statistik ▸</span>
        </span>
        <span className="ov-cols">
          {(["b10", "t03"] as VehicleKey[]).map((v) => {
            const c = costs.perVehicle[v];
            return (
              <span key={v} className={`ov-car ov-car-${v}`}>
                <b>{VEHICLES[v].nickname}</b>
                <span className="ov-zeile">
                  <small>Stromkosten</small>
                  <span className="ov-wert">{fmtEUR(c.laden)}</span>
                </span>
                {/* v2.54.00: was abgebucht wird getrennt von schon bezahlten Anschaffungen */}
                <span className="ov-zeile">
                  <small>Laufend</small>
                  <span className="ov-wert">{fmtEUR(c.leasing + c.versicherung + c.abos)}</span>
                </span>
                <span className="ov-zeile">
                  <small>Anschaffungen</small>
                  <span className="ov-wert">{fmtEUR(c.invest)}</span>
                </span>
                <span className="ov-zeile ov-zeile-gesamt">
                  <small>Strom+Fixkosten</small>
                  <span className="ov-wert">{fmtEUR(c.gesamt)}</span>
                </span>
                <span className="ov-line">
                  {c.km === null ? "–" : fmtNum(c.km, 0)} km im {label}
                </span>
              </span>
            );
          })}
        </span>
        <span className="ov-hinweis">
          Laufend = Leasing, Versicherung, Abos (wird abgebucht). Anschaffungen = schon bezahlt, auf 36 Monate verteilt. Fixkosten = beides, voll je
          angefangenem Monat.
        </span>
      </button>
    </div>
  );
}
