"use client";

// Menüleiste unten nach dem Vorbild von VitalCoach (bottom_nav_bar.dart): der aktive
// Punkt hebt sich nach oben ab, leuchtet in der Akzentfarbe, darunter ein Punkt.

export type Tab = "uebersicht" | "planung" | "statistik" | "historie" | "einstellungen";

export const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "uebersicht",
    label: "Übersicht",
    icon: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9.5h13V10" />
        <path d="M10 19.5v-5h4v5" />
      </>
    ),
  },
  {
    key: "planung",
    label: "Planung",
    icon: (
      <>
        <circle cx="6" cy="18" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
      </>
    ),
  },
  {
    key: "statistik",
    label: "Statistik",
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
  {
    key: "historie",
    label: "Historie",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
  {
    key: "einstellungen",
    label: "Einstellungen",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      </>
    ),
  },
];

export default function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="bnav" aria-label="Hauptmenü">
      {TABS.map((t) => (
        <button
          type="button"
          key={t.key}
          className={"bnav-item" + (t.key === tab ? " on" : "")}
          aria-current={t.key === tab ? "page" : undefined}
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate(8);
            onChange(t.key);
          }}
        >
          <span className="bnav-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {t.icon}
            </svg>
          </span>
          <span className="bnav-lb">{t.label}</span>
          <span className="bnav-dot" />
        </button>
      ))}
    </nav>
  );
}
