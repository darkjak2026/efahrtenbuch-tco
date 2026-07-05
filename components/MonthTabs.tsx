"use client";

import { MONTHS } from "@/lib/constants";

export default function MonthTabs({
  activeMonth,
  onChange,
}: {
  activeMonth: string;
  onChange: (key: string) => void;
}) {
  return (
    <nav className="tabs">
      {MONTHS.map((m) => (
        <button
          key={m.key}
          className={m.key === activeMonth ? "active" : ""}
          onClick={() => onChange(m.key)}
        >
          {m.label} &apos;{m.key.slice(2, 4)}
        </button>
      ))}
    </nav>
  );
}
