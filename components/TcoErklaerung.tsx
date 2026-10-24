"use client";

import { VEHICLES } from "@/lib/constants";
import { fmtEUR, fmtNum, parseNum, vehicleStats } from "@/lib/data";
import type { AppData, VehicleKey } from "@/lib/types";

// „So entsteht der Preis je km“ (v2.55.00): Ziel des * am €/km-Wert in der Kachel oben.
// Zeigt je Auto die Rechnung von TCO/Alltime mit den echten Zahlen.

export const TCO_ERKLAERUNG_ID = "tco-erklaerung";

function Auto({ data, vehicle }: { data: AppData; vehicle: VehicleKey }) {
  const s = vehicleStats(data, vehicle);
  const v = data.vehicles[vehicle];
  const pauschale = parseNum(v.stichtagLadekosten);
  const proKm = s.kmGefahren > 0 ? s.tco / s.kmGefahren : null;
  const zeile = (label: string, betrag: number, hinweis?: string) => (
    <div className="tcoe-zeile">
      <span>
        {label}
        {hinweis && <small> {hinweis}</small>}
      </span>
      <span>{fmtEUR(betrag)}</span>
    </div>
  );
  return (
    <div className={`tcoe-auto tcoe-${vehicle}`}>
      <h3>{VEHICLES[vehicle].nickname}</h3>
      {zeile("Stromkosten", s.ladekosten, pauschale > 0 ? `(inkl. ${fmtEUR(pauschale)} Pauschale bis Stichtag)` : undefined)}
      {zeile("Leasing", s.leasingKosten)}
      {zeile("Versicherung", s.versicherungKosten)}
      {zeile("Abos", s.recurringKosten)}
      {zeile("Anschaffungen", s.investKosten, "(auf 36 Monate verteilt)")}
      <div className="tcoe-zeile tcoe-summe">
        <span>Kosten seit Übergabe</span>
        <span>{fmtEUR(s.tco)}</span>
      </div>
      <div className="tcoe-zeile">
        <span>
          ÷ gefahrene km
          <small>
            {" "}
            (Tachostand {fmtNum(s.kmStand, 0)} − {fmtNum(parseNum(v.kmBeiLeasingbeginn), 0)} bei Übergabe)
          </small>
        </span>
        <span>{fmtNum(s.kmGefahren, 0)} km</span>
      </div>
      <div className="tcoe-zeile tcoe-ergebnis">
        <span>= Preis je km</span>
        <span>{proKm === null ? "–" : `${fmtNum(proKm, 2)} €/km`}</span>
      </div>
    </div>
  );
}

export default function TcoErklaerung({ data }: { data: AppData }) {
  return (
    <section className="tcoe" id={TCO_ERKLAERUNG_ID}>
      <h2 className="section-title">So entsteht der Preis je km</h2>
      <p className="tcoe-text">
        Der Wert oben in der Kachel (mit *) sind alle Kosten seit der Übergabe geteilt durch die seither gefahrenen km. Leasing, Versicherung
        und Abos zählen voll für jeden angefangenen Monat, so wie sie abgebucht werden; Anschaffungen sind auf 36 Monate verteilt.
      </p>
      <div className="tcoe-grid">
        <Auto data={data} vehicle="b10" />
        <Auto data={data} vehicle="t03" />
      </div>
    </section>
  );
}
