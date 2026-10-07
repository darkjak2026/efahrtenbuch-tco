"use client";

import { useRef, useState } from "react";
import type { AppData } from "@/lib/types";
import { TOOL_VERSION } from "@/lib/version";
import DevArea from "./DevArea";

const LAUNCH_DATE = "2026-07-05";
// CLAUDE-Allgemein 6.1: 5 taps on the version number open the Entwicklerbereich;
// a pause of more than 2 s between taps starts the count over.
const TRIGGER_CLICKS = 5;
const TRIGGER_RESET_MS = 2000;

function formatGerman(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

export default function Footer({
  data,
  updateData,
}: {
  data: AppData;
  updateData: (fn: (d: AppData) => void) => void;
}) {
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE || LAUNCH_DATE;
  const [devOpen, setDevOpen] = useState(false);
  const count = useRef(0);
  const lastClick = useRef(0);

  const handleVersionClick = () => {
    const now = Date.now();
    count.current = now - lastClick.current > TRIGGER_RESET_MS ? 1 : count.current + 1;
    lastClick.current = now;
    if (count.current >= TRIGGER_CLICKS) {
      count.current = 0;
      setDevOpen(true);
    }
  };

  return (
    <>
      <footer className="app-footer">
        <span className="app-footer-version" onClick={handleVersionClick}>
          v{TOOL_VERSION}
        </span>{" "}
        — Jakobus Claudius Digitalensis (+KI-Claude) · {formatGerman(LAUNCH_DATE)} – {formatGerman(buildDate)}
      </footer>
      {devOpen && <DevArea data={data} updateData={updateData} onClose={() => setDevOpen(false)} />}
    </>
  );
}
