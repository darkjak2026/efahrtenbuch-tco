"use client";

import { useState } from "react";
import { todayStr, VEHICLES } from "@/lib/constants";
import { emptyRow, isEmptyRow, maybeAutofillPreis, monthKeyFromDate } from "@/lib/data";
import type { AppData, ChargeRow, VehicleKey } from "@/lib/types";
import EntryFormModal from "./EntryFormModal";

type OpenRequest = { vehicle: VehicleKey; section: "vor" | "nach" };

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
  const [openRequest, setOpenRequest] = useState<OpenRequest | null>(null);

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
    setOpenRequest(null);
  };

  return (
    <>
      <div className="fab-group">
        {(Object.keys(VEHICLES) as VehicleKey[]).map((key) => (
          <div className="fab-vehicle-row" key={key}>
            <button
              type="button"
              className="fab fab-section"
              title={`Ladevorgang für ${VEHICLES[key].nickname} (${key.toUpperCase()}) eintragen — Vor dem Laden`}
              onClick={() => setOpenRequest({ vehicle: key, section: "vor" })}
            >
              {key.toUpperCase()} – Vor
            </button>
            <button
              type="button"
              className="fab fab-section"
              title={`Ladevorgang für ${VEHICLES[key].nickname} (${key.toUpperCase()}) eintragen — Nach dem Laden`}
              onClick={() => setOpenRequest({ vehicle: key, section: "nach" })}
            >
              {key.toUpperCase()} – Nach
            </button>
          </div>
        ))}
      </div>

      {openRequest && (
        <EntryFormModal
          initial={{ ...emptyRow(), datum: todayStr(), fahrzeug: openRequest.vehicle }}
          data={data}
          cardOptions={data.cardsList}
          cardTarife={data.cardTarife}
          autoLocate
          defaultSection={openRequest.section}
          onSave={save}
          onClose={() => setOpenRequest(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}
