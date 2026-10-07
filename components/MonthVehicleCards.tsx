"use client";

import { useState } from "react";
import { VEHICLES } from "@/lib/constants";
import { durationToMinutes, fmtEUR, fmtNum, minutesToDuration, monthCosts, parseNum } from "@/lib/data";
import type { AppData, VehicleKey } from "@/lib/types";

// Monatsübersicht (Variante B, Mockup vom 07.10.2026), split for the two-column
// layout: one VehicleMonthCard at the top of each vehicle column (own open
// state, so both can be expanded side by side) and a full-width
// HouseholdMonthSummary below the columns.

const PARTS = [
  { key: "laden", label: "Laden", short: "Laden", cls: "seg-laden" },
  { key: "leasing", label: "Leasing", short: "Leasing", cls: "seg-leasing" },
  { key: "versicherung", label: "Versicherung", short: "Versich.", cls: "seg-vers" },
  { key: "abos", label: "Abos", short: "Abos", cls: "seg-abos" },
  { key: "invest", label: "Investitionen", short: "Invest.", cls: "seg-invest" },
] as const;

const perKm = (n: number | null) => (n === null ? "–" : fmtNum(n, 3));

function monthSums(data: AppData, monthKey: string, v: VehicleKey | null) {
  const rows = (data.months[monthKey] || []).filter((x) => (v ? x.fahrzeug === v : true));
  return {
    kwh: rows.reduce((s, x) => s + parseNum(x.kwh), 0),
    laden: rows.reduce((s, x) => s + parseNum(x.preis), 0),
    min: rows.reduce((s, x) => s + durationToMinutes(x.dauer), 0),
  };
}

export function VehicleMonthCard({ data, monthKey, vehicle }: { data: AppData; monthKey: string; vehicle: VehicleKey }) {
  const [open, setOpen] = useState(false);
  const c = monthCosts(data, monthKey).perVehicle[vehicle];
  const s = monthSums(data, monthKey, vehicle);
  return (
    <button
      type="button"
      className={`mvc-card mvc-card-${vehicle}`}
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
    >
      <div className={`mvc-name mvc-${vehicle}`}>
        {VEHICLES[vehicle].nickname} <span className="mvc-code">{vehicle === "b10" ? "B10" : "t03"}</span>
      </div>
      <div className="mvc-hero">
        {perKm(c.tcoKm)} <small>€/km TCO</small>
      </div>
      <div className="mvc-sub">
        {perKm(c.ladenKm)} <span>€/km Laden</span>
      </div>
      <div className="mvc-sub">
        {c.km === null ? <span className="mvc-missing">km-Stand fehlt</span> : <>{fmtNum(c.km, 0)} <span>km</span></>}
      </div>
      <div className="mvc-stack" aria-hidden="true">
        {c.gesamt > 0 &&
          PARTS.map((p) => <i key={p.key} className={p.cls} style={{ width: `${(c[p.key] / c.gesamt) * 100}%` }} />)}
      </div>
      <div className="mvc-facts">
        <span>{fmtNum(s.kwh, 1)} kWh</span>
        <span>{minutesToDuration(s.min)} h</span>
      </div>
      {open ? (
        <div className="mvc-detail">
          {PARTS.map((p) => (
            <div key={p.key}>
              <span>
                <i className={p.cls} /> {p.short}
              </span>
              <span>{fmtEUR(c[p.key])}</span>
            </div>
          ))}
          <div className="mvc-detail-sum">
            <span>Gesamt</span>
            <span>{fmtEUR(c.gesamt)}</span>
          </div>
        </div>
      ) : (
        <div className="mvc-more">Kosten anzeigen ▸</div>
      )}
    </button>
  );
}

export function HouseholdMonthSummary({
  data,
  monthKey,
  monthLabel,
  pct,
}: {
  data: AppData;
  monthKey: string;
  monthLabel: string;
  pct: number;
}) {
  const costs = monthCosts(data, monthKey);
  const all = monthSums(data, monthKey, null);
  return (
    <div className="mvc-house-wrap">
      <div className="mvc-legend">
        {PARTS.map((p) => (
          <span key={p.key}>
            <i className={p.cls} />
            {p.label}
          </span>
        ))}
      </div>
      <div className="mvc-house">
        <div className="mvc-house-head">
          <span className="label">Haushalt · {monthLabel}</span>
          {costs.tcoKm === null ? (
            <span className="mvc-missing">TCO je km erst, wenn beide Autos km haben</span>
          ) : (
            <span className="mvc-house-val">
              {fmtNum(costs.tcoKm, 3)} € <small>/km TCO · Laden {perKm(costs.ladenKm)} €</small>
            </span>
          )}
        </div>
        <div className="mvc-house-facts">
          <span>
            <b>{fmtNum(all.kwh, 1)}</b> kWh
          </span>
          <span>
            <b>{fmtEUR(all.laden)}</b> Laden
          </span>
          <span>
            <b>{minutesToDuration(all.min)}</b> h
          </span>
          <span>
            <b>{fmtEUR(costs.gesamt)}</b> gesamt
          </span>
        </div>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="mvc-house-caption">{pct}% der Energie des bisher stärksten Monats</div>
        {costs.haushaltOnly > 0 && (
          <div className="mvc-house-caption">
            Darin {fmtEUR(costs.haushaltOnly)} Kosten ohne Fahrzeugzuordnung (nur im Haushaltswert).
          </div>
        )}
      </div>
    </div>
  );
}
