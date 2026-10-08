"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DATE_RANGE_MIN, VEHICLES, vehicleShortLabel } from "@/lib/constants";
import {
  allRows,
  durationToMinutes,
  fmtNum,
  hasNachValues,
  minutesToDuration,
  monthKeyFromDate,
  parseNum,
  reichweiteColorClass,
  dateRangeMax,
} from "@/lib/data";
import { hasGeolocationPermission, locateStation } from "@/lib/gps";
import type { AppData, ChargeRow, VehicleKey } from "@/lib/types";
import {
  BatteryOutlineIcon,
  BoltIcon,
  CalendarIcon,
  CardIcon,
  CarIcon,
  ClockIcon,
  EuroIcon,
  LocationPinIcon,
  NoteIcon,
  PlugIcon,
  RoadIcon,
} from "./Icons";

// Eingabemaske (v2.38.00, Mockup "Kombination 2 + 5"): oben eine Plakette mit dem
// freigestellten Auto und einem Fortschrittsring, darunter Schritt für Schritt
// immer nur ein offenes Feld. "Vor" mit rot pulsierendem Rahmen (Aktion), "Nach"
// mit ruhig grün atmendem Rahmen (Entspannung), Hintergrund in der Farbe des Autos.

const HINT_ICONS = ["⚡", "🔌", "🚗", "🔋", "🛣️"];

type Section = "vor" | "nach";
type StepId = "rest" | "odo" | "cent" | "karte" | "kwh" | "dauer" | "rneu" | "notiz" | "preis";
const STEPS: Record<Section, StepId[]> = {
  vor: ["rest", "odo", "cent", "karte"],
  nach: ["kwh", "dauer", "rneu", "notiz", "preis"],
};
const SECTION_OF: Record<StepId, Section> = {
  rest: "vor", odo: "vor", cent: "vor", karte: "vor",
  kwh: "nach", dauer: "nach", rneu: "nach", notiz: "nach", preis: "nach",
};

// Konfetti-Fontäne beim Abschluss: Richtung, Weite und Drehung je Stück zufällig
type Piece = { id: number; color: string; vx: number; vy: number; rot: number; delay: number; duration: number };
const FONTAENE_FARBEN = ["var(--teal)", "var(--range-yellow)", "var(--b10)", "var(--t03)", "var(--danger)", "#ffffff"];
function makePieces(): Piece[] {
  return Array.from({ length: 46 }, (_, i) => {
    const w = (Math.random() - 0.5) * 1.2;
    const v = 360 + Math.random() * 240;
    return {
      id: i,
      color: FONTAENE_FARBEN[i % FONTAENE_FARBEN.length],
      vx: Math.round(Math.sin(w) * v),
      vy: Math.round(-Math.cos(w) * v),
      rot: Math.round((Math.random() - 0.5) * 900),
      delay: Math.round(Math.random() * 120),
      duration: 1200 + Math.round(Math.random() * 400),
    };
  });
}
const CELEBRATE_MS = 1500;

// Kosten pro kWh als Cent: "0," steht fest, getippt werden nur zwei Ziffern.
// Für Preise ab 1 €/kWh gibt es einen Umschalter auf die volle Euro-Eingabe.
function centDigits(preisProKwh: string): string {
  const v = parseNum(preisProKwh);
  if (!(v > 0) || v >= 1) return "";
  return String(Math.round(v * 100)).padStart(2, "0");
}

export default function EntryFormModal({
  initial,
  data,
  cardOptions,
  autoLocate = false,
  defaultSection = "vor",
  onSave,
  onDelete,
  onClose,
  showToast,
}: {
  initial: ChargeRow;
  data: AppData;
  cardOptions: string[];
  autoLocate?: boolean;
  defaultSection?: Section;
  onSave: (row: ChargeRow) => void;
  onDelete?: () => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const [form, setForm] = useState<ChargeRow>(initial);
  const [locating, setLocating] = useState(false);
  // Guards against a fast double-click/double-tap on "Speichern" creating a
  // duplicate entry. A ref (checked synchronously, before React re-renders)
  // is the actual guard; the state below only drives the visible disabled look.
  const submittedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [fontaene, setFontaene] = useState<Piece[] | null>(null);

  // The Android/browser "Zurück"-Geste otherwise leaves the whole app instead
  // of just closing this dialog. Push a dummy history entry while open and
  // treat popstate as a close; on a normal close (Speichern/Abbrechen/Löschen)
  // consume that same entry again so "Zurück" doesn't need an extra press.
  const closedByPopRef = useRef(false);
  useEffect(() => {
    window.history.pushState({ fabModal: true }, "");
    const onPopState = () => {
      closedByPopRef.current = true;
      onClose();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (!closedByPopRef.current) window.history.back();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only for brand-new entries (no onDelete → not editing a past, already-finished
  // row) does an "app just opened" timestamp mean anything as a charge start time.
  const isNewEntry = !onDelete;
  // Nur bis zum Ende des sichtbaren Zeitraums (spätestes Leasingende).
  const DATE_RANGE_MAX = dateRangeMax(data);
  const [openedAt] = useState(() => new Date());
  // The few minutes between opening the dialog and actually plugging in.
  const chargeStart = new Date(openedAt.getTime() + 3 * 60000);
  const chargeStartLabel = chargeStart.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  // On opening the add-entry form, silently try GPS — but only if permission
  // was already granted previously, so no permission prompt pops up unasked.
  // The manual locate button remains the fallback if this doesn't fire or fails.
  useEffect(() => {
    if (!autoLocate) return;
    let cancelled = false;
    hasGeolocationPermission().then((granted) => {
      if (!granted || cancelled) return;
      setLocating(true);
      locateStation(
        "",
        (result) => {
          if (cancelled) return;
          setLocating(false);
          setForm((f) =>
            f.ladestation ? f : { ...f, lat: result.lat, lon: result.lon, ladestation: result.ladestation }
          );
          showToast(result.toast);
        },
        () => {
          if (cancelled) return;
          setLocating(false);
        }
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [hintIcon] = useState(() => HINT_ICONS[Math.floor(Math.random() * HINT_ICONS.length)]);

  const patch = (fields: Partial<ChargeRow>) => setForm((f) => ({ ...f, ...fields }));

  // Preis = kWh × der für diese Sitzung eingetragene €/kWh-Preis — a pure derived
  // value, not effect-driven state. Shown live while the field is untouched; the
  // moment the user types their own number, form.preis stops being empty and their
  // value simply wins.
  const preisProKwhTarif = parseNum(form.preisProKwh);
  const autoPreis = (() => {
    if (preisProKwhTarif <= 0 || parseNum(form.kwh) <= 0) return null;
    return (parseNum(form.kwh) * preisProKwhTarif).toFixed(2);
  })();

  // One-shot "it just filled itself in" glow the moment autoPreis first appears.
  const [priceJustFilled, setPriceJustFilled] = useState(false);
  const prevAutoPreis = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevAutoPreis.current;
    prevAutoPreis.current = autoPreis;
    if (prev !== null || autoPreis === null) return;
    setPriceJustFilled(true);
    const t = setTimeout(() => setPriceJustFilled(false), 900);
    return () => clearTimeout(t);
  }, [autoPreis]);

  // Cent-Eingabe: eigener Text, damit "3" nicht sofort zu "03" wird
  const [centText, setCentText] = useState(() => centDigits(initial.preisProKwh));
  const [euroModus, setEuroModus] = useState(() => parseNum(initial.preisProKwh) >= 1);

  const options = cardOptions.includes(form.karte) || !form.karte ? cardOptions : [...cardOptions, form.karte];

  // Last known odometer reading for a given vehicle, excluding this very entry
  // (relevant when editing — `initial` is the actual row object from `data`).
  const lastKnownKmFor = (vehicle: "" | VehicleKey): number | null => {
    if (!vehicle) return null;
    const candidates = allRows(data)
      .filter((r) => r.fahrzeug === vehicle && r !== initial && r.datum && parseNum(r.km) > 0)
      .sort((a, b) => b.datum.localeCompare(a.datum));
    return candidates.length ? parseNum(candidates[0].km) : null;
  };
  const lastKnownKm = lastKnownKmFor(form.fahrzeug);

  // The km-Stand field arrives with the previous value — select just the trailing
  // digits on focus so typing the real reading only takes the last few keystrokes.
  const selectTrailingDigits = (e: React.FocusEvent<HTMLInputElement>) => {
    const len = e.target.value.length;
    if (len > 3) e.target.setSelectionRange(len - 3, len);
    else e.target.select();
  };

  const totalDurationMinutes = durationToMinutes(form.dauer);
  const durHours = Math.floor(totalDurationMinutes / 60);
  const durMinutes = totalDurationMinutes % 60;
  const setDuration = (hours: number, minutes: number) => patch({ dauer: minutesToDuration(hours * 60 + minutes) });

  // --- Schritte ---
  const filled = (id: StepId): boolean => {
    switch (id) {
      case "rest": return !!form.reichweiteVorher;
      case "odo": return !!form.km;
      case "cent": return preisProKwhTarif > 0;
      case "karte": return !!form.karte;
      case "kwh": return !!form.kwh;
      case "dauer": return totalDurationMinutes > 0;
      case "rneu": return !!form.reichweiteNachher;
      case "notiz": return !!form.notiz;
      case "preis": return !!(form.preis || autoPreis);
    }
  };
  // Mit "Weiter" bestätigte Schritte zählen als erledigt, auch wenn sie leer
  // bleiben dürfen (Notiz) oder der Vorschlag übernommen wurde (ODO, Ladekarte).
  const [confirmed, setConfirmed] = useState<Set<StepId>>(() => new Set());
  const done = (id: StepId) => filled(id) || confirmed.has(id);
  const firstOpen = (section: Section): StepId | null => {
    if (section === "vor" && isNewEntry) return "rest"; // Cursor startet in der Restreichweite
    return STEPS[section].find((id) => !filled(id)) ?? null;
  };

  // Mutually exclusive: only one of the two sections is expanded at a time.
  const [activeSection, setActiveSection] = useState<Section>(defaultSection);
  const [openStep, setOpenStep] = useState<StepId | null>(() => firstOpen(defaultSection));

  const switchSection = (s: Section) => {
    setActiveSection(s);
    setOpenStep(firstOpen(s));
  };
  const openAt = (id: StepId) => {
    setActiveSection(SECTION_OF[id]);
    setOpenStep(id);
  };
  const weiter = (id: StepId) => {
    const next = new Set(confirmed).add(id);
    setConfirmed(next);
    const list = STEPS[SECTION_OF[id]];
    const after = [...list.slice(list.indexOf(id) + 1), ...list.slice(0, list.indexOf(id))];
    setOpenStep(after.find((s) => !(filled(s) || next.has(s))) ?? null);
  };

  // Der Cursor landet im ersten Feld des offenen Schritts (beim Öffnen: Restreichweite)
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openStep) return;
    // Bei der Dauer startet der Cursor in den Minuten (die Stunde steht schon auf 0)
    const el =
      modalRef.current?.querySelector<HTMLElement>(`[data-step="${openStep}"] .efm-body [data-fokus]`) ??
      modalRef.current?.querySelector<HTMLElement>(`[data-step="${openStep}"] .efm-body input, [data-step="${openStep}"] .efm-body select, [data-step="${openStep}"] .efm-body textarea`);
    el?.focus({ preventScroll: true });
    // Nur die Maske selbst scrollen (scrollIntoView würde auch die Seite seitlich verschieben)
    const box = modalRef.current;
    const stepEl = el?.closest<HTMLElement>(".efm-step");
    if (box && stepEl) {
      const top = stepEl.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      const bottom = top + stepEl.offsetHeight;
      if (top < box.scrollTop) box.scrollTo({ top: top - 8, behavior: "smooth" });
      else if (bottom > box.scrollTop + box.clientHeight) box.scrollTo({ top: bottom - box.clientHeight + 8, behavior: "smooth" });
    }
  }, [openStep]);

  // Enter = Weiter (in der Notiz bleibt Enter ein Zeilenumbruch)
  const enterWeiter = (id: StepId) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      weiter(id);
    }
  };

  const STEP_META: Record<StepId, { icon: ReactNode; titel: string; wert: () => string; hilfe?: ReactNode }> = {
    rest: { icon: <BatteryOutlineIcon />, titel: "Restreichweite vor dem Laden", wert: () => (form.reichweiteVorher ? `${parseNum(form.reichweiteVorher)} km` : "") },
    odo: {
      icon: <RoadIcon />,
      titel: "Gesamtkilometer (ODO) vor dem Laden",
      wert: () => (form.km ? `${fmtNum(parseNum(form.km), 0)} km` : ""),
      hilfe:
        lastKnownKm !== null ? (
          <>
            der {vehicleShortLabel(form.fahrzeug as VehicleKey)} wurde zuletzt bei einem ODO von {lastKnownKm} geladen {hintIcon}
          </>
        ) : undefined,
    },
    cent: {
      icon: <EuroIcon />,
      titel: "Kosten pro kWh an dieser Säule",
      wert: () => (preisProKwhTarif > 0 ? `${fmtNum(preisProKwhTarif, 2)} €` : ""),
      hilfe: euroModus ? "Preis in Euro, z. B. 1,09." : "Nur die zwei Cent-Ziffern tippen, z. B. 39.",
    },
    karte: { icon: <CardIcon />, titel: "Benutzte Ladekarte an dieser Säule", wert: () => form.karte },
    kwh: { icon: <BoltIcon />, titel: "geladene kWh", wert: () => (form.kwh ? `${fmtNum(parseNum(form.kwh), 2)} kWh` : "") },
    dauer: {
      icon: <ClockIcon />,
      titel: "Dauer Ladevorgang",
      wert: () => (totalDurationMinutes > 0 ? `${durHours} h ${durMinutes} min` : ""),
      hilfe: isNewEntry ? `Start ca. ${chargeStartLabel} Uhr` : undefined,
    },
    rneu: {
      icon: <RoadIcon />,
      titel: "Reichweite neu",
      wert: () => (form.reichweiteNachher ? `${parseNum(form.reichweiteNachher)} km${form.voll ? " · voll" : ""}` : ""),
    },
    notiz: {
      icon: <NoteIcon />,
      titel: "Notiz",
      wert: () => (form.notiz ? (form.notiz.length > 22 ? form.notiz.slice(0, 22) + " …" : form.notiz) : confirmed.has("notiz") ? "–" : ""),
      hilfe: "Optional: Besonderheiten beim Laden.",
    },
    preis: { icon: <EuroIcon />, titel: "Preis", wert: () => { const p = form.preis || autoPreis; return p ? `${fmtNum(parseNum(p), 2)} €` : ""; } },
  };

  const field = (id: StepId): ReactNode => {
    const onKey = enterWeiter(id);
    switch (id) {
      case "rest":
        return (
          <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="km" aria-label="Restreichweite vor dem Laden in km"
            className={reichweiteColorClass(form.reichweiteVorher)} value={form.reichweiteVorher} onKeyDown={onKey}
            onChange={(e) => patch({ reichweiteVorher: e.target.value.replace(/\D/g, "") })} />
        );
      case "odo":
        return (
          <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="km" aria-label="Gesamtkilometer vor dem Laden"
            value={form.km} onFocus={selectTrailingDigits} onKeyDown={onKey}
            onChange={(e) => patch({ km: e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "") })} />
        );
      case "cent":
        return euroModus ? (
          <input type="text" inputMode="decimal" placeholder="z. B. 1,09" aria-label="Kosten pro kWh in Euro"
            value={form.preisProKwh} onKeyDown={onKey}
            onChange={(e) => patch({ preisProKwh: e.target.value.replace(/[^\d.,]/g, "") })} />
        ) : (
          <label className="efm-cent">
            <span className="efm-cent-fest">0,</span>
            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} placeholder="__" aria-label="Cent pro kWh"
              value={centText} onKeyDown={onKey}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "").slice(0, 2);
                setCentText(d);
                patch({ preisProKwh: d ? (Number(d) / 100).toFixed(2) : "" });
              }} />
            <span className="efm-cent-fest">&nbsp;€</span>
            <span className="efm-cent-einheit">pro kWh</span>
          </label>
        );
      case "karte":
        return (
          <select value={form.karte} onKeyDown={onKey} aria-label="Benutzte Ladekarte" onChange={(e) => patch({ karte: e.target.value })}>
            <option value="">– wählen –</option>
            {options.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        );
      case "kwh":
        return (
          <input type="text" inputMode="decimal" placeholder="kWh" aria-label="geladene kWh" value={form.kwh} onKeyDown={onKey}
            onChange={(e) => patch({ kwh: e.target.value.replace(/[^\d.,]/g, "") })} />
        );
      case "dauer":
        return (
          <div className="duration-inputs efm-dauer">
            {/* Stunde immer mit 0 vorausgefüllt (Wunsch vom 07.10.2026) – Laden dauert selten über eine Stunde;
                beim Antippen ist die 0 markiert und wird einfach überschrieben. */}
            <input type="number" inputMode="numeric" step="1" min="0" max="999" placeholder="Std" aria-label="Stunden"
              value={durHours} onKeyDown={onKey} onFocus={(e) => e.target.select()}
              onChange={(e) => setDuration(Number(e.target.value) || 0, durMinutes)} />
            <span>:</span>
            <input type="number" inputMode="numeric" step="1" min="0" max="59" placeholder="Min" aria-label="Minuten" data-fokus
              value={totalDurationMinutes > 0 ? durMinutes : ""} onKeyDown={onKey}
              onChange={(e) => setDuration(durHours, Math.min(59, Number(e.target.value) || 0))} />
          </div>
        );
      case "rneu":
        return (
          <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="km" aria-label="Reichweite neu in km"
            className={reichweiteColorClass(form.reichweiteNachher)} value={form.reichweiteNachher} onKeyDown={onKey}
            onChange={(e) => patch({ reichweiteNachher: e.target.value.replace(/\D/g, "") })} />
        );
      case "notiz":
        return (
          <textarea rows={2} maxLength={500} aria-label="Notiz" value={form.notiz}
            placeholder="z. B. Säule defekt, nur 50 kW, Blockiergebühr"
            onChange={(e) => patch({ notiz: e.target.value })} />
        );
      case "preis":
        return (
          <input type="text" inputMode="decimal" placeholder="€" aria-label="Preis in Euro"
            className={priceJustFilled ? "price-input-glow" : undefined}
            value={form.preis || autoPreis || ""} onKeyDown={onKey}
            onChange={(e) => patch({ preis: e.target.value.replace(/[^\d.,]/g, "") })} />
        );
    }
  };

  const step = (id: StepId, nr: number) => {
    const meta = STEP_META[id];
    const offen = openStep === id && activeSection === SECTION_OF[id];
    const ok = done(id);
    const breit = id === "notiz" || id === "dauer";
    const list = STEPS[SECTION_OF[id]];
    return (
      <div key={id} data-step={id} className={"efm-step" + (offen ? " offen" : "") + (ok && !offen ? " fertig" : "")}>
        <button type="button" className="efm-k" aria-expanded={offen} onClick={() => (offen ? setOpenStep(null) : openAt(id))}>
          <span className="efm-n">{ok && !offen ? "✓" : nr}</span>
          <span className="efm-icon">{meta.icon}</span>
          <span className="efm-titel">{meta.titel}</span>
          {!offen && <span className="efm-wert">{meta.wert()}</span>}
        </button>
        {offen && (
          <div className="efm-body">
            <div className={"efm-zeile" + (breit ? " breit" : "")}>
              {field(id)}
              <button type="button" className="efm-weiter" onClick={() => weiter(id)}>
                {list.every((s) => s === id || done(s)) ? "Fertig" : "Weiter"}
              </button>
            </div>
            {meta.hilfe && <div className="efm-hilfe">{meta.hilfe}</div>}
            {id === "rneu" && (
              // Das Auto zeigt keine Prozent, nur „voll“: dieser Haken ist der Maßstab für den Ladering
              <label className={"efm-voll" + (form.voll ? " an" : "")}>
                <input type="checkbox" checked={!!form.voll} onChange={(e) => patch({ voll: e.target.checked })} />
                <span>Akku ist voll geladen (100 %)</span>
              </label>
            )}
            {id === "cent" && (
              <button type="button" className="efm-link" onClick={() => {
                setEuroModus((m) => !m);
                if (euroModus) setCentText(centDigits(form.preisProKwh));
              }}>
                {euroModus ? "zurück zur Cent-Eingabe" : "Preis ab 1 €/kWh?"}
              </button>
            )}
            {id === "preis" &&
              (preisProKwhTarif > 0 ? (
                <p className="preis-hint preis-hint-ok">
                  Der kWh-Preis wurde für diese Ladesession mit <strong>{fmtNum(preisProKwhTarif)} €/kWh</strong> festgelegt.
                </p>
              ) : (
                <p className="preis-hint preis-hint-missing">
                  Kein kWh-Preis eingegeben, ein Gesamtpreis kann nicht gebildet werden.{" "}
                  <button type="button" className="preis-hint-link" onClick={() => openAt("cent")}>
                    Jetzt eintragen
                  </button>
                </p>
              ))}
          </div>
        )}
      </div>
    );
  };

  const locateBtn = (
    <button
      type="button"
      className={"locate-btn" + (locating ? " busy" : "")}
      title="Standort per GPS abrufen und Ladestation nachschlagen"
      disabled={locating}
      onClick={() => {
        setLocating(true);
        locateStation(
          form.ladestation,
          (result) => {
            setLocating(false);
            patch({ lat: result.lat, lon: result.lon, ladestation: result.ladestation });
            showToast(result.toast);
          },
          (msg) => {
            setLocating(false);
            showToast(msg);
          }
        );
      }}
    >
      <LocationPinIcon size={14} />
    </button>
  );

  // "Das habe ich erkannt:" – alles, was die App selbst ableitet, als ein Satz;
  // die unterstrichenen Wörter sind echte Eingabefelder.
  const erkannt = (
    <div className="efm-erkannt">
      <b className="efm-erkannt-h">Das habe ich erkannt:</b>
      <p className="fab-modal-sentence">
        Unser{" "}
        <select className="sentence-field fahrzeug-select" value={form.fahrzeug}
          onChange={(e) => patch({ fahrzeug: e.target.value as "" | VehicleKey })}>
          <option value="">Fahrzeug</option>
          {(Object.keys(VEHICLES) as VehicleKey[]).map((val) => (
            <option key={val} value={val}>
              {vehicleShortLabel(val)} ({val.toUpperCase()})
            </option>
          ))}
        </select>{" "}
        wird am{" "}
        <input type="date" className="sentence-field" min={DATE_RANGE_MIN} max={DATE_RANGE_MAX} value={form.datum}
          onChange={(e) => patch({ datum: e.target.value })} />{" "}
        an der Ladestation{" "}
        <span className="sentence-station">
          <input type="text" className="sentence-field sentence-field-wide" placeholder="Ladestation" maxLength={500}
            value={form.ladestation} onChange={(e) => patch({ ladestation: e.target.value })} />
          {locateBtn}
        </span>{" "}
        bei einem <span style={{ whiteSpace: "nowrap" }}>km-Stand</span> von{" "}
        <span className="sentence-value">{form.km ? fmtNum(parseNum(form.km), 0) : "–"} km</span> und einer Restreichweite von{" "}
        <span className="sentence-value">{form.reichweiteVorher ? parseNum(form.reichweiteVorher) : "–"} km</span>{" "}
        {isNewEntry ? (
          <>
            geladen. Die Startzeit ist ca. <span className="sentence-value">{chargeStartLabel} Uhr</span>.
          </>
        ) : (
          "geladen."
        )}
      </p>
    </div>
  );

  const vehicle = form.fahrzeug || null;
  const sectionCount = (s: Section) => STEPS[s].filter(done).length;
  const n = sectionCount(activeSection);
  const total = STEPS[activeSection].length;
  const R = 60;
  const U = 2 * Math.PI * R;
  const other: Section = activeSection === "vor" ? "nach" : "vor";

  const sectionBody = (s: Section) => (
    <>
      {STEPS[s].map((id, i) => step(id, i + 1))}
      {s === "vor" && erkannt}
    </>
  );

  const save = () => {
    if (submittedRef.current) return;
    if (!monthKeyFromDate(form.datum)) {
      showToast(`Datum muss zwischen ${DATE_RANGE_MIN} und ${DATE_RANGE_MAX} liegen`);
      return;
    }
    if (form.reichweiteNachher && parseNum(form.reichweiteNachher) < parseNum(form.reichweiteVorher)) {
      showToast("Reichweite nachher kann nicht kleiner als Reichweite vorher sein — bitte prüfen");
      return;
    }
    // Zwei getrennt erfasste Ladevorgänge mit exakt gleichem Fahrzeug,
    // Datum und km-Stand sind so gut wie sicher ein versehentliches
    // Doppel-Erfassen (z.B. Formular versehentlich zweimal ausgefüllt).
    const duplicate = form.fahrzeug
      ? allRows(data).find((r) => r !== initial && r.fahrzeug === form.fahrzeug && r.datum === form.datum && r.km === form.km)
      : undefined;
    if (
      duplicate &&
      !window.confirm(
        `Für ${vehicleShortLabel(form.fahrzeug as VehicleKey)} gibt es am ${form.datum} bereits einen Eintrag mit demselben km-Stand (${parseNum(form.km)} km). Trotzdem als neuen, separaten Ladevorgang speichern?`
      )
    ) {
      return;
    }
    submittedRef.current = true;
    setSubmitting(true);
    const row: ChargeRow = { ...form, preis: form.preis || autoPreis || form.preis };
    // Erst mit "Nach" vollständig: Konfetti-Fontäne und "alles eingetragen", dann schließen
    if (hasNachValues(row) && !hasNachValues(initial)) {
      setFontaene(makePieces());
      window.setTimeout(() => onSave(row), CELEBRATE_MS);
    } else {
      onSave(row);
    }
  };

  return (
    <div className="fab-overlay" onClick={fontaene ? undefined : onClose}>
      <div
        ref={modalRef}
        className={`fab-modal efm efm-${activeSection}` + (vehicle ? ` efm-car-${vehicle}` : "")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kopf ohne Hintergrund: Blase am Rand (B10 links, t03 gespiegelt rechts) */}
        <div className="efm-kopf">
        <div className="efm-plakette" aria-hidden="true">
          <svg viewBox="0 0 132 132">
            <circle className="efm-spur" cx="66" cy="66" r={R} />
            <circle className="efm-fort" cx="66" cy="66" r={R} strokeDasharray={U} strokeDashoffset={U * (1 - n / total)} />
          </svg>
          <div className="efm-innen">
            {vehicle && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/auto-${vehicle}.webp`} alt="" style={{ transform: `translateX(${(n / total - 0.5) * 16}px)` }} />
            )}
          </div>
          <span className="efm-zahl">
            {n}/{total}
          </span>
        </div>

        </div>

        {/* Karte mit Leuchtrahmen und Autofarbe beginnt erst beim ersten Kästchen;
            die Blase ragt am Rand hinein, der Titel steht daneben über dem ersten Schritt */}
        <div className="efm-karte">
        <h3 className="efm-h">
          {activeSection === "vor" ? "Bitte vor dem Laden ausfüllen" : "Nach dem Laden"}
          <small>
            {vehicle ? `${VEHICLES[vehicle].nickname} (${vehicle === "t03" ? "t03" : "B10"})` : "Fahrzeug wählen"}
            {activeSection === "vor" && isNewEntry ? ` · Start ca. ${chargeStartLabel} Uhr` : ""}
          </small>
        </h3>
        {sectionBody(activeSection)}

        {!isNewEntry && activeSection === "vor" && (
          <div className="efm-weitere">
            <div className="field-row">
              <label>
                <CalendarIcon /> Datum
              </label>
              <input type="date" min={DATE_RANGE_MIN} max={DATE_RANGE_MAX} value={form.datum} onChange={(e) => patch({ datum: e.target.value })} />
            </div>
            <div className="field-row">
              <label>
                <CarIcon /> Fahrzeug
              </label>
              <select className="fahrzeug-select" value={form.fahrzeug} onChange={(e) => patch({ fahrzeug: e.target.value as "" | VehicleKey })}>
                <option value="">–</option>
                {(Object.keys(VEHICLES) as VehicleKey[]).map((val) => (
                  <option key={val} value={val}>
                    {vehicleShortLabel(val)} ({val.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <label>
                <PlugIcon /> Ladestation
              </label>
              <div className="station-cell">
                <input type="text" placeholder="Name der Ladestation" maxLength={500} value={form.ladestation}
                  onChange={(e) => patch({ ladestation: e.target.value })} />
                {locateBtn}
              </div>
            </div>
          </div>
        )}

        <button type="button" className="efm-andere" onClick={() => switchSection(other)}>
          <span>▸ {other === "vor" ? "Vor dem Laden" : "Nach dem Laden"}</span>
          <span className="efm-andere-zahl">
            {sectionCount(other)}/{STEPS[other].length}
          </span>
        </button>

        <div className="fab-modal-actions">
          {onDelete && (
            <button
              type="button"
              className="btn btn-ghost fab-delete"
              onClick={() => {
                if (window.confirm("Diesen Ladevorgang wirklich löschen?")) onDelete();
              }}
            >
              Löschen
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={!!fontaene}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn btn-primary efm-speichern"
            disabled={!form.karte || !form.fahrzeug || !form.km || submitting}
            title={
              !form.karte
                ? "Bitte zuerst eine Ladekarte auswählen"
                : !form.fahrzeug
                ? "Bitte zuerst ein Fahrzeug auswählen"
                : !form.km
                ? "Bitte zuerst den km-Stand eintragen"
                : undefined
            }
            onClick={save}
          >
            Speichern
          </button>
        </div>

        </div>

        {fontaene && (
          <div className="efm-fontaene" aria-live="polite">
            {fontaene.map((p) => (
              <span
                key={p.id}
                className="efm-konfetti"
                style={
                  {
                    background: p.color,
                    "--vx": `${p.vx}px`,
                    "--vy": `${p.vy}px`,
                    "--rot": `${p.rot}deg`,
                    animationDelay: `${p.delay}ms`,
                    animationDuration: `${p.duration}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
            <div className="efm-alles">🎉 alles eingetragen</div>
          </div>
        )}
      </div>
    </div>
  );
}
