import type { CostKey } from "@/lib/data";

// Symbole der Kostenarten (24er Raster, Strichzeichnung wie die übrigen App-Icons).
// Versicherung bewusst als neutrales Schild, nicht als Logo einer Versicherung.
const PATHS: Record<CostKey, React.ReactNode> = {
  // Laden: Stecker (wie PlugIcon)
  laden: (
    <>
      <path d="M8 3v5M16 3v5" />
      <path d="M6 8h12v4a6 6 0 0 1-12 0V8Z" />
      <path d="M12 18v3" />
    </>
  ),
  // Leasing: Bank - Giebel mit Säulen
  leasing: (
    <>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M4 9.5h16" />
      <path d="M6 12v6M10 12v6M14 12v6M18 12v6" />
      <path d="M3.5 20.5h17" />
    </>
  ),
  // Versicherung: Schild mit Haken
  versicherung: (
    <>
      <path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6l-7-3Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  // Abos: Euro in einer Uhr mit Kreispfeil (wiederkehrend)
  abos: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 4v4h-4" />
      <path d="M14.5 9.3a3.2 3.2 0 1 0 0 5.4" />
      <path d="M8.6 11h4.4M8.6 13h4" />
    </>
  ),
  // Investitionen: Werkzeugkasten (wie die Karte "Investitionen")
  invest: (
    <>
      <rect x="3" y="9" width="18" height="10" rx="2" />
      <path d="M8 9V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" />
      <path d="M3 13h18" />
      <path d="M10.5 13v2.5M13.5 13v2.5" />
    </>
  ),
};

export const COST_META: Record<CostKey, { label: string; short: string; color: string }> = {
  laden: { label: "Laden", short: "Laden", color: "var(--teal)" },
  leasing: { label: "Leasing", short: "Leasing", color: "var(--plum)" },
  versicherung: { label: "Versicherung", short: "Versich.", color: "var(--range-yellow)" },
  abos: { label: "Abos", short: "Abos", color: "var(--danger)" },
  invest: { label: "Investitionen", short: "Invest.", color: "var(--range-green)" },
};

export function CostIcon({ k, size = 14, color = "currentColor", strokeWidth = 2 }: { k: CostKey; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[k]}
    </svg>
  );
}

// Same icon as an SVG group, centred on (x, y) with edge length `s` - for use inside the ring.
export function CostIconG({ k, x, y, s, color, strokeWidth = 2 }: { k: CostKey; x: number; y: number; s: number; color: string; strokeWidth?: number }) {
  return (
    <g
      transform={`translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})`}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
    >
      {PATHS[k]}
    </g>
  );
}

// Trendpfeil: waagerecht = gleich, nach oben = teurer (rot), nach unten = günstiger (grün).
export function TrendArrowG({ deg, x, y, s }: { deg: number; x: number; y: number; s: number }) {
  const color = deg > 0 ? "var(--danger)" : deg < 0 ? "var(--teal)" : "var(--ink-soft)";
  return (
    <g transform={`translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})`} pointerEvents="none">
      <g transform={`rotate(${-deg} 12 12)`} fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h15" />
        <path d="m14 7 5 5-5 5" />
      </g>
    </g>
  );
}

export function TrendArrow({ deg, size = 22 }: { deg: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <TrendArrowG deg={deg} x={12} y={12} s={24} />
    </svg>
  );
}
