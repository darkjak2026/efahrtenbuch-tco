"use client";

import { Fragment, useState } from "react";
import { fmtEUR, fmtNum, vehicleStats } from "@/lib/data";
import { VEHICLES } from "@/lib/constants";
import type { AppData, VehicleKey } from "@/lib/types";
import { PencilIcon } from "./Icons";
import KmStandDialog from "./KmStandDialog";
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
  kmGefahren,
  tco,
  months,
  extraRows,
  countdown,
  onKmStand,
}: {
  title: React.ReactNode;
  dotClass: string;
  kmStand: number;
  kmGefahren: number; // seit Übergabe – €/km teilt durch diese km (v2.51.00), nicht durch den Tachostand
  tco: number;
  months: number;
  extraRows: TcoRow[];
  countdown?: React.ReactNode;
  onKmStand?: () => void; // „km-Stand aktualisieren“ (v2.52.00)
}) {
  const [open, setOpen] = useState(false);
  const kmPreis = kmGefahren > 0 ? tco / kmGefahren : null;
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
        {/* ohne „(ODO)“ (v2.54.03) – der Tachostand ist auch so klar */}
        <b>{kmStand > 0 ? `${fmtNum(kmStand, 0)} km` : "–"}</b>
        {onKmStand && (
          // kleiner Stift statt Textlink (v2.54.02): km-Stand manuell aktualisieren
          <button type="button" className="tco-kmstand" aria-label="km-Stand manuell aktualisieren" title="km-Stand manuell aktualisieren" onClick={onKmStand}>
            <PencilIcon size={14} />
          </button>
        )}
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

export default function TcoPanel({
  data,
  updateData,
  showToast,
}: {
  data: AppData;
  updateData: (fn: (d: AppData) => void) => void;
  showToast: (msg: string) => void;
}) {
  const b10 = vehicleStats(data, "b10");
  const t03 = vehicleStats(data, "t03");
  const [kmFuer, setKmFuer] = useState<VehicleKey | null>(null);

  return (
    <div className="tco-cards">
      <div className="tco-vehicle-row">
        <TcoCard
          title={<VehicleName vehicleKey="b10" />}
          dotClass="b10"
          kmStand={b10.kmStand}
          kmGefahren={b10.kmGefahren}
          tco={b10.tco}
          months={b10.months}
          countdown={<LeasingCountdown data={data} vehicle="b10" />}
          onKmStand={() => setKmFuer("b10")}
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
          kmGefahren={t03.kmGefahren}
          tco={t03.tco}
          months={t03.months}
          countdown={<LeasingCountdown data={data} vehicle="t03" />}
          onKmStand={() => setKmFuer("t03")}
          extraRows={[
            { label: "Ladekosten", value: fmtEUR(t03.ladekosten) },
            { label: "Leasing+Vers.", value: fmtEUR(t03.leasingKosten + t03.versicherungKosten) },
            { label: "Wiederk. Kosten", value: fmtEUR(t03.recurringKosten) },
            { label: "Investitionen", value: fmtEUR(t03.investKosten) },
          ]}
        />
      </div>
      {kmFuer && <KmStandDialog data={data} vehicle={kmFuer} updateData={updateData} showToast={showToast} onClose={() => setKmFuer(null)} />}
    </div>
  );
}
