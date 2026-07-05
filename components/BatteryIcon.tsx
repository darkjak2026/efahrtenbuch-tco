function batteryColor(pct: number): { color: string; pulse: boolean } {
  if (pct <= 5) return { color: "#7a1f1f", pulse: true };
  if (pct <= 10) return { color: "#d32f2f", pulse: false };
  if (pct <= 19) return { color: "#e8862e", pulse: false };
  if (pct <= 30) return { color: "#8bc34a", pulse: false };
  return { color: "#1b5e20", pulse: false };
}

const FULL_CHARGE_BORDER = "#ffc107";

export default function BatteryIcon({ percent, showLabel = true }: { percent: number; showLabel?: boolean }) {
  const pct = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
  const fillWidth = (pct / 100) * 10;
  const { color, pulse } = batteryColor(pct);
  const isFull = pct === 100;

  return (
    <span className="battery-indicator" style={{ color }}>
      <svg
        width="16"
        height="10"
        viewBox="0 0 16 10"
        className={"battery-icon" + (pulse ? " pulse" : "")}
        aria-hidden="true"
      >
        <rect
          x="0.5"
          y="0.5"
          width="13"
          height="9"
          rx="1.5"
          fill="none"
          stroke={isFull ? FULL_CHARGE_BORDER : "currentColor"}
          strokeWidth={isFull ? 1.5 : 1}
        />
        <rect x="14" y="3" width="1.5" height="4" rx="0.5" fill={isFull ? FULL_CHARGE_BORDER : "currentColor"} />
        <rect x="2" y="2" width={fillWidth} height="6" rx="0.5" fill="currentColor" />
      </svg>
      {showLabel && <span className="battery-label">{pct}%</span>}
    </span>
  );
}
