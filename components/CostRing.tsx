"use client";

import { useEffect, useState } from "react";
import { monthLastDay } from "@/lib/constants";
import { COST_KEYS, fmtEUR, fmtNum, type CostKey, type CostStat, type VehicleMonthCosts } from "@/lib/data";
import { COST_META, CostIcon, CostIconG, TrendArrow, TrendArrowG } from "./CostIcons";

// Lade-Ring (Variante 4, Drehring): Ruhezustand = Segmente mit Symbol-Plaketten,
// je Plakette ein Trendpfeil, km in der Mitte. Segment antippen dreht es nach
// oben, die Mitte zeigt dann Wert, Anteil, Vormonat, Trend und wo der Betrag
// zwischen Min und Max liegt. Mitte antippen öffnet die Statistik aller Kategorien.

const CX = 80;
const CY = 80;
const R = 50;
const W = 13;

const pol = (r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};
const arc = (r: number, a0: number, a1: number) => {
  const [x0, y0] = pol(r, a0);
  const [x1, y1] = pol(r, a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};

// Start/end angle (degrees, clockwise from the top) of each cost type with a value.
function ringSegments(costs: VehicleMonthCosts) {
  const out: { k: CostKey; frac: number; a0: number; a1: number }[] = [];
  let acc = 0;
  for (const k of COST_KEYS) {
    if (costs[k] <= 0) continue;
    const frac = costs[k] / costs.gesamt;
    out.push({ k, frac, a0: acc * 360, a1: (acc + frac) * 360 });
    acc += frac;
  }
  return out;
}
// "2026-10" -> "31.10.26"
export function monthEndShort(key: string): string {
  const [y, m, d] = monthLastDay(key).split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

export default function CostRing({
  costs,
  stats,
  km,
  onOpenStats,
}: {
  costs: VehicleMonthCosts;
  stats: Record<CostKey, CostStat>;
  km: number | null;
  onOpenStats: () => void;
}) {
  const [focus, setFocus] = useState<CostKey | null>(null);
  const segs = ringSegments(costs);

  // A focused category without costs (e.g. after edits) simply falls back to rest.
  const sel = focus ? segs.find((s) => s.k === focus) : undefined;

  const mid = sel ? (sel.a0 + sel.a1) / 2 : 0;
  const rot = sel ? (mid > 180 ? 360 - mid : -mid) : 0;

  if (costs.gesamt <= 0) {
    return <div className="cring-empty">Noch keine Kosten in diesem Monat</div>;
  }

  const st = sel ? stats[sel.k] : null;
  const t = st ? (st.constant ? 0.5 : (st.eur - st.minEur) / (st.maxEur - st.minEur)) : 0;

  return (
    <svg className="cring" viewBox="0 0 160 160" role="group" aria-label="Kostenaufteilung des Monats">
      <g
        style={{
          transform: `rotate(${rot}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transformBox: "view-box",
          transition: "transform 0.5s ease",
        }}
      >
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--plum-deep)" strokeWidth={W} />
        {segs.map((s) => {
          const gap = s.frac > 0.03 ? 4 : 0.5;
          const a0 = s.a0 + gap;
          const a1 = Math.max(a0 + 0.5, s.a1 - gap);
          const on = sel?.k === s.k;
          return (
            <g key={s.k}>
              <path
                d={arc(R, a0, a1)}
                fill="none"
                stroke={COST_META[s.k].color}
                strokeOpacity={sel && !on ? 0.4 : 1}
                strokeWidth={on ? W + 4 : W}
                strokeLinecap="round"
              />
              {/* breitere, unsichtbare Fläche zum Antippen */}
              <path
                d={arc(R, s.a0 + 0.5, Math.max(s.a0 + 1, s.a1 - 0.5))}
                fill="none"
                stroke="transparent"
                strokeWidth={28}
                className="cring-hit"
                role="button"
                aria-label={`${COST_META[s.k].label}: ${fmtEUR(costs[s.k])}`}
                onClick={() => setFocus(on ? null : s.k)}
              />
            </g>
          );
        })}
      </g>

      {!sel &&
        segs
          .filter((s) => s.frac >= 0.05)
          .map((s) => {
            const m = (s.a0 + s.a1) / 2;
            const [ix, iy] = pol(R, m);
            const [ax, ay] = pol(R + 21, m);
            return (
              <g key={s.k} pointerEvents="none">
                <circle cx={ix} cy={iy} r={10} fill="var(--bg)" stroke={COST_META[s.k].color} strokeWidth={2} />
                <CostIconG k={s.k} x={ix} y={iy} s={12} color={COST_META[s.k].color} />
                {stats[s.k].dev !== null && <TrendArrowG deg={stats[s.k].deg} x={ax} y={ay} s={13} />}
              </g>
            );
          })}

      <g className="cring-center" role="button" aria-label="Statistik aller Kategorien öffnen" onClick={onOpenStats}>
        <circle cx={CX} cy={CY} r={R - 13} fill="transparent" />
        {sel && st ? (
          <>
            <CostIconG k={sel.k} x={CX} y={CY - 24} s={13} color={COST_META[sel.k].color} />
            <text className="cring-v" x={CX} y={CY - 2} textAnchor="middle">
              {fmtEUR(st.eur)}
            </text>
            <text className="cring-s" x={CX} y={CY + 9} textAnchor="middle">
              {Math.round(st.pct * 100)} % · Vm {st.prevEur !== null ? `${fmtNum(st.prevEur, 0)} €` : "–"}
            </text>
            {st.dev !== null && <TrendArrowG deg={st.deg} x={CX} y={CY + 21} s={13} />}
            <path d={arc(R - 14, 130, 230)} fill="none" stroke="var(--plum-deep)" strokeWidth={4} strokeLinecap="round" />
            <path
              d={arc(R - 14, 130, 130 + 100 * Math.max(0.02, Math.min(1, t)))}
              fill="none"
              stroke={COST_META[sel.k].color}
              strokeWidth={4}
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <text className="cring-v" x={CX} y={CY + 2} textAnchor="middle">
              {km === null ? "–" : fmtNum(km, 0)}
            </text>
            <text className="cring-s" x={CX} y={CY + 13} textAnchor="middle">
              km im Monat
            </text>
          </>
        )}
      </g>
    </svg>
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
