"use client";

import { useState } from "react";

export default function PinGate({
  onSubmit,
  error,
  busy,
}: {
  onSubmit: (pin: string) => void;
  error: string | null;
  busy: boolean;
}) {
  const [pin, setPin] = useState("");

  return (
    <div className="pin-gate">
      <form
        className="pin-box"
        onSubmit={(e) => {
          e.preventDefault();
          if (pin.trim()) onSubmit(pin.trim());
        }}
      >
        <h1>eFahrtenbuch⚡TCO</h1>
        <p>Bitte PIN eingeben, um auf das gemeinsame Ladeprotokoll zuzugreifen.</p>
        {error && <div className="error">{error}</div>}
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !pin.trim()}>
          {busy ? "Prüfe…" : "Zugriff freischalten"}
        </button>
      </form>
    </div>
  );
}
