"use client";

import { useEffect, useState } from "react";

// Ladeklappen-Erinnerung (v2.49.00, Wunsch vom 18.10.2026, Mockup vom selben Tag):
// nach jedem abgeschlossenen „Nach dem Laden“ ein Hinweis mit zwei Häkchen. Es gibt
// bewusst kein „Später“ (Entscheidung des Urhebers): Erst beide Häkchen schalten
// „Alles zu ✓“ frei. Ein Browser darf beim Verlassen der App keinen eigenen Hinweis
// zeigen – deshalb kommt er direkt nach dem Speichern. Wird die App vorher geschlossen,
// merkt sich das Gerät den offenen Hinweis und zeigt ihn beim nächsten Öffnen wieder.

const KEY = "efahrtenbuch_ladeklappe_offen";
const EVENT = "efahrtenbuch:ladeklappe";

function leseOffen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function merke(offen: boolean): void {
  try {
    if (offen) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Gesperrter Speicher: der Hinweis erscheint trotzdem, überlebt nur kein Schließen.
  }
}

export function erinnereLadeklappe(): void {
  merke(true);
  window.dispatchEvent(new Event(EVENT));
}

export default function LadeklappeErinnerung() {
  // Wird erst nach dem Laden der Daten im Browser eingeblendet (nie auf dem Server
  // gerendert), deshalb ist localStorage im Initialisierer sicher.
  const [offen, setOffen] = useState(leseOffen);
  const [kabel, setKabel] = useState(false);
  const [klappe, setKlappe] = useState(false);

  useEffect(() => {
    const zeigen = () => {
      setKabel(false);
      setKlappe(false);
      setOffen(true);
    };
    window.addEventListener(EVENT, zeigen);
    return () => window.removeEventListener(EVENT, zeigen);
  }, []);

  if (!offen) return null;

  const fertig = () => {
    merke(false);
    setOffen(false);
  };

  return (
    <div className="klappe-overlay" role="dialog" aria-modal="true" aria-labelledby="klappe-titel">
      <div className="klappe-karte">
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
          <rect x="8" y="14" width="56" height="44" rx="10" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M36 22 L28 38 h8 l-4 14 l14 -20 h-9 l5 -10 z" fill="currentColor" />
        </svg>
        <h2 id="klappe-titel">Ladeklappe zu?</h2>
        <p>Kurz prüfen, bevor du losfährst.</p>
        <div className="klappe-check">
          <label className={kabel ? "an" : ""}>
            <input type="checkbox" checked={kabel} onChange={(e) => setKabel(e.target.checked)} />
            Ladekabel abgezogen und verstaut
          </label>
          <label className={klappe ? "an" : ""}>
            <input type="checkbox" checked={klappe} onChange={(e) => setKlappe(e.target.checked)} />
            Ladeklappe geschlossen
          </label>
        </div>
        <button type="button" className="klappe-ok" disabled={!kabel || !klappe} onClick={fertig}>
          Alles zu ✓
        </button>
      </div>
    </div>
  );
}
