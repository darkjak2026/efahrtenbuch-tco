"use client";

import { useState } from "react";

export default function PinGate({
  onSubmit,
  error,
  busy,
  locked = false,
}: {
  onSubmit: (pin: string) => void;
  error: string | null;
  busy: boolean;
  locked?: boolean;
}) {
  const [pin, setPin] = useState("");

  return (
    <div className="pin-gate">
      <form
        className="pin-box"
        onSubmit={(e) => {
          e.preventDefault();
          if (pin.trim() && !locked) onSubmit(pin.trim());
        }}
      >
        <h1>eFahrtenbuch⚡TCO</h1>
        <p>Bitte PIN eingeben, um auf das gemeinsame Ladeprotokoll zuzugreifen.</p>
        {error && <div className="error">{error}</div>}
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          disabled={locked}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || locked || !pin.trim()}>
          {busy ? "Prüfe…" : locked ? "Kurz warten…" : "Zugriff freischalten"}
        </button>
      </form>
    </div>
  );
}
