"use client";

import { useEffect, useRef, useState } from "react";
import { MONTHS, shiftMonth } from "@/lib/constants";

// Floating month bar above the two-column Lade-Historie, modelled on the week
// bar of Wochenstimme (gradient from the left to the right column colour,
// ◀ label ▶, arrow keys). Tapping the label opens a month picker.
export default function MonthNav({ activeMonth, onChange }: { activeMonth: string; onChange: (key: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const idx = MONTHS.findIndex((m) => m.key === activeMonth);
  const meta = MONTHS[idx];
  const year = activeMonth.slice(0, 4);

  const go = (delta: number) => {
    const next = shiftMonth(activeMonth, delta);
    if (next) onChange(next);
  };
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });

  // ←/→ switch months - not while typing, and not while a dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target;
      if (t instanceof Element && t.closest("input, textarea, select")) return;
      if (document.querySelector(".fab-overlay, .bp-overlay")) return;
      goRef.current(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pickerOpen]);

  const years = Array.from(new Set(MONTHS.map((m) => m.key.slice(0, 4))));

  return (
    <div className="month-nav-wrap" ref={wrapRef}>
      <nav className="month-nav" aria-label="Monat wählen">
        <button type="button" className="month-nav-btn" aria-label="Voriger Monat" title="Voriger Monat (←)" disabled={idx <= 0} onClick={() => go(-1)}>
          ◀
        </button>
        <button
          type="button"
          className="month-nav-label"
          aria-expanded={pickerOpen}
          aria-haspopup="true"
          onClick={() => setPickerOpen((o) => !o)}
        >
          <span className="month-nav-kicker">Lade-Historie</span>
          <span className="month-nav-month">
            {meta?.label} <small>{year}</small>
          </span>
        </button>
        <button
          type="button"
          className="month-nav-btn"
          aria-label="Nächster Monat"
          title="Nächster Monat (→)"
          disabled={idx >= MONTHS.length - 1}
          onClick={() => go(1)}
        >
          ▶
        </button>
      </nav>
      {pickerOpen && (
        <div className="month-picker">
          {years.map((y) => (
            <div key={y} className="month-picker-year">
              <div className="month-picker-y">{y}</div>
              <div className="month-picker-grid">
                {MONTHS.filter((m) => m.key.startsWith(y)).map((m) => (
                  <button
                    type="button"
                    key={m.key}
                    className={m.key === activeMonth ? "active" : ""}
                    onClick={() => {
                      onChange(m.key);
                      setPickerOpen(false);
                    }}
                  >
                    {m.label.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
