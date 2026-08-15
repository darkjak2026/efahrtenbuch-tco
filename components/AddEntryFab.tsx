"use client";

import { useState } from "react";
import { todayStr, VEHICLES } from "@/lib/constants";
import { completionMessage, emptyRow, hasNachValues, isEmptyRow, maybeAutofillPreis, monthKeyFromDate } from "@/lib/data";
import type { AppData, ChargeRow, VehicleKey } from "@/lib/types";
import EntryFormModal from "./EntryFormModal";

export default function AddEntryFab({
  data,
  activeMonth,
  updateData,
  setActiveMonth,
  showToast,
  onEntryCompleted,
}: {
  data: AppData;
  activeMonth: string;
  updateData: (fn: (d: AppData) => void) => void;
  setActiveMonth: (key: string) => void;
  showToast: (msg: string) => void;
  onEntryCompleted: (row: ChargeRow) => void;
}) {
  const [openVehicle, setOpenVehicle] = useState<VehicleKey | null>(null);

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

  return (
    <>
      <div className="fab-group">
        {(Object.keys(VEHICLES) as VehicleKey[]).map((key) => (
          <button
            type="button"
            key={key}
            className="fab"
            title={`Ladevorgang für ${VEHICLES[key].nickname} (${key.toUpperCase()}) eintragen`}
            onClick={() => setOpenVehicle(key)}
          >
            {key === "t03" ? "t03" : key.toUpperCase()}
          </button>
        ))}
      </div>

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
    </>
  );
}
