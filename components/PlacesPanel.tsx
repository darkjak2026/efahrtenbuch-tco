"use client";

import { useState } from "react";
import type { AppData } from "@/lib/types";

// Einstellungen › Gespeicherte Orte für den Streckenrechner: umbenennen, löschen
// (mit Rückfrage). Neue Orte entstehen in Planung über „als Ort speichern“.
export default function PlacesPanel({ data, updateData }: { data: AppData; updateData: (fn: (d: AppData) => void) => void }) {
  const [confirm, setConfirm] = useState<number | null>(null);
  const places = data.places || [];
  if (!places.length) {
    return <p className="about-text">Noch keine Orte gespeichert. In „Planung“ eine Adresse wählen und „als Ort speichern“ antippen.</p>;
  }
  return (
    <div className="places">
      {places.map((p, i) => (
        <div className="place-row" key={`${p.name}-${i}`}>
          <input
            type="text"
            aria-label="Name des Ortes"
            value={p.name}
            maxLength={40}
            onChange={(e) =>
              updateData((d) => {
                d.places[i].name = e.target.value;
              })
            }
          />
          <span className="place-label">{p.label}</span>
          {confirm === i ? (
            <span className="place-confirm">
              Löschen?
              <button
                type="button"
                className="dev-btn dev-btn-small dev-btn-danger"
                onClick={() => {
                  updateData((d) => {
                    d.places.splice(i, 1);
                  });
                  setConfirm(null);
                }}
              >
                Ja
              </button>
              <button type="button" className="dev-btn dev-btn-small dev-btn-ghost" onClick={() => setConfirm(null)}>
                Nein
              </button>
            </span>
          ) : (
            <button type="button" className="dev-btn dev-btn-small dev-btn-ghost" onClick={() => setConfirm(i)}>
              Löschen
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
