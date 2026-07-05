"use client";

import { useEffect, useRef } from "react";
import { MONTHS } from "@/lib/constants";

export default function MonthTabs({
  activeMonth,
  onChange,
}: {
  activeMonth: string;
  onChange: (key: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeMonth]);

  return (
    <nav className="tabs">
      {MONTHS.map((m) => {
        const state = m.key < activeMonth ? "past" : m.key > activeMonth ? "future" : "active";
        return (
          <button
            key={m.key}
            ref={state === "active" ? activeRef : undefined}
            className={state}
            onClick={() => onChange(m.key)}
          >
            {m.label} &apos;{m.key.slice(2, 4)}
          </button>
        );
      })}
    </nav>
  );
}
