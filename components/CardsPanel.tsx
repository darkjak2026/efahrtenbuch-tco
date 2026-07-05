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
              <span className="tarif-input-wrap">
                <input
                  type="number"
                  step="0.01"
                  title="Optionaler Tarif in €/kWh für automatische Preisvorschläge"
                  value={data.cardTarife[c] ?? ""}
                  onChange={(e) => updateData((d) => { d.cardTarife[c] = e.target.value; })}
                />
                <span className="unit-suffix">€/kWh</span>
              </span>
              <button
                type="button"
                className="mini-del"
                title="Karte entfernen"
                onClick={() =>
                  updateData((d) => {
                    d.cardsList = d.cardsList.filter((x) => x !== c);
                    delete d.cardTarife[c];
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
        Optionaler €/kWh-Tarif pro Karte (z.B. für &quot;Zuhause&quot;): wird beim Ausfüllen einer Ladezeile
        automatisch als Preisvorschlag genutzt, sobald kWh eingetragen ist und das Preisfeld noch leer ist —
        überschreibt nie einen bereits eingetragenen Preis.
      </p>
    </>
  );
}
