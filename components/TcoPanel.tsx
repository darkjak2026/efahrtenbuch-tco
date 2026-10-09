"use client";

import { Fragment, useState } from "react";
import { fmtEUR, fmtNum, vehicleStats } from "@/lib/data";
import { VEHICLES } from "@/lib/constants";
import type { AppData, VehicleKey } from "@/lib/types";
import LeasingCountdown from "./LeasingCountdown";

function VehicleName({ vehicleKey }: { vehicleKey: VehicleKey }) {
  const { nickname, official } = VEHICLES[vehicleKey];
  return (
    <>
      {/* Name und Modell in derselben Schrift, mit "/" getrennt; ohne "Leapmotor" (bricht sonst um) */}
      <span className="vehicle-nickname">
        {nickname} / {official.replace(/^Leapmotor\s+/, "")}
      </span>
    </>
  );
}

interface TcoRow {
  label: string;
  value: string;
}

function TcoCard({
  title,
  dotClass,
  kmStand,
  tco,
  months,
  extraRows,
  countdown,
}: {
  title: React.ReactNode;
  dotClass: string;
  kmStand: number;
  tco: number;
  months: number;
  extraRows: TcoRow[];
  countdown?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const kmPreis = kmStand > 0 ? tco / kmStand : null;
  const tcoProMonat = months > 0 ? tco / months : null;
  const rows: TcoRow[] = [
    { label: "TCO / Monat", value: tcoProMonat !== null ? fmtEUR(tcoProMonat) : "–" },
    { label: "TCO gesamt", value: fmtEUR(tco) },
    ...extraRows,
  ];
  return (
    <div className="tco-col">
      {dotClass !== "house" && <div className={`tco-car tco-car-${dotClass}`} aria-hidden="true" />}
    <div className={"tco-card tco-card-" + dotClass + (dotClass === "house" ? " house" : "")}>
      <div className="name">
        <i className={`dot ${dotClass}`} style={{ width: 9, height: 9 }} />
        {title}
      </div>
      <div className="kmpreis">
        {kmPreis !== null ? `${fmtNum(kmPreis, 2)} €/km` : "–"} <small>TCO/Alltime</small>
      </div>
      <div className="odo">
        <b>{kmStand > 0 ? `${fmtNum(kmStand, 0)} km` : "–"}</b> (ODO)
      </div>
      {kmStand === 0 && <div className="warn">Noch kein km-Stand erfasst — €/km folgt automatisch.</div>}
      <button type="button" className="tco-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Details ausblenden ▾" : "Details anzeigen ▸"}
      </button>
      {open && countdown}
      {open && (
        <div className="sub-grid">
          {rows.map((r) => (
            <Fragment key={r.label}>
              <span className="sub-label">{r.label}</span>
              <span className="sub-value">{r.value}</span>
            </Fragment>
          ))}
        </div>
      )}
    </div>
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
          countdown={<LeasingCountdown data={data} vehicle="b10" />}
          extraRows={[
            { label: "Ladekosten", value: fmtEUR(b10.ladekosten) },
            { label: "Leasing+Vers.", value: fmtEUR(b10.leasingKosten + b10.versicherungKosten) },
            { label: "Wiederk. Kosten", value: fmtEUR(b10.recurringKosten) },
            { label: "Investitionen", value: fmtEUR(b10.investKosten) },
          ]}
        />
        <TcoCard
          title={<VehicleName vehicleKey="t03" />}
          dotClass="t03"
          kmStand={t03.kmStand}
          tco={t03.tco}
          months={t03.months}
          countdown={<LeasingCountdown data={data} vehicle="t03" />}
          extraRows={[
            { label: "Ladekosten", value: fmtEUR(t03.ladekosten) },
            { label: "Leasing+Vers.", value: fmtEUR(t03.leasingKosten + t03.versicherungKosten) },
            { label: "Wiederk. Kosten", value: fmtEUR(t03.recurringKosten) },
            { label: "Investitionen", value: fmtEUR(t03.investKosten) },
          ]}
        />
      </div>
    </div>
  );
}
