"use client";

import { useRef } from "react";
import { exportJson, exportPdf, exportXlsx, importJson } from "@/lib/exports";
import type { AppData } from "@/lib/types";

export default function ExportPanel({
  data,
  activeMonth,
  updateData,
  showToast,
  testMode = false,
}: {
  data: AppData;
  activeMonth: string;
  updateData: (fn: (d: AppData) => void) => void;
  showToast: (msg: string) => void;
  testMode?: boolean;
}) {
  const importFileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="toolbar" style={{ justifyContent: "flex-end" }}>
        <span className="export-label">Ausgabeformat wählen</span>
        <div className="export-btn-row">
          <button
            className="btn btn-ghost"
            title="Kontenübersicht des aktuellen Monats als PDF herunterladen"
            onClick={() => {
              const ok = exportPdf(data, activeMonth, testMode);
              showToast(ok ? "PDF erzeugt" : "PDF-Bibliothek konnte nicht geladen werden (Internetverbindung prüfen)");
            }}
          >
            📄 PDF
          </button>
          <button
            className="btn btn-ghost"
            title="Alle Monate, Kontenübersicht und TCO als Excel-Datei herunterladen"
            onClick={() => {
              const ok = exportXlsx(data, testMode);
              showToast(ok ? "Excel-Datei erzeugt" : "Excel-Bibliothek konnte nicht geladen werden (Internetverbindung prüfen)");
            }}
          >
            📊 Excel
          </button>
        </div>
      </div>

      <div className="io-bar">
        <button
          className="btn btn-ghost"
          onClick={() => {
            exportJson(data, testMode);
            showToast("Sicherung heruntergeladen");
          }}
        >
          Alle Daten sichern (JSON)
        </button>
        <button className="btn btn-ghost" onClick={() => importFileRef.current?.click()}>
          Sicherung einlesen
        </button>
        <input
          type="file"
          id="importFile"
          accept="application/json"
          ref={importFileRef}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const imported = await importJson(file);
              updateData((d) => Object.assign(d, imported));
              showToast("Sicherung eingelesen");
            } catch {
              showToast("Datei konnte nicht gelesen werden");
            }
            e.target.value = "";
          }}
        />
        <p className="io-note">
          Alle Eingaben (Ladeprotokoll, Fixkosten, Ladekarten, wiederkehrende Kosten, Investitionen) werden online
          gespeichert. Zusätzlich lässt sich hier jederzeit eine JSON-Sicherung als Notfall-Kopie herunterladen.
        </p>
      </div>
    </>
  );
}
