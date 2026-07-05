type IconProps = { size?: number };

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function PlugIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M8 3v5M16 3v5" />
      <path d="M6 8h12v4a6 6 0 0 1-12 0V8Z" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function CardIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M6 15h4" />
    </svg>
  );
}

export function ToolboxIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
      <rect x="3" y="9" width="18" height="10" rx="2" />
      <path d="M8 9V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" />
      <path d="M3 13h18" />
      <path d="M10.5 13v2.5M13.5 13v2.5" />
    </svg>
  );
}

export function ReceiptIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M5 3.5 6.5 5 8 3.5 9.5 5 11 3.5 12.5 5 14 3.5 15.5 5 17 3.5 18.5 5 19 3.5v17l-1.5-1.5L16 20.5 14.5 19 13 20.5 11.5 19 10 20.5 8.5 19 7 20.5 5.5 19 5 20.5V3.5Z" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
    </svg>
  );
}

export function ExportBoxIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M12 3v10" />
      <path d="M8.5 9.5 12 13l3.5-3.5" />
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}
