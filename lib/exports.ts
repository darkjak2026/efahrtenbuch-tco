"use client";

import { MONTHS, vehicleFullLabel } from "./constants";
import { computeMonthStatement, fmtEUR, fmtNum, householdStats, parseNum, vehicleStats, migrate } from "./data";
import type { AppData } from "./types";

declare global {
  interface Window {
    XLSX: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    jspdf: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJson(data: AppData) {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(JSON.stringify(data, null, 2), `eFahrtenbuchTCO_Sicherung_${stamp}.json`, "application/json");
}

export function importJson(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        resolve(migrate(JSON.parse(evt.target?.result as string)));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function exportPdf(data: AppData, activeMonth: string): boolean {
  if (!window.jspdf) return false;
  const st = computeMonthStatement(data, activeMonth);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Kontenübersicht — ${st.label} ${st.jahr}`, 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("eFahrtenbuch⚡TCO · Familie Liese-Held", 14, 24);

  doc.autoTable({
    startY: 30,
    head: [["Datum", "Fahrzeug", "Karte", "Station", "Akku %", "Dauer", "kWh", "Preis €", "km-Stand"]],
    body: st.rows.map((r) => [
      r.datum || "",
      (r.fahrzeug || "").toUpperCase(),
      r.karte || "",
      r.ladestation || "",
      r.akkuVorher || r.akkuNachher ? `${r.akkuVorher || "?"}→${r.akkuNachher || "?"}` : "",
      r.dauer || "",
      r.kwh ? fmtNum(parseNum(r.kwh)) : "",
      r.preis ? fmtEUR(parseNum(r.preis)) : "",
      r.km || "",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [53, 40, 73] },
  });

  let y = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Zusammenfassung", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const lines: [string, string][] = [
    [`Geladene Energie`, `${fmtNum(st.kwh)} kWh`],
    [`Ladekosten`, fmtEUR(st.ladekosten)],
    ...st.fixcosts.map((f) => [f.label, fmtEUR(f.betrag)] as [string, string]),
    ...st.investThisMonth.map((f) => [f.label, fmtEUR(f.betrag)] as [string, string]),
    [`Gesamtkosten Monat`, fmtEUR(st.gesamtMonat)],
    [`km B10 diesen Monat`, st.kmInfo.b10 !== null ? fmtNum(st.kmInfo.b10, 0) + " km" : "keine Daten"],
    [`km T03 diesen Monat`, st.kmInfo.t03 !== null ? fmtNum(st.kmInfo.t03, 0) + " km" : "keine Daten"],
    [`€/km diesen Monat (Haushalt)`, st.eurProKm !== null ? fmtNum(st.eurProKm, 3) + " €/km" : "keine Daten"],
  ];
  lines.forEach(([l, v]) => {
    doc.text(l, 14, y);
    doc.text(v, 150, y, { align: "right" });
    y += 6;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Hinweis: Fixkosten werden ab ihrem jeweiligen Startdatum voll für den Monat angesetzt (keine Tages-Proration). Investitionen werden über 36 Monate abgeschrieben (Betrag/36 pro Monat). km-Berechnung basiert auf den zuletzt erfassten km-Ständen bis Monatsende.",
    14,
    290,
    { maxWidth: 180 }
  );

  doc.save(`Kontenuebersicht_${st.label}_${st.jahr}.pdf`);
  return true;
}

export function exportXlsx(data: AppData): boolean {
  if (!window.XLSX) return false;
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  MONTHS.forEach((m) => {
    const rows = data.months[m.key] || [];
    const sheetData = [
      ["Datum", "Fahrzeug", "Ladekarte", "Ladestation", "Akku vorher %", "Akku nachher %", "Dauer", "kWh", "Preis €", "km-Stand"],
    ];
    rows.forEach((r) =>
      sheetData.push([
        r.datum,
        r.fahrzeug,
        r.karte,
        r.ladestation,
        r.akkuVorher ? String(parseNum(r.akkuVorher)) : "",
        r.akkuNachher ? String(parseNum(r.akkuNachher)) : "",
        r.dauer,
        String(parseNum(r.kwh)),
        String(parseNum(r.preis)),
        r.km ? String(parseNum(r.km)) : "",
      ])
    );
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, m.label.slice(0, 31));
  });

  const overviewData: (string | number)[][] = [
    ["Monat", "kWh", "Ladekosten €", "Fixkosten €", "Investitionen €", "Gesamtkosten €", "km B10", "km T03", "€/km Haushalt"],
  ];
  MONTHS.forEach((m) => {
    const st = computeMonthStatement(data, m.key);
    overviewData.push([
      `${st.label} ${st.jahr}`,
      st.kwh,
      st.ladekosten,
      st.fixSum,
      st.investSum,
      st.gesamtMonat,
      st.kmInfo.b10 !== null ? st.kmInfo.b10 : "",
      st.kmInfo.t03 !== null ? st.kmInfo.t03 : "",
      st.eurProKm !== null ? Number(st.eurProKm.toFixed(3)) : "",
    ]);
  });
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, wsOverview, "Kontenübersicht");

  const b10 = vehicleStats(data, "b10");
  const t03 = vehicleStats(data, "t03");
  const house = householdStats(data, b10, t03);
  const tcoData = [
    ["Bereich", "Ladekosten €", "Leasing+Vers. €", "Wiederk. Kosten €", "Investitionen €", "TCO gesamt €", "km-Stand", "€/km"],
    [
      vehicleFullLabel("b10"),
      b10.ladekosten,
      b10.leasingKosten + b10.versicherungKosten,
      b10.recurringKosten,
      b10.investKosten,
      b10.tco,
      b10.kmStand,
      b10.kmStand > 0 ? Number((b10.tco / b10.kmStand).toFixed(3)) : "",
    ],
    [
      vehicleFullLabel("t03"),
      t03.ladekosten,
      t03.leasingKosten + t03.versicherungKosten,
      t03.recurringKosten,
      t03.investKosten,
      t03.tco,
      t03.kmStand,
      t03.kmStand > 0 ? Number((t03.tco / t03.kmStand).toFixed(3)) : "",
    ],
    [
      "Haushalt gesamt",
      b10.ladekosten + t03.ladekosten,
      b10.leasingKosten + b10.versicherungKosten + (t03.leasingKosten + t03.versicherungKosten),
      house.recurring,
      b10.investKosten + t03.investKosten + house.investHaushalt,
      house.tco,
      house.kmStand,
      house.kmStand > 0 ? Number((house.tco / house.kmStand).toFixed(3)) : "",
    ],
  ];
  const wsTco = XLSX.utils.aoa_to_sheet(tcoData);
  XLSX.utils.book_append_sheet(wb, wsTco, "TCO Gesamt");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `eFahrtenbuchTCO_Export_${stamp}.xlsx`);
  return true;
}
