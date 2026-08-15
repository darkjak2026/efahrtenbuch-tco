"use client";

import { useState } from "react";
import { todayStr, VEHICLES } from "@/lib/constants";
import { emptyRow, isEmptyRow, maybeAutofillPreis, monthKeyFromDate } from "@/lib/data";
import type { AppData, ChargeRow, VehicleKey } from "@/lib/types";
import EntryFormModal from "./EntryFormModal";

export default function AddEntryFab({
  data,
  activeMonth,
  updateData,
  setActiveMonth,
  showToast,
}: {
  data: AppData;
  activeMonth: string;
  updateData: (fn: (d: AppData) => void) => void;
  setActiveMonth: (key: string) => void;
  showToast: (msg: string) => void;
}) {
  const [openVehicle, setOpenVehicle] = useState<VehicleKey | null>(null);

  const save = (form: ChargeRow) => {
    const row: ChargeRow = { ...form };
    maybeAutofillPreis(data.cardTarife, row);
    const targetMonth = monthKeyFromDate(row.datum) ?? activeMonth;

    updateData((d) => {
      const rows = d.months[targetMonth];
      const emptyIdx = rows.findIndex(isEmptyRow);
      if (emptyIdx !== -1) rows[emptyIdx] = row;
      else rows.push(row);
    });

    if (targetMonth !== activeMonth) setActiveMonth(targetMonth);
    showToast("Ladevorgang eingetragen");
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
            + {key.toUpperCase()}
          </button>
        ))}
      </div>

      {openVehicle && (
        <EntryFormModal
          action="eintragen"
          initial={{ ...emptyRow(), datum: todayStr(), fahrzeug: openVehicle }}
          data={data}
          cardOptions={data.cardsList}
          cardTarife={data.cardTarife}
          autoLocate
          onSave={save}
          onClose={() => setOpenVehicle(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}
