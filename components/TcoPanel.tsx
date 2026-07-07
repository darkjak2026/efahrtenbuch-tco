"use client";

import { useState } from "react";
import { fmtEUR, fmtNum, vehicleStats } from "@/lib/data";
import { VEHICLES } from "@/lib/constants";
import type { AppData, VehicleKey } from "@/lib/types";

function VehicleName({ vehicleKey }: { vehicleKey: VehicleKey }) {
  const { nickname, official } = VEHICLES[vehicleKey];
  return (
    <>
      <span className="vehicle-nickname">{nickname}</span>
      <span className="vehicle-official">({official})</span>
    </>
  );
}

function TcoCard({
  title,
  dotClass,
  kmStand,
  tco,
  months,
  extraLines,
}: {
  title: React.ReactNode;
  dotClass: string;
  kmStand: number;
  tco: number;
  months: number;
  extraLines: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const kmPreis = kmStand > 0 ? tco / kmStand : null;
  const tcoProMonat = months > 0 ? tco / months : null;
  return (
    <div className={"tco-card" + (dotClass === "house" ? " house" : "")}>
      <div className="name">
        <i className={`dot ${dotClass}`} style={{ width: 9, height: 9 }} />
        {title}
      </div>
      <div className="kmpreis">
        {kmPreis !== null ? fmtNum(kmPreis, 3) : "–"} <small>€/km TCO</small>
      </div>
      <button type="button" className="tco-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Details ausblenden ▾" : "Details anzeigen ▸"}
      </button>
      {open && (
        <>
          <div className="sub">
            TCO / Monat: <b>{tcoProMonat !== null ? fmtEUR(tcoProMonat) : "–"}</b>
            <br />
            TCO gesamt: <b>{fmtEUR(tco)}</b>
            <br />
            {extraLines}
          </div>
          {kmStand === 0 ? (
            <div className="warn">Noch kein km-Stand erfasst — €/km folgt automatisch.</div>
          ) : (
            <div className="sub" style={{ marginTop: 4 }}>
              km-Stand: <b>{fmtNum(kmStand, 0)} km</b>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TcoPanel({ data }: { data: AppData }) {
  const b10 = vehicleStats(data, "b10");
  const t03 = vehicleStats(data, "t03");

  return (
    <div className="tco-cards">
      <div className="tco-vehicle-row">
        <TcoCard
          title={<VehicleName vehicleKey="b10" />}
          dotClass="b10"
          kmStand={b10.kmStand}
          tco={b10.tco}
          months={b10.months}
          extraLines={
            <>
              Ladekosten: <b>{fmtEUR(b10.ladekosten)}</b>
              <br />
              Leasing+Vers.: <b>{fmtEUR(b10.leasingKosten + b10.versicherungKosten)}</b>
              <br />
              Wiederk. Kosten: <b>{fmtEUR(b10.recurringKosten)}</b>
              <br />
              Investitionen: <b>{fmtEUR(b10.investKosten)}</b>
            </>
          }
        />
        <TcoCard
          title={<VehicleName vehicleKey="t03" />}
          dotClass="t03"
          kmStand={t03.kmStand}
          tco={t03.tco}
          months={t03.months}
          extraLines={
            <>
              Ladekosten: <b>{fmtEUR(t03.ladekosten)}</b>
              <br />
              Leasing+Vers.: <b>{fmtEUR(t03.leasingKosten + t03.versicherungKosten)}</b>
              <br />
              Wiederk. Kosten: <b>{fmtEUR(t03.recurringKosten)}</b>
              <br />
              Investitionen: <b>{fmtEUR(t03.investKosten)}</b>
            </>
          }
        />
      </div>
    </div>
  );
}
