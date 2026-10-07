"use client";

import { useState } from "react";
import { MONTHS, VEHICLES } from "@/lib/constants";
import { COST_KEYS, costStats, durationToMinutes, fmtEUR, fmtNum, minutesToDuration, monthCosts, parseNum } from "@/lib/data";
import type { AppData, VehicleKey } from "@/lib/types";
import { COST_META, CostIcon } from "./CostIcons";
import CostRing, { CostStatsSheet } from "./CostRing";

const monthLabelOf = (key: string) => `${MONTHS.find((m) => m.key === key)?.label ?? key} ${key.slice(0, 4)}`;

// Monatsübersicht (Variante B, Mockup vom 07.10.2026; Kostengrafik als Lade-Ring,
// Statistik-Mockup Idee 4), split for the two-column
// layout: one VehicleMonthCard at the top of each vehicle column (own open
// state, so both can be expanded side by side) and a full-width
// HouseholdMonthSummary below the columns.


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
  const [statsOpen, setStatsOpen] = useState(false);
  const c = monthCosts(data, monthKey).perVehicle[vehicle];
  const s = monthSums(data, monthKey, vehicle);
  const stats = costStats(data, vehicle, monthKey);
  return (
    <div className={`mvc-card mvc-card-${vehicle}`}>
      <div className={`mvc-name mvc-${vehicle}`}>
        {VEHICLES[vehicle].nickname} <span className="mvc-code">{vehicle === "b10" ? "B10" : "t03"}</span>
      </div>
      <div className="mvc-hero">
        {perKm(c.tcoKm)} <small>€/km TCO</small>
      </div>
      <div className="mvc-sub">
        {perKm(c.ladenKm)} <span>€/km Laden</span>
      </div>
      {c.km === null && (
        <div className="mvc-sub">
          <span className="mvc-missing">km-Stand fehlt</span>
        </div>
      )}
      {/* key: a new month starts in the rest state again */}
      <CostRing key={monthKey} costs={c} stats={stats} km={c.km} onOpenStats={() => setStatsOpen(true)} />
      <button type="button" className="mvc-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Details ▾" : "Details ▸"}
      </button>
      {open && (
        <div className="mvc-detail">
          <div className="mvc-facts">
            <span>{fmtNum(s.kwh, 1)} kWh</span>
            <span>{minutesToDuration(s.min)} h</span>
          </div>
          {COST_KEYS.map((k) => (
            <div key={k}>
              <span>
                <CostIcon k={k} size={11} color={COST_META[k].color} /> {COST_META[k].short}
              </span>
              <span>{fmtEUR(c[k])}</span>
            </div>
          ))}
          <div className="mvc-detail-sum">
            <span>Gesamt</span>
            <span>{fmtEUR(c.gesamt)}</span>
          </div>
        </div>
      )}
      {statsOpen && (
        <CostStatsSheet
          title={`${VEHICLES[vehicle].nickname} · Statistik ${monthLabelOf(monthKey)}`}
          vehicle={vehicle}
          monthKey={monthKey}
          stats={stats}
          gesamt={c.gesamt}
          onClose={() => setStatsOpen(false)}
        />
      )}
    </div>
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
        {COST_KEYS.map((k) => (
          <span key={k}>
            <CostIcon k={k} size={12} color={COST_META[k].color} />
            {COST_META[k].label}
          </span>
        ))}
        <span>· Ring antippen = Details, Mitte = Statistik</span>
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
