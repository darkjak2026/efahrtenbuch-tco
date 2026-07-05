"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearStoredPin, fetchData, getStoredPin, postData, storePin } from "@/lib/client-api";
import { defaultData } from "@/lib/data";
import type { AppData } from "@/lib/types";
import PinGate from "./PinGate";
import TcoPanel from "./TcoPanel";
import FixedCostsPanel from "./FixedCostsPanel";
import MonthTabs from "./MonthTabs";
import ChargeTable from "./ChargeTable";
import { MONTHS } from "@/lib/constants";

type Status = "gate" | "loading" | "ready";

export default function AppClient() {
  const [status, setStatus] = useState<Status>("gate");
  const [pin, setPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [data, setData] = useState<AppData>(defaultData());
  const [activeMonth, setActiveMonth] = useState(MONTHS[0].key);
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
        <p className="eyebrow">Familie Liese-Held · Halle (Saale)</p>
        <h1>eFahrtenbuch⚡TCO</h1>
        <p className="sub" style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.85 }}>
          Total Cost of Ownership für B10 &amp; T03
        </p>
        <div className="fleet">
          <span>
            <i className="dot b10"></i> B10 — Dawn Purple
          </span>
          <span>
            <i className="dot t03"></i> T03 — Glacier Blue
          </span>
          <span>
            <i className="dot house"></i> Haushalt gesamt
          </span>
        </div>
      </header>

      <main>
        <section className="tco">
          <h2 className="section-title">
            TCO &amp; Preis pro Kilometer{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-soft)", fontSize: 13 }}>
              — läuft fortlaufend seit Erfassungsstart
            </span>
          </h2>
          <TcoPanel data={data} />
          <FixedCostsPanel data={data} updateData={updateData} />
        </section>

        <MonthTabs activeMonth={activeMonth} onChange={setActiveMonth} />
        <section className="panel">
          <ChargeTable data={data} activeMonth={activeMonth} updateData={updateData} showToast={showToast} />
        </section>
      </main>

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </>
  );
}
