export default function BatteryIcon({ percent }: { percent: number }) {
  const pct = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
  const fillWidth = (pct / 100) * 10;
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" className="battery-icon" aria-hidden="true">
      <rect x="0.5" y="0.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="14" y="3" width="1.5" height="4" rx="0.5" fill="currentColor" />
      <rect x="2" y="2" width={fillWidth} height="6" rx="0.5" fill="currentColor" />
    </svg>
  );
}
