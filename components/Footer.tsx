"use client";

import { useRef, useState } from "react";
import packageJson from "../package.json";
import type { AppData } from "@/lib/types";
import InfoOverlay from "./InfoOverlay";

const LAUNCH_DATE = "2026-07-05";
// Rapid clicks/taps on the footer line within this window count toward the
// Easter-egg trigger; a pause longer than this resets the count to zero.
const TRIGGER_CLICKS = 5;
const TRIGGER_WINDOW_MS = 1600;

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
  const [infoOpen, setInfoOpen] = useState(false);
  const clickTimes = useRef<number[]>([]);

  const handleTrigger = () => {
    const now = Date.now();
    clickTimes.current = clickTimes.current.filter((t) => now - t < TRIGGER_WINDOW_MS);
    clickTimes.current.push(now);
    if (clickTimes.current.length >= TRIGGER_CLICKS) {
      clickTimes.current = [];
      setInfoOpen(true);
    }
  };

  return (
    <>
      <footer className="app-footer">
        <button type="button" className="app-footer-trigger" onClick={handleTrigger}>
          © Jakobus Claudius Digitalensis | {formatGerman(LAUNCH_DATE)} – {formatGerman(buildDate)} | v
          {packageJson.version}
        </button>
      </footer>
      {infoOpen && <InfoOverlay data={data} updateData={updateData} onClose={() => setInfoOpen(false)} />}
    </>
  );
}
