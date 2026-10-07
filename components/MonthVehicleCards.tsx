"use client";

import { useState } from "react";
import { VEHICLES } from "@/lib/constants";
import { fmtEUR, fmtNum, minutesToDuration, monthCosts, parseNum, durationToMinutes } from "@/lib/data";
import type { AppData, VehicleKey } from "@/lib/types";

// Monatsübersicht, Variante B (Mockup vom 07.10.2026): one card per vehicle in
// its own colour with TCO/km and Laden/km, a stacked bar showing what the TCO is
// made of, and the Euro breakdown on tap. Each card has its own open state, so
// both can be expanded side by side.

const ORDER: VehicleKey[] = ["b10", "t03"];

const PARTS = [
  { key: "laden", label: "Laden", short: "Laden", cls: "seg-laden" },
  { key: "leasing", label: "Leasing", short: "Leasing", cls: "seg-leasing" },
  { key: "versicherung", label: "Versicherung", short: "Versich.", cls: "seg-vers" },
  { key: "abos", label: "Abos", short: "Abos", cls: "seg-abos" },
  { key: "invest", label: "Investitionen", short: "Invest.", cls: "seg-invest" },
] as const;

const perKm = (n: number | null) => (n === null ? "–" : fmtNum(n, 3));

export default function MonthVehicleCards({ data, monthKey }: { data: AppData; monthKey: string }) {
  const [open, setOpen] = useState<Record<VehicleKey, boolean>>({ b10: false, t03: false });
  const costs = monthCosts(data, monthKey);
  const rows = data.months[monthKey] || [];

  const sums = (v: VehicleKey | null) => {
    const r = rows.filter((x) => (v ? x.fahrzeug === v : true));
    return {
      kwh: r.reduce((s, x) => s + parseNum(x.kwh), 0),
      laden: r.reduce((s, x) => s + parseNum(x.preis), 0),
      min: r.reduce((s, x) => s + durationToMinutes(x.dauer), 0),
    };
  };
  const all = sums(null);
  const per = { b10: sums("b10"), t03: sums("t03") };

  const chip = (label: string, fmt: (s: { kwh: number; laden: number; min: number }) => string) => (
    <div className="mvc-chip">
      <span className="label">{label}</span>
      <span className="mvc-chip-val">{fmt(all)}</span>
      <span className="mvc-chip-split">
        <span className="mvc-b10">{fmt(per.b10)}</span>
        <span className="mvc-t03">{fmt(per.t03)}</span>
      </span>
    </div>
  );

  return (
    <div className="mvc">
      <div className="mvc-pair">
        {ORDER.map((v) => {
          const c = costs.perVehicle[v];
          const isOpen = open[v];
          return (
            <button
              type="button"
              key={v}
              className={`mvc-card mvc-card-${v}`}
              aria-expanded={isOpen}
              onClick={() => setOpen((o) => ({ ...o, [v]: !o[v] }))}
            >
              <div className={`mvc-name mvc-${v}`}>
                {VEHICLES[v].nickname} <span className="mvc-code">{v === "b10" ? "B10" : "t03"}</span>
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
                  PARTS.map((p) => (
                    <i key={p.key} className={p.cls} style={{ width: `${(c[p.key] / c.gesamt) * 100}%` }} />
                  ))}
              </div>
              {isOpen ? (
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
        })}
      </div>

      <div className="mvc-legend">
        {PARTS.map((p) => (
          <span key={p.key}>
            <i className={p.cls} />
            {p.label}
          </span>
        ))}
      </div>

      <div className="mvc-chips">
        {chip("Energie", (s) => `${fmtNum(s.kwh, 1)} kWh`)}
        {chip("Ladekosten", (s) => fmtEUR(s.laden))}
        {chip("Ladezeit", (s) => `${minutesToDuration(s.min)} h`)}
      </div>

      <div className="mvc-house">
        <span className="label">Haushalt · TCO je km</span>
        {costs.tcoKm === null ? (
          <span className="mvc-missing">erst wenn beide Autos km haben</span>
        ) : (
          <span className="mvc-house-val">
            {fmtNum(costs.tcoKm, 3)} € <small>· Laden {perKm(costs.ladenKm)} €</small>
          </span>
        )}
      </div>
      {costs.haushaltOnly > 0 && (
        <p className="mvc-note">
          Darin enthalten: {fmtEUR(costs.haushaltOnly)} Kosten ohne Fahrzeugzuordnung (nur im Haushaltswert).
        </p>
      )}
    </div>
  );
}
