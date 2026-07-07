"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearStoredPin, fetchData, getStoredPin, postData, storePin } from "@/lib/client-api";
import { defaultData } from "@/lib/data";
import type { AppData } from "@/lib/types";
import PinGate from "./PinGate";
import TcoPanel from "./TcoPanel";
import FixedCostsPanel from "./FixedCostsPanel";
import CardsPanel from "./CardsPanel";
import InvestmentsPanel from "./InvestmentsPanel";
import MonthTabs from "./MonthTabs";
import ChargeTable from "./ChargeTable";
import AddEntryFab from "./AddEntryFab";
import ExportPanel from "./ExportPanel";
import Footer from "./Footer";
import Collapsible from "./Collapsible";
import { PlugIcon, CardIcon, ToolboxIcon, ReceiptIcon, ExportBoxIcon, InfoIcon } from "./Icons";
import { currentMonthKey } from "@/lib/constants";

type Status = "gate" | "loading" | "ready";

export default function AppClient() {
  const [status, setStatus] = useState<Status>("gate");
  const [pin, setPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [data, setData] = useState<AppData>(defaultData());
  const [activeMonth, setActiveMonth] = useState(() => currentMonthKey());
  const [toast, setToast] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const authenticate = useCallback(async (candidatePin: string) => {
    setPinBusy(true);
    setPinError(null);
    try {
      const result = await fetchData(candidatePin);
      if (result.ok && result.data) {
        storePin(candidatePin);
        setPin(candidatePin);
        skipNextSave.current = true;
        setData(result.data);
        setStatus("ready");
      } else if (result.status === 401) {
        clearStoredPin();
        setPinError("PIN falsch");
        setStatus("gate");
      } else {
        setPinError("Verbindung fehlgeschlagen — bitte erneut versuchen");
        setStatus("gate");
      }
    } catch {
      setPinError("Verbindung fehlgeschlagen — bitte erneut versuchen");
      setStatus("gate");
    } finally {
      setPinBusy(false);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredPin();
    if (stored) {
      queueMicrotask(() => {
        setStatus("loading");
        authenticate(stored);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "ready" || !pin) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      postData(pin, data);
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, pin, status]);

  const updateData = useCallback((fn: (d: AppData) => void) => {
    setData((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  if (status === "loading") {
    return <div className="loading-screen">Lade…</div>;
  }

  if (status === "gate") {
    return <PinGate onSubmit={authenticate} error={pinError} busy={pinBusy} />;
  }

  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js" strategy="afterInteractive" />

      <header className="top">
        <h1>
          <img src="/header-icon.ico" alt="" className="header-icon" />
          TCO - Leapmotor
        </h1>
      </header>

      <main>
        <section className="tco">
          <TcoPanel data={data} />
        </section>

        <section className="tco history-toggle-wrap">
          <Collapsible
            title={
              <>
                <PlugIcon /> Lade-Historie
              </>
            }
            defaultOpen={false}
          >
            <MonthTabs activeMonth={activeMonth} onChange={setActiveMonth} />
            <section className="panel">
              <ChargeTable
                data={data}
                activeMonth={activeMonth}
                updateData={updateData}
                setActiveMonth={setActiveMonth}
                showToast={showToast}
              />
            </section>
          </Collapsible>
        </section>

        <section className="tco fixed-panel-card">
          <Collapsible
            title={
              <>
                <CardIcon /> Ladekarten verwalten
              </>
            }
            defaultOpen={false}
          >
            <CardsPanel data={data} updateData={updateData} />
          </Collapsible>
        </section>

        <section className="tco fixed-panel-card">
          <Collapsible
            title={
              <>
                <ReceiptIcon /> Fixkosten
              </>
            }
            defaultOpen={false}
          >
            <FixedCostsPanel data={data} updateData={updateData} />
          </Collapsible>
        </section>

        <section className="tco fixed-panel-card">
          <Collapsible
            title={
              <>
                <ToolboxIcon /> Investitionen
              </>
            }
            defaultOpen={false}
          >
            <InvestmentsPanel data={data} updateData={updateData} />
          </Collapsible>
        </section>

        <section className="tco about-card">
          <Collapsible
            title={
              <>
                <InfoIcon /> Anleitung
              </>
            }
            defaultOpen={false}
          >
            <p className="about-text" style={{ marginTop: 0 }}>
              Diese App erfasst eure Ladevorgänge für BIO-Leapy (Leapmotor B10) und Leapy (Leapmotor T03) und
              berechnet daraus laufend die tatsächlichen Kosten pro gefahrenem Kilometer (TCO = Total Cost of
              Ownership).
            </p>
            <p className="about-text">In den TCO-Preis je Fahrzeug fließen ein:</p>
            <ul className="about-text about-list">
              <li>Ladekosten aus den erfassten Ladevorgängen</li>
              <li>Leasingrate + Versicherung, anteilig seit dem Übergabedatum</li>
              <li>Wiederkehrende Kosten (Abos, Grundgebühren, …) — bei „Beide (50/50)“ je zur Hälfte</li>
              <li>Investitionen, abgeschrieben über 36 Monate Leasingdauer</li>
            </ul>
            <p className="about-text">
              Die Summe wird geteilt durch den Gesamt-km-Stand (höchster bekannter Wert aus Stichtag-km
              und erfassten km-Ständen) — daraus ergibt sich der €/km-TCO-Wert oben in den Kacheln.
            </p>
          </Collapsible>
        </section>

        <section className="tco export-panel-card">
          <Collapsible
            title={
              <>
                <ExportBoxIcon /> Exportieren aller Daten
              </>
            }
            defaultOpen={false}
          >
            <ExportPanel data={data} activeMonth={activeMonth} updateData={updateData} showToast={showToast} />
          </Collapsible>
        </section>
      </main>

      <Footer />

      <AddEntryFab
        data={data}
        activeMonth={activeMonth}
        updateData={updateData}
        setActiveMonth={setActiveMonth}
        showToast={showToast}
      />

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </>
  );
}
