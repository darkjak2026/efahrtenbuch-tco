"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearStoredPin, fetchData, getStoredPin, postData, storePin } from "@/lib/client-api";
import { defaultData, visibleMonths } from "@/lib/data";
import { generateTestData } from "@/lib/testData";
import type { AppData, ChargeRow } from "@/lib/types";
import PinGate from "./PinGate";
import TcoPanel from "./TcoPanel";
import FixedCostsPanel from "./FixedCostsPanel";
import CardsPanel from "./CardsPanel";
import InvestmentsPanel from "./InvestmentsPanel";
import MonthNav from "./MonthNav";
import ChargeTable from "./ChargeTable";
import AddEntryFab from "./AddEntryFab";
import ExportPanel from "./ExportPanel";
import Footer from "./Footer";
import Collapsible from "./Collapsible";
import { CardIcon, ToolboxIcon, ReceiptIcon, ExportBoxIcon, InfoIcon } from "./Icons";
import { currentMonthKey } from "@/lib/constants";

type Status = "gate" | "loading" | "ready";

export default function AppClient() {
  const [status, setStatus] = useState<Status>("gate");
  const [pin, setPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [data, setData] = useState<AppData>(defaultData());
  const [activeMonth, setActiveMonth] = useState(() => currentMonthKey());
  const [testMode, setTestMode] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const [pinLockedUntil, setPinLockedUntil] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [celebrateRow, setCelebrateRow] = useState<ChargeRow | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);
  // Set while a change is debounced/in flight to Redis, cleared once it lands
  // (or is known lost via a conflict) - beforeunload below warns only then,
  // not on every stale leftover timer id.
  const unsavedRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrateShowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrateClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedPinAttempts = useRef(0);
  const pinLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // The reward for finishing a Nach-Erfassung: the dialog has already closed by
  // the time this fires, so the glow/confetti lands on the entry as it settles
  // into its spot in the Lade-Historie instead of racing the close animation.
  const celebrateCompletion = useCallback((row: ChargeRow) => {
    if (celebrateShowTimer.current) clearTimeout(celebrateShowTimer.current);
    if (celebrateClearTimer.current) clearTimeout(celebrateClearTimer.current);
    celebrateShowTimer.current = setTimeout(() => {
      setCelebrateRow(row);
      celebrateClearTimer.current = setTimeout(() => setCelebrateRow(null), 1800);
    }, 2000);
  }, []);

  const authenticate = useCallback(async (candidatePin: string) => {
    if (pinLockedUntil && Date.now() < pinLockedUntil) return;
    setPinBusy(true);
    setPinError(null);
    try {
      const result = await fetchData(candidatePin);
      if (result.ok && result.data) {
        failedPinAttempts.current = 0;
        storePin(candidatePin);
        setPin(candidatePin);
        skipNextSave.current = true;
        setData(result.data);
        setStatus("ready");
      } else if (result.status === 401) {
        clearStoredPin();
        failedPinAttempts.current += 1;
        // Nur eine leichte, clientseitige Bremse gegen wiederholtes Vertippen -
        // kein Ersatz für echten Schutz, aber genug gegen versehentliches
        // Dauer-Antippen der falschen Ziffernfolge.
        if (failedPinAttempts.current >= 5) {
          const until = Date.now() + 30000;
          setPinLockedUntil(until);
          setPinError("Zu viele Fehlversuche — bitte 30 Sekunden warten");
          if (pinLockTimer.current) clearTimeout(pinLockTimer.current);
          pinLockTimer.current = setTimeout(() => {
            setPinLockedUntil(null);
            failedPinAttempts.current = 0;
          }, 30000);
        } else {
          setPinError("PIN falsch");
        }
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
  }, [pinLockedUntil]);

  useEffect(() => {
    // ?testmode=1 skips the PIN gate and loads a full fictional dataset spanning
    // the whole leasing period, purely in memory - never sent to Redis (see the
    // save effect below). Safe to try even on the live URL: nothing real is ever
    // touched or exposed, since the data shown is entirely made up.
    if (new URLSearchParams(window.location.search).get("testmode") === "1") {
      skipNextSave.current = true;
      queueMicrotask(() => {
        setData(generateTestData());
        setTestMode(true);
        setStatus("ready");
      });
      return;
    }
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
    if (testMode) return; // fiktive Testdaten werden nie gespeichert
    if (status !== "ready" || !pin) return;
    // Ein erkannter Konflikt (siehe unten) stoppt weitere automatische
    // Speicherversuche - die lokalen Daten sind ab dann bekanntermaßen
    // veraltet, ein weiterer Versuch würde nur denselben Konflikt erneut
    // auslösen, ohne dass die Nutzerin etwas davon mitbekommt.
    if (saveConflict) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    unsavedRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const result = await postData(pin, data);
      if (result.ok) {
        // Nur die vom Server bestätigte Versionsnummer übernehmen (nicht das
        // ganze Objekt ersetzen) - falls währenddessen schon weiterbearbeitet
        // wurde, bleiben diese neueren Änderungen erhalten, zählen aber ab
        // jetzt korrekt gegen die neue Server-Version statt einen Konflikt
        // mit dem eigenen, gerade erfolgreichen Speichervorgang zu erzeugen.
        unsavedRef.current = false;
        skipNextSave.current = true;
        setData((prev) => (prev._rev === data._rev ? { ...prev, _rev: result.data._rev } : prev));
      } else if (result.conflict) {
        // Die Änderung ist bekanntermaßen nicht angekommen - das rote Banner
        // bleibt sichtbar, bis neu geladen wird; ein beforeunload-Hinweis
        // würde hier nichts zusätzlich retten.
        unsavedRef.current = false;
        setSaveConflict(true);
      } else {
        showToast("Speichern fehlgeschlagen — bitte Verbindung prüfen");
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, pin, status, testMode, saveConflict, showToast]);

  // Warnt vor dem Schließen/Neuladen des Tabs, solange eine Änderung noch nicht
  // bestätigt gespeichert ist (die 800ms-Debounce-Lücke oder ein laufender
  // Speicher-Request) - sonst geht ein Eintrag beim hastigen Wegtippen
  // kommentarlos verloren.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!unsavedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

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
    return (
      <PinGate
        onSubmit={authenticate}
        error={pinError}
        busy={pinBusy}
        locked={pinLockedUntil !== null}
      />
    );
  }

  return (
    <>
      {testMode && (
        <div className="testmode-banner">
          🧪 Testmodus — fiktive Daten für den gesamten Leasingzeitraum, es wird nichts gespeichert.
          <button type="button" onClick={() => { window.location.href = window.location.pathname; }}>
            Testmodus verlassen
          </button>
        </div>
      )}
      {saveConflict && (
        <div className="conflict-banner">
          ⚠️ Jemand anderes hat zwischenzeitlich auf einem anderen Gerät gespeichert. Deine letzten Änderungen hier
          wurden nicht übernommen, damit nichts überschrieben wird.
          <button type="button" onClick={() => window.location.reload()}>
            Seite neu laden
          </button>
        </div>
      )}
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js" strategy="afterInteractive" />

      <header className="top">
        <div className="header-cars" aria-hidden="true">
          <span className="header-car header-car-b10" />
          <span className="header-car header-car-t03" />
        </div>
        <h1>
          <img src="/header-icon.ico" alt="" className="header-icon" />
          TCO - Leapmotor
        </h1>
      </header>

      <main>
        {/* Zweigeteilte Ansicht: links alles zum B10, rechts zum t03. Nur die
            Monatsnavigation schwebt über beiden Hälften. */}
        <section className="split-section">
          <TcoPanel data={data} />
        </section>

        <section className="split-section history">
          <MonthNav activeMonth={activeMonth} months={visibleMonths(data)} onChange={setActiveMonth} />
          <ChargeTable
            data={data}
            activeMonth={activeMonth}
            updateData={updateData}
            setActiveMonth={setActiveMonth}
            showToast={showToast}
            celebrateRow={celebrateRow}
            onEntryCompleted={celebrateCompletion}
          />
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
            <p className="about-text">
              Darunter zählt der Leasing-Countdown die Freikilometer herunter (Freikilometer pro Jahr ×
              Laufzeit, minus gefahrene km seit Übergabe). Der Strich im Balken zeigt, wo ihr zeitanteilig
              stehen dürftet; „über Plan“ heißt, ihr fahrt mehr, als gleichmäßig verteilt vorgesehen.
            </p>
            <p className="about-text">
              In der Lade-Historie (links B10, rechts t03; Monat per ◀ ▶, Wischen oder Antippen des
              Monatsnamens) gilt der TCO je km nur für den gewählten Monat: alle Kosten dieses Monats geteilt
              durch die im Monat gefahrenen km. Abos „Beide (50/50)“ zählen je zur Hälfte, Kosten ohne
              Fahrzeug nur im Haushaltswert.
            </p>
            <p className="about-text">
              Der Ring je Auto zeigt, woraus die Monatskosten bestehen (Stecker = Laden, Bank = Leasing,
              Schild = Versicherung, € mit Uhr = Abos, Werkzeugkasten = Investitionen). Die Pfeile daneben zeigen
              den Trend gegenüber dem Durchschnitt der letzten 3 Monate (waagerecht = gleich, je 5 % 10° steiler,
              hoch = teurer). Ein Segment antippen zeigt dessen Wert in der Mitte, die Mitte antippen öffnet die
              Statistik mit Vormonat, Minimum und Maximum.
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
            <ExportPanel
              data={data}
              activeMonth={activeMonth}
              updateData={updateData}
              showToast={showToast}
              testMode={testMode}
            />
          </Collapsible>
        </section>
      </main>

      <Footer data={data} updateData={updateData} />

      <AddEntryFab
        data={data}
        activeMonth={activeMonth}
        updateData={updateData}
        setActiveMonth={setActiveMonth}
        showToast={showToast}
        onEntryCompleted={celebrateCompletion}
      />

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </>
  );
}
