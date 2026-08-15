"use client";

import { useState } from "react";
import { cardBadge } from "@/lib/cardBadge";
import type { AppData } from "@/lib/types";

export default function CardsPanel({
  data,
  updateData,
}: {
  data: AppData;
  updateData: (fn: (d: AppData) => void) => void;
}) {
  const [newCardName, setNewCardName] = useState("");

  return (
    <>
      <div className="card-chip-list">
        {data.cardsList.map((c) => {
          const badge = cardBadge(c);
          return (
            <div className="card-chip-v2" key={c}>
              <span className="card-badge" style={{ background: badge.color }}>
                {badge.label}
              </span>
              <span className="card-chip-name">{c}</span>
              <button
                type="button"
                className="mini-del"
                title="Karte entfernen"
                onClick={() =>
                  updateData((d) => {
                    d.cardsList = d.cardsList.filter((x) => x !== c);
                  })
                }
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <div className="add-card-row">
        <input
          type="text"
          value={newCardName}
          onChange={(e) => setNewCardName(e.target.value)}
          placeholder="Neue Karte / Lademöglichkeit, z.B. Wallbox zuhause"
        />
        <button
          type="button"
          className="add-mini"
          onClick={() => {
            const name = newCardName.trim();
            if (!name) return;
            updateData((d) => {
              if (!d.cardsList.includes(name)) d.cardsList.push(name);
            });
            setNewCardName("");
          }}
        >
          + hinzufügen
        </button>
      </div>
      <p className="hint">
        Die genutzte Ladekarte wird pro Ladevorgang erfasst, dient aber nur noch statistischen Zwecken — der
        Preis wird beim Eintragen direkt über den €/kWh-Preis der jeweiligen Sitzung berechnet, unabhängig
        davon, welche Karte hier ausgewählt ist.
      </p>
    </>
  );
}
