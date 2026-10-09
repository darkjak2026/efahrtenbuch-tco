"use client";

import { useEffect, useRef, useState } from "react";
import { todayStr, VEHICLES } from "@/lib/constants";
import {
  completionMessage,
  emptyRow,
  hasNachValues,
  isEmptyRow,
  laufzeitText,
  maybeAutofillPreis,
  monthKeyFromDate,
  offeneLadevorgaenge,
  type OffenerLadevorgang,
} from "@/lib/data";
import type { AppData, ChargeRow, VehicleKey } from "@/lib/types";
import EntryFormModal from "./EntryFormModal";

// Schnellwahl B10 / t03. Ist bei einem Auto ein Ladevorgang offen (unvollständig),
// pulsiert sein Knopf rot und zeigt Akku + Laufzeit (Variante C); über dem Menü steht
// je Auto eine Zeile „Laden abschließen!“ mit der Startzeit. Antippen öffnet den
// neuesten offenen Ladevorgang direkt in „Nach“, langes Drücken startet einen neuen.

const LONG_PRESS_MS = 600;
const ORDER: VehicleKey[] = ["b10", "t03"];
const kurz = (v: VehicleKey) => (v === "t03" ? "t03" : "B10");

type Offen = { vehicle: VehicleKey; ziel: OffenerLadevorgang; anzahl: number };

export default function AddEntryFab({
  data,
  activeMonth,
  updateData,
  setActiveMonth,
  showToast,
  onEntryCompleted,
  versteckt = false,
}: {
  data: AppData;
  activeMonth: string;
  updateData: (fn: (d: AppData) => void) => void;
  setActiveMonth: (key: string) => void;
  showToast: (msg: string) => void;
  onEntryCompleted: (row: ChargeRow) => void;
  // Auf der Planungsseite ausgeblendet (dort wird nicht geladen, die Knöpfe verdecken sonst das Ergebnis)
  versteckt?: boolean;
}) {
  const [openVehicle, setOpenVehicle] = useState<VehicleKey | null>(null);
  const [editing, setEditing] = useState<OffenerLadevorgang | null>(null);
  // Laufzeit am Knopf jede halbe Minute neu
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const offen: Offen[] = ORDER.flatMap((v) => {
    const list = offeneLadevorgaenge(data, v);
    return list.length ? [{ vehicle: v, ziel: list[0], anzahl: list.length }] : [];
  });
  const offenFuer = (v: VehicleKey) => offen.find((o) => o.vehicle === v) ?? null;

  const save = (form: ChargeRow) => {
    const row: ChargeRow = { ...form };
    maybeAutofillPreis(row);
    const targetMonth = monthKeyFromDate(row.datum) ?? activeMonth;

    updateData((d) => {
      const rows = d.months[targetMonth];
      const emptyIdx = rows.findIndex(isEmptyRow);
      if (emptyIdx !== -1) rows[emptyIdx] = row;
      else rows.push(row);
    });

    if (targetMonth !== activeMonth) setActiveMonth(targetMonth);
    if (hasNachValues(row)) {
      showToast(completionMessage());
      onEntryCompleted(row);
    } else {
      showToast("Ladevorgang eingetragen");
    }
    setOpenVehicle(null);
  };

  // Offenen Ladevorgang nachtragen: an derselben Stelle ersetzen (Monat + Position)
  const saveEdit = (form: ChargeRow) => {
    if (!editing) return;
    const row: ChargeRow = { ...form };
    maybeAutofillPreis(row);
    const { monthKey, idx } = editing;
    const target = monthKeyFromDate(row.datum) ?? monthKey;
    updateData((d) => {
      if (target === monthKey) d.months[monthKey][idx] = row;
      else {
        d.months[monthKey].splice(idx, 1);
        d.months[target].push(row);
      }
    });
    if (hasNachValues(row)) {
      showToast(completionMessage());
      onEntryCompleted(row);
    } else {
      showToast("Ladevorgang gespeichert");
    }
    setEditing(null);
  };

  const deleteEdit = () => {
    if (!editing) return;
    const { monthKey, idx } = editing;
    updateData((d) => {
      d.months[monthKey].splice(idx, 1);
    });
    showToast("Ladevorgang gelöscht");
    setEditing(null);
  };

  // Antippen = offenen Ladevorgang nachtragen (sonst neuer), lange drücken = immer neuer
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const startPress = (v: VehicleKey) => {
    longPressed.current = false;
    if (!offenFuer(v)) return;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setOpenVehicle(v);
    }, LONG_PRESS_MS);
  };
  const endPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const tap = (v: VehicleKey) => {
    if (longPressed.current) return;
    const o = offenFuer(v);
    if (o) setEditing(o.ziel);
    else setOpenVehicle(v);
  };

  return (
    <>
      <div className={"fab-group" + (offen.length ? ` fab-group-offen-${offen.length}` : "")} hidden={versteckt}>
        {ORDER.map((key) => {
          const o = offenFuer(key);
          const zeit = o ? laufzeitText(o.ziel.row, now) : null;
          return (
            <button
              type="button"
              key={key}
              className={`fab fab-${key}` + (o ? " fab-offen" : "")}
              title={
                o
                  ? `${VEHICLES[key].nickname}: Laden abschließen (antippen) – lange drücken für einen neuen Ladevorgang`
                  : `Ladevorgang für ${VEHICLES[key].nickname} (${key.toUpperCase()}) eintragen`
              }
              aria-label={o ? `${kurz(key)}: Laden abschließen` : undefined}
              onPointerDown={() => startPress(key)}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onPointerCancel={endPress}
              onContextMenu={(e) => o && e.preventDefault()}
              onClick={() => tap(key)}
            >
              {o ? (
                <span className="fab-offen-inhalt">
                  <span className="fab-akku" aria-hidden="true">
                    <i />
                  </span>
                  {zeit && <span className="fab-zeit">{zeit}</span>}
                  {o.anzahl > 1 && <span className="fab-anzahl">{o.anzahl}</span>}
                </span>
              ) : key === "t03" ? (
                "t03"
              ) : (
                key.toUpperCase()
              )}
            </button>
          );
        })}
      </div>

      {offen.length > 0 && !versteckt && (
        <div className="abschluss" role="region" aria-label="Offene Ladevorgänge">
          {offen.map((o) => (
            <button type="button" key={o.vehicle} className={`abschluss-zeile abschluss-${o.vehicle}`} onClick={() => setEditing(o.ziel)}>
              <span>
                {kurz(o.vehicle)} · <b>Laden abschließen!</b>
              </span>
              <span className="abschluss-start">
                {o.ziel.row.start ? `Start ${o.ziel.row.start}` : `vom ${o.ziel.row.datum.split("-").reverse().slice(0, 2).join(".")}.`} ▸
              </span>
            </button>
          ))}
        </div>
      )}

      {openVehicle && (
        <EntryFormModal
          initial={{ ...emptyRow(), datum: todayStr(), fahrzeug: openVehicle }}
          data={data}
          cardOptions={data.cardsList}
          autoLocate
          defaultSection="vor"
          onSave={save}
          onClose={() => setOpenVehicle(null)}
          showToast={showToast}
        />
      )}

      {editing && (
        <EntryFormModal
          initial={editing.row}
          data={data}
          cardOptions={data.cardsList}
          defaultSection="nach"
          onSave={saveEdit}
          onDelete={deleteEdit}
          onClose={() => setEditing(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}
