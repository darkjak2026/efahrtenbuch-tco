"use client";

import { useEffect, useState } from "react";
import { monthLastDay } from "@/lib/constants";
import { COST_KEYS, fmtEUR, type CostKey, type CostStat, type VehicleMonthCosts } from "@/lib/data";
import { COST_META, CostIcon, CostIconG, TrendArrow, TrendArrowG } from "./CostIcons";

// Fitnessringe (Mockup "Kostenring", Variante 5): jede Kostenart hat ihren
// eigenen Ring, die Bogenlänge ist ihr Anteil an den Monatskosten. Am Ringanfang
// sitzt das Symbol, am Bogenende der Trendpfeil (Ø der letzten 3 Monate).
// Ring antippen hebt ihn hervor und zeigt Betrag, Anteil, Vormonat und Trend
// darunter; die Ringmitte öffnet die Statistik aller Kategorien.

const CX = 80;
const CY = 80;
const W = 9;
const ringRadius = (i: number) => 66 - i * 12.5;

const pol = (r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};
const arc = (r: number, a0: number, a1: number) => {
  const [x0, y0] = pol(r, a0);
  const [x1, y1] = pol(r, a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};

// "2026-10" -> "31.10.26"
export function monthEndShort(key: string): string {
  const [y, m, d] = monthLastDay(key).split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

export default function CostRing({
  costs,
  stats,
  onOpenStats,
}: {
  costs: VehicleMonthCosts;
  stats: Record<CostKey, CostStat>;
  onOpenStats: () => void;
}) {
  const [focus, setFocus] = useState<CostKey | null>(null);

  if (costs.gesamt <= 0) {
    return <div className="cring-empty">Noch keine Kosten in diesem Monat</div>;
  }
  const sel = focus ? stats[focus] : null;

  return (
    <>
      <svg className="cring" viewBox="0 0 160 160" role="group" aria-label="Kostenaufteilung des Monats">
        {COST_KEYS.map((k, i) => {
          const r = ringRadius(i);
          const frac = costs[k] / costs.gesamt;
          const end = frac > 0 ? Math.max(4, frac * 359) : 0;
          const dim = focus !== null && focus !== k;
          const color = COST_META[k].color;
          const [ax, ay] = pol(r, Math.min(end + 10, 340));
          return (
            <g key={k} opacity={dim ? 0.3 : 1} style={{ transition: "opacity 0.2s" }}>
              <circle cx={CX} cy={CY} r={r} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={W} />
              {end > 0 && (
                <path d={arc(r, 0, end)} fill="none" stroke={color} strokeWidth={focus === k ? W + 2 : W} strokeLinecap="round" />
              )}
              <circle cx={CX - 11} cy={CY - r} r={6.2} fill="var(--bg)" />
              <CostIconG k={k} x={CX - 11} y={CY - r} s={9.5} color={color} strokeWidth={2.6} />
              {end > 0 && stats[k].dev !== null && <TrendArrowG deg={stats[k].deg} x={ax} y={ay} s={9.5} />}
              {/* ganzer Ring als Fläche zum Antippen */}
              <circle
                cx={CX}
                cy={CY}
                r={r}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                className="cring-hit"
                role="button"
                aria-label={`${COST_META[k].label}: ${fmtEUR(costs[k])}`}
                onClick={() => setFocus(focus === k ? null : k)}
              />
            </g>
          );
        })}
        <g className="cring-center" role="button" aria-label="Statistik aller Kategorien öffnen" onClick={onOpenStats}>
          <circle cx={CX} cy={CY} r={10} fill="var(--lav)" stroke="var(--line)" />
          <text className="cring-i" x={CX} y={CY + 3.5} textAnchor="middle">
            i
          </text>
        </g>
      </svg>
      {sel && (
        <div className="cring-info" style={{ borderColor: COST_META[sel.key].color }}>
          <span className="cring-info-t">
            <CostIcon k={sel.key} size={12} color={COST_META[sel.key].color} /> {COST_META[sel.key].short}
          </span>
          <span className="cring-info-v">
            <b>{fmtEUR(sel.eur)}</b> · {Math.round(sel.pct * 100)} %
          </span>
          <span className="cring-info-p">
            Vm {sel.prevEur !== null ? fmtEUR(sel.prevEur) : "–"}
            {sel.dev !== null && <TrendArrow deg={sel.deg} size={14} />}
          </span>
        </div>
      )}
    </>
  );
}

export function CostStatsSheet({
  title,
  vehicle,
  monthKey,
  stats,
  gesamt,
  onClose,
}: {
  title: string;
  vehicle: "b10" | "t03";
  monthKey: string;
  stats: Record<CostKey, CostStat>;
  gesamt: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pct = (p: number) => `${Math.round(p * 100)} %`;
  return (
    <div className="fab-overlay" onClick={onClose}>
      <div className={`fab-modal cstat cstat-${vehicle}`} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="cstat-sub">
          Gesamt {fmtEUR(gesamt)} · Min/Max über alle bisherigen Monate · Trend gegen Ø der letzten 3 Monate
        </p>
        {COST_KEYS.map((k) => {
          const s = stats[k];
          const trend =
            s.dev === null ? "–" : Math.abs(s.dev) < 0.025 ? "gleich" : `${s.dev > 0 ? "+" : "−"}${Math.round(Math.abs(s.dev) * 100)} %`;
          return (
            <div className="cstat-row" key={k}>
              <span className="cstat-ic" style={{ background: COST_META[k].color }}>
                <CostIcon k={k} size={16} color="var(--bg)" />
              </span>
              <div className="cstat-txt">
                <div className="cstat-t">{COST_META[k].label}</div>
                <div>
                  Aktueller Wert: <b>{fmtEUR(s.eur)}</b> · {pct(s.pct)} [{monthEndShort(monthKey)}]
                </div>
                <div>
                  Vormonat:{" "}
                  {s.prevMonth !== null && s.prevEur !== null && s.prevPct !== null ? (
                    <>
                      <b>{fmtEUR(s.prevEur)}</b> · {pct(s.prevPct)} [{monthEndShort(s.prevMonth)}]
                    </>
                  ) : (
                    "–"
                  )}
                </div>
                {s.constant ? (
                  <div>
                    Betrag gleichbleibend: <b>{fmtEUR(s.eur)}</b>
                  </div>
                ) : (
                  <>
                    <div>
                      Minimaler Wert: <b>{fmtEUR(s.minEur)}</b> [{monthEndShort(s.minEurMonth)}]
                    </div>
                    <div>
                      Maximaler Wert: <b>{fmtEUR(s.maxEur)}</b> [{monthEndShort(s.maxEurMonth)}]
                    </div>
                  </>
                )}
                <div>
                  Anteil min: <b>{pct(s.minPct)}</b> [{monthEndShort(s.minPctMonth)}] · max: <b>{pct(s.maxPct)}</b> [
                  {monthEndShort(s.maxPctMonth)}]
                </div>
              </div>
              <div className="cstat-trend">
                <span>
                  <TrendArrow deg={s.deg} size={24} />
                </span>
                <small>{trend}</small>
              </div>
            </div>
          );
        })}
        <button type="button" className="dev-btn dev-close" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}
