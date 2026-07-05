"use client";

import { useState } from "react";
import { emptyRow, isEmptyRow, maybeAutofillPreis, monthKeyFromDate } from "@/lib/data";
import type { AppData, ChargeRow } from "@/lib/types";
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
  const [open, setOpen] = useState(false);

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
    setOpen(false);
  };

  return (
    <>
      <button type="button" className="fab" title="Ladevorgang eintragen" onClick={() => setOpen(true)}>
        +
      </button>

      {open && (
        <EntryFormModal
          title="Ladevorgang eintragen"
          initial={emptyRow()}
          cardOptions={data.cardsList}
          cardTarife={data.cardTarife}
          onSave={save}
          onClose={() => setOpen(false)}
          showToast={showToast}
        />
      )}
    </>
  );
}
