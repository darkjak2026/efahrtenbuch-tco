"use client";

import { useEffect, useRef, useState } from "react";
import { DATE_RANGE_MAX, DATE_RANGE_MIN, VEHICLES, vehicleShortLabel } from "@/lib/constants";
import {
  allRows,
  durationToMinutes,
  fmtNum,
  minutesToDuration,
  monthKeyFromDate,
  parseNum,
  reichweiteColorClass,
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

const HINT_ICONS = ["⚡", "🔌", "🚗", "🔋", "🛣️"];

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
  defaultSection?: "vor" | "nach";
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
  // Mutually exclusive: only one of the two sections is expanded at a time.
  // The active section always leads (renders first); the collapsed one follows below.
  const [activeSection, setActiveSection] = useState<"vor" | "nach">(defaultSection);

  // Only for brand-new entries (no onDelete → not editing a past, already-finished
  // row) does an "app just opened" timestamp mean anything as a charge start time.
  const isNewEntry = !onDelete;
  const [openedAt] = useState(() => new Date());
  // The few minutes between opening the dialog and actually plugging in.
  const chargeStart = new Date(openedAt.getTime() + 3 * 60000);
  const chargeStartLabel = chargeStart.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const [endTime, setEndTime] = useState("");

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
  // value (like computedDauer below), not effect-driven state. Shown live while the
  // field is untouched; the moment the user types their own number, form.preis stops
  // being empty and their value simply wins. (An earlier version mutated a ref inside
  // the setState updater to track "still our guess" — that broke silently under React
  // 18 StrictMode, which invokes updater functions twice in dev and desynced the ref
  // from committed state.)
  const preisProKwhTarif = parseNum(form.preisProKwh);
  const autoPreis = (() => {
    if (preisProKwhTarif <= 0 || parseNum(form.kwh) <= 0) return null;
    return (parseNum(form.kwh) * preisProKwhTarif).toFixed(2);
  })();

  // One-shot "it just filled itself in" glow the moment autoPreis first appears
  // (kWh went from empty to entered) — not on every subsequent digit, so typing
  // out a multi-digit kWh value doesn't flicker the field repeatedly.
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

  // Jumping from the "kein kWh-Preis eingegeben"-hint in Nach straight to the
  // €/kWh field in Vor (which normally sits collapsed and out of sight).
  const preisProKwhInputRef = useRef<HTMLInputElement>(null);
  const focusPreisProKwhPending = useRef(false);
  useEffect(() => {
    if (activeSection !== "vor" || !focusPreisProKwhPending.current) return;
    focusPreisProKwhPending.current = false;
    preisProKwhInputRef.current?.focus();
  }, [activeSection]);
  const jumpToPreisProKwh = () => {
    focusPreisProKwhPending.current = true;
    setActiveSection("vor");
  };

  // "Nach" starts with the kWh field (the number read off the charger first) -
  // whenever that section opens, the cursor lands right in it.
  const kwhInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (activeSection === "nach") kwhInputRef.current?.focus();
  }, [activeSection]);

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

  // The km-Stand field (when editable) arrives with the previous value — select just the trailing
  // digits on focus so typing the real reading only takes the last few keystrokes.
  const selectTrailingDigits = (e: React.FocusEvent<HTMLInputElement>) => {
    const len = e.target.value.length;
    if (len > 3) e.target.setSelectionRange(len - 3, len);
    else e.target.select();
  };

  // For a new entry, Dauer is derived from chargeStart (dialog-open time + 3min) and
  // the end time the user enters — no manual Std/Min typing. A derived value, not
  // effect-driven state: computed on render and folded into the row on save.
  // Assumes the same day; an end time earlier than the start rolled past midnight.
  const computeDauerFromEndTime = (): string | null => {
    if (!endTime) return null;
    const [h, m] = endTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const end = new Date(chargeStart);
    end.setHours(h, m, 0, 0);
    if (end.getTime() < chargeStart.getTime()) end.setDate(end.getDate() + 1);
    const minutes = Math.round((end.getTime() - chargeStart.getTime()) / 60000);
    return minutesToDuration(minutes);
  };
  const computedDauer = isNewEntry ? computeDauerFromEndTime() : null;

  // Editing an existing (already-finished) entry has no live start-time reference,
  // so Dauer stays directly editable as separate Std/Min fields there.
  const totalDurationMinutes = durationToMinutes(form.dauer);
  const durHours = Math.floor(totalDurationMinutes / 60);
  const durMinutes = totalDurationMinutes % 60;
  const setDuration = (hours: number, minutes: number) => patch({ dauer: minutesToDuration(hours * 60 + minutes) });

  // The active section's heading renders first (leading), the collapsed one's
  // heading follows below it — an accordion where the open panel leads.
  const vorBlock = (
    <>
      <button
        type="button"
        className={"fab-modal-subheading" + (activeSection === "vor" ? " active" : "")}
        onClick={() => setActiveSection("vor")}
      >
        <span className="fab-modal-subheading-chevron">{activeSection === "vor" ? "▾" : "▸"}</span>
        Vor
      </button>
      {activeSection === "vor" && (
        <>
          <div className="field-row-pair">
            <div className="field-col">
              <label>
                <RoadIcon /> km-Stand
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="km"
                value={form.km}
                onFocus={selectTrailingDigits}
                onChange={(e) => patch({ km: e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "") })}
              />
            </div>
            <div className="field-col">
              <label>
                <EuroIcon /> €/kWh
              </label>
              <input
                ref={preisProKwhInputRef}
                type="number"
                step="0.01"
                min="0"
                placeholder="z.B. 0,32"
                value={form.preisProKwh}
                onChange={(e) => patch({ preisProKwh: e.target.value.replace(/-/g, "") })}
              />
            </div>
            <div className="field-col">
              <label>
                <CardIcon /> Ladekarte
              </label>
              <select value={form.karte} onChange={(e) => patch({ karte: e.target.value })}>
                <option value="">– wählen –</option>
                {options.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {!form.karte && <span className="field-required-hint">Karte auswählen</span>}
            </div>
            <div className="field-col">
              <label>
                <BatteryOutlineIcon /> Restreichweite
              </label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="km"
                className={reichweiteColorClass(form.reichweiteVorher)}
                value={form.reichweiteVorher}
                onChange={(e) => patch({ reichweiteVorher: e.target.value.replace(/-/g, "") })}
              />
            </div>
          </div>
          {isNewEntry ? (
            // All auto-derivable data folded into one sentence — the coloured/underlined
            // words are still real inputs, just styled to read as prose. Only Ladekarte
            // and Reichweite vorher above (nothing to derive them from) stay as plain
            // fields, so the two things that truly need the user's own knowledge remain
            // visually distinct from everything the app can already guess.
            <p className="fab-modal-sentence">
              Unser{" "}
              <select
                className="sentence-field fahrzeug-select"
                value={form.fahrzeug}
                onChange={(e) => patch({ fahrzeug: e.target.value as "" | VehicleKey })}
              >
                <option value="">Fahrzeug</option>
                {(Object.keys(VEHICLES) as VehicleKey[]).map((val) => (
                  <option key={val} value={val}>
                    {vehicleShortLabel(val)} ({val.toUpperCase()})
                  </option>
                ))}
              </select>{" "}
              wird am{" "}
              <input
                type="date"
                className="sentence-field"
                min={DATE_RANGE_MIN}
                max={DATE_RANGE_MAX}
                value={form.datum}
                onChange={(e) => patch({ datum: e.target.value })}
              />{" "}
              an der Ladestation{" "}
              <span className="sentence-station">
                <input
                  type="text"
                  className="sentence-field sentence-field-wide"
                  placeholder="Ladestation"
                  maxLength={500}
                  value={form.ladestation}
                  onChange={(e) => patch({ ladestation: e.target.value })}
                />
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
              </span>{" "}
              bei einem <span style={{ whiteSpace: "nowrap" }}>km-Stand</span> von{" "}
              <span className="sentence-value">{form.km ? parseNum(form.km) : "–"} km</span> geladen. Die Startzeit ist ca.{" "}
              <span className="sentence-value">{chargeStartLabel} Uhr</span>.
            </p>
          ) : (
            <>
              <div className="field-row">
                <label>
                  <CalendarIcon /> Datum
                </label>
                <input
                  type="date"
                  min={DATE_RANGE_MIN}
                  max={DATE_RANGE_MAX}
                  value={form.datum}
                  onChange={(e) => patch({ datum: e.target.value })}
                />
              </div>
              <div className="field-row">
                <label>
                  <CarIcon /> Fahrzeug
                </label>
                <select
                  className="fahrzeug-select"
                  value={form.fahrzeug}
                  onChange={(e) => patch({ fahrzeug: e.target.value as "" | VehicleKey })}
                >
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
                  <RoadIcon /> km-Stand
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="km"
                  value={form.km}
                  onFocus={selectTrailingDigits}
                  onChange={(e) => patch({ km: e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "") })}
                />
              </div>
              <div className="field-row">
                <label>
                  <PlugIcon /> Ladestation
                </label>
                <div className="station-cell">
                  <input
                    type="text"
                    placeholder="Name der Ladestation"
                    maxLength={500}
                    value={form.ladestation}
                    onChange={(e) => patch({ ladestation: e.target.value })}
                  />
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
                </div>
              </div>
            </>
          )}
          {lastKnownKm !== null && (
            <div className="field-hint">
              <span className="field-hint-text">
                der {vehicleShortLabel(form.fahrzeug as VehicleKey)} wurde zuletzt bei einem ODO von {lastKnownKm} geladen
              </span>
              <span className="field-hint-icon">{hintIcon}</span>
            </div>
          )}
        </>
      )}
    </>
  );

  const nachBlock = (
    <>
      <button
        type="button"
        className={"fab-modal-subheading" + (activeSection === "nach" ? " active" : "")}
        onClick={() => setActiveSection("nach")}
      >
        <span className="fab-modal-subheading-chevron">{activeSection === "nach" ? "▾" : "▸"}</span>
        Nach
        {activeSection === "nach" && isNewEntry && (
          <span className="fab-modal-subheading-hint">
            Start ca. {chargeStartLabel} Uhr{computedDauer ? ` · Dauer ${computedDauer} h` : ""}
          </span>
        )}
      </button>
      {activeSection === "nach" && (
        <>
          {isNewEntry ? (
            <div className="field-row-pair">
              <div className="field-col">
                <label>
                  <BoltIcon /> geladene kWh
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  ref={kwhInputRef}
                  value={form.kwh}
                  onChange={(e) => patch({ kwh: e.target.value.replace(/-/g, "") })}
                />
              </div>              <div className="field-col">
                <label>
                  <RoadIcon /> Reichweite neu
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="km"
                  className={reichweiteColorClass(form.reichweiteNachher)}
                  value={form.reichweiteNachher}
                  onChange={(e) => patch({ reichweiteNachher: e.target.value.replace(/-/g, "") })}
                />
              </div>
              <div className="field-col">
                <label>
                  <ClockIcon /> Ende Ladevorgang
                </label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>

            </div>
          ) : (
            <>
              <div className="field-row">
                <label>
                  <BoltIcon /> geladene kWh
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  ref={kwhInputRef}
                  value={form.kwh}
                  onChange={(e) => patch({ kwh: e.target.value.replace(/-/g, "") })}
                />
              </div>              <div className="field-row">
                <label>
                  <RoadIcon /> Reichweite neu
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="km"
                  className={reichweiteColorClass(form.reichweiteNachher)}
                  value={form.reichweiteNachher}
                  onChange={(e) => patch({ reichweiteNachher: e.target.value.replace(/-/g, "") })}
                />
              </div>
              <div className="field-row">
                <label>
                  <ClockIcon /> Dauer (Std : Min)
                </label>
                <div className="duration-inputs">
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    max="999"
                    placeholder="Std"
                    value={durHours}
                    onChange={(e) => setDuration(Number(e.target.value) || 0, durMinutes)}
                  />
                  <span>:</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    max="59"
                    placeholder="Min"
                    value={durMinutes || ""}
                    onChange={(e) => setDuration(durHours, Number(e.target.value) || 0)}
                  />
                </div>
              </div>

            </>
          )}
          {preisProKwhTarif > 0 ? (
            <p className="preis-hint preis-hint-ok">
              Der kWh-Preis wurde für diese Ladesession mit <strong>{fmtNum(preisProKwhTarif)} €/kWh</strong> festgelegt.
            </p>
          ) : (
            <p className="preis-hint preis-hint-missing">
              Kein kWh-Preis eingegeben, ein Gesamtpreis kann nicht gebildet werden.{" "}
              <button type="button" className="preis-hint-link" onClick={jumpToPreisProKwh}>
                Jetzt eintragen
              </button>
            </p>
          )}
          <div className="field-row">
            <label>
              <EuroIcon /> Preis €
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={priceJustFilled ? "price-input-glow" : undefined}
              value={form.preis || autoPreis || ""}
              onChange={(e) => patch({ preis: e.target.value.replace(/-/g, "") })}
            />
          </div>
          <div className="field-row">
            <label>
              <NoteIcon /> Notiz
            </label>
            <input
              type="text"
              className="notiz-input"
              maxLength={500}
              placeholder="Optionale Notiz"
              value={form.notiz}
              onChange={(e) => patch({ notiz: e.target.value })}
            />
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="fab-overlay" onClick={onClose}>
      <div
        className={"fab-modal" + (activeSection === "vor" ? " fab-modal-vor" : " fab-modal-nach")}
        onClick={(e) => e.stopPropagation()}
      >
        {activeSection === "nach" ? (
          <>
            {nachBlock}
            {vorBlock}
          </>
        ) : (
          <>
            {vorBlock}
            {nachBlock}
          </>
        )}

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
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn btn-primary"
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
            onClick={() => {
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
                ? allRows(data).find(
                    (r) => r !== initial && r.fahrzeug === form.fahrzeug && r.datum === form.datum && r.km === form.km
                  )
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
              onSave({
                ...form,
                dauer: computedDauer ?? form.dauer,
                preis: form.preis || autoPreis || form.preis,
              });
            }}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
