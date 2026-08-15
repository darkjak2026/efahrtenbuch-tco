"use client";

import { useMemo } from "react";

const CONFETTI_COLORS = [
  "var(--plum)",
  "var(--accent)",
  "var(--glacier)",
  "var(--teal)",
  "var(--violet)",
  "var(--range-peak)",
];

// A small, dependency-free confetti burst in the app's own palette — a one-shot
// celebration for finishing a Nach-Erfassung. Unmounted by the parent shortly
// after the animation ends; every piece's spread/rotation/timing is randomized
// once on mount so repeat bursts don't look identical.
export default function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        tx: Math.round((Math.random() - 0.5) * 150),
        rot: Math.round(Math.random() * 360),
        delay: Math.round(Math.random() * 120),
        duration: 700 + Math.round(Math.random() * 400),
      })),
    []
  );

  return (
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              background: p.color,
              "--confetti-tx": `${p.tx}px`,
              "--confetti-rot": `${p.rot}deg`,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
