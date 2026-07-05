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
  kmDriven,
  tco,
  extraLines,
}: {
  title: React.ReactNode;
  dotClass: string;
  kmDriven: number;
  tco: number;
  extraLines: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const kmPreis = kmDriven > 0 ? tco / kmDriven : null;
  return (
    <div className={"tco-card" + (dotClass === "house" ? " house" : "")}>
      <div className="name">
        <i className={`dot ${dotClass}`} style={{ width: 9, height: 9 }} />
        {title}
      </div>
      <div className="kmpreis">
        {kmPreis !== null ? fmtNum(kmPreis, 3) : "–"} <small>€/km</small>
      </div>
      <button type="button" className="tco-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Details ausblenden ▾" : "Details anzeigen ▸"}
      </button>
      {open && (
        <>
          <div className="sub">
            TCO gesamt: <b>{fmtEUR(tco)}</b>
            <br />
            {extraLines}
          </div>
          {kmDriven === 0 ? (
            <div className="warn">Noch keine zwei km-Stände erfasst — €/km folgt automatisch.</div>
          ) : (
            <div className="sub" style={{ marginTop: 4 }}>
              gefahren: <b>{fmtNum(kmDriven, 0)} km</b>
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
          kmDriven={b10.kmDriven}
          tco={b10.tco}
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
          kmDriven={t03.kmDriven}
          tco={t03.tco}
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
