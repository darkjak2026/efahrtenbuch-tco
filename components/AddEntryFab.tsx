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
  // Which vehicle's "+ B10"/"+ T03" was tapped — reveals its Vor/Nach sub-buttons.
  // Only one vehicle expanded at a time; tapping it again collapses it back.
  const [expandedVehicle, setExpandedVehicle] = useState<VehicleKey | null>(null);

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

  const openFor = (vehicle: VehicleKey, section: "vor" | "nach") => {
    setOpenRequest({ vehicle, section });
    setExpandedVehicle(null);
  };

  return (
    <>
      <div className="fab-group">
        {(Object.keys(VEHICLES) as VehicleKey[])
          .filter((key) => expandedVehicle === null || expandedVehicle === key)
          .map((key) => (
            <div className="fab-vehicle-block" key={key}>
              <button
                type="button"
                className="fab"
                title={`Ladevorgang für ${VEHICLES[key].nickname} (${key.toUpperCase()}) eintragen`}
                onClick={() => setExpandedVehicle(expandedVehicle === key ? null : key)}
              >
                + {key.toUpperCase()}
              </button>
              {expandedVehicle === key && (
                <div className="fab-vehicle-row">
                  <button type="button" className="fab fab-section fab-section-vor" onClick={() => openFor(key, "vor")}>
                    Vor
                  </button>
                  <button type="button" className="fab fab-section fab-section-nach" onClick={() => openFor(key, "nach")}>
                    Nach
                  </button>
                </div>
              )}
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
