"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { DEV_BRIEFING } from "@/lib/devBriefing";
import { appendDictated, useDictation } from "@/lib/dictation";
import type { AppData, FeatureRequestEntry } from "@/lib/types";
import { TOOL_ID, TOOL_VERSION, VERSIONSVERLAUF } from "@/lib/version";

// Loaded on demand - the Bauplan texts don't need to ship with every page view.
const BauplanView = lazy(() => import("./BauplanView"));

// CLAUDE-Allgemein 6.4 names this key for the notes themselves. Here the notes
// live in the shared Redis document (data.featureRequests, same on every
// device - deliberate project deviation, see CLAUDE-eFahrtenbuch.md); only the
// unsaved draft of this device uses localStorage.
const DRAFT_KEY = TOOL_ID + "_notizblock_v2_entwurf";
const MAX_ENTRIES = 300;

function nowTimestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}||${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Stored "JJJJ-MM-TT||HH:MM" (sortable) -> shown "TT.MM.JJJJ HH:MM".
export function displayTs(ts: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})\|\|(\d{2}:\d{2})$/.exec(ts);
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}` : ts;
}

// One projekt-pass.json "feature_requests" row per wish (CLAUDE-Allgemein 6.5).
export function exportLine(r: FeatureRequestEntry): string {
  const status = r.status === "erledigt" || r.status === "uebernommen" ? "übernommen" : r.status;
  return JSON.stringify([displayTs(r.ts), r.text, status]);
}

function readDraft(): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(text: string): void {
  try {
    if (text) window.localStorage.setItem(DRAFT_KEY, text);
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Blocked storage: the draft just won't survive closing - nothing else breaks.
  }
}

const STATUS_LABEL: Record<string, string> = {
  offen: "offen",
  uebernommen: "übernommen",
  verworfen: "verworfen",
  erledigt: "erledigt",
};

export default function DevArea({
  data,
  updateData,
  onClose,
}: {
  data: AppData;
  updateData: (fn: (d: AppData) => void) => void;
  onClose: () => void;
}) {
  // Only ever mounted after a click (never server-rendered), so reading
  // localStorage in the initializer is safe.
  const [draft, setDraft] = useState(readDraft);
  const [interim, setInterim] = useState("");
  const [notice, setNotice] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [exported, setExported] = useState(false);
  const [bauplanOpen, setBauplanOpen] = useState(false);

  useEffect(() => {
    writeDraft(draft);
  }, [draft]);

  const dictation = useDictation(
    (chunk) => setDraft((t) => appendDictated(t, chunk)),
    (chunk) => setInterim(chunk)
  );

  const requests = (data.featureRequests || [])
    .map((r, idx) => ({ r, idx }))
    .sort((a, b) => b.r.ts.localeCompare(a.r.ts));

  const saveDraft = () => {
    const text = draft.trim();
    if (!text) return;
    if ((data.featureRequests || []).length >= MAX_ENTRIES) {
      setNotice(`Höchstens ${MAX_ENTRIES} Einträge – bitte erst alte löschen.`);
      return;
    }
    dictation.stop();
    updateData((d) => {
      d.featureRequests.unshift({ ts: nowTimestamp(), text, status: "offen" });
    });
    setDraft("");
    setInterim("");
    setNotice("");
  };

  const discardDraft = () => {
    dictation.stop();
    setDraft("");
    setInterim("");
  };

  const startEdit = (idx: number, text: string) => {
    setConfirmDeleteIdx(null);
    setEditIdx(idx);
    setEditText(text);
  };

  const commitEdit = () => {
    if (editIdx === null) return;
    const text = editText.trim();
    const idx = editIdx;
    if (text && text !== data.featureRequests[idx]?.text) {
      updateData((d) => {
        d.featureRequests[idx].text = text;
      });
    }
    setEditIdx(null);
  };

  const deleteEntry = (idx: number) => {
    updateData((d) => {
      d.featureRequests.splice(idx, 1);
    });
    setConfirmDeleteIdx(null);
  };

  const toggleDone = (idx: number) => {
    updateData((d) => {
      const entry = d.featureRequests[idx];
      if (entry.status === "erledigt") {
        entry.status = "offen";
        delete entry.doneAt;
      } else {
        entry.status = "erledigt";
        entry.doneAt = nowTimestamp();
      }
    });
  };

  const exportRequests = async () => {
    const text = requests.map(({ r }) => exportLine(r)).join(",\n");
    try {
      await navigator.clipboard.writeText(text);
      setExported(true);
      setTimeout(() => setExported(false), 1800);
    } catch {
      setNotice("Kopieren nicht möglich – der Browser erlaubt keinen Zugriff auf die Zwischenablage.");
    }
  };

  // Closing never drops typed text: the new-note draft is kept in localStorage,
  // an open edit of an existing wish gets saved.
  const close = () => {
    commitEdit();
    dictation.stop();
    onClose();
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || bauplanOpen) return;
      e.preventDefault();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bauplanOpen]);

  const shownDraft = interim ? appendDictated(draft, interim) : draft;

  return (
    <div className="fab-overlay" onClick={close}>
      <div className="fab-modal fab-modal-info dev-area" onClick={(e) => e.stopPropagation()}>
        <div className="info-overlay-head">
          <div>
            <div className="dev-area-kicker">Entwicklerbereich</div>
            <p className="dev-area-tagline">Vergangenheit, Gegenwart und Zukunft der App</p>
            <p className="info-overlay-sub">eFahrtenbuch TCO · v{TOOL_VERSION}</p>
          </div>
          <button type="button" className="info-overlay-close" aria-label="Schließen" onClick={close}>
            ×
          </button>
        </div>

        <section className="info-overlay-section">
          <h4>Notizblock</h4>
          <div className="dev-note-editor">
            {dictation.supported && (
              <button
                type="button"
                className={"dev-mic" + (dictation.recording ? " dev-mic-on" : "")}
                aria-label={dictation.recording ? "Diktat beenden" : "Diktat starten"}
                title={dictation.recording ? "Diktat beenden" : "Diktat starten"}
                onClick={dictation.toggle}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
                  />
                </svg>
              </button>
            )}
            <textarea
              className="dev-note-input"
              rows={2}
              maxLength={2000}
              placeholder="Idee oder Wunsch notieren …"
              value={shownDraft}
              onChange={(e) => {
                setInterim("");
                setDraft(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  saveDraft();
                }
              }}
            />
          </div>
          <div className="dev-note-actions">
            {draft.trim() && (
              <button type="button" className="dev-btn dev-btn-ghost" onClick={discardDraft}>
                Verwerfen
              </button>
            )}
            <button type="button" className="dev-btn" onClick={saveDraft} disabled={!draft.trim()}>
              Speichern
            </button>
          </div>
          {notice && <p className="dev-notice">{notice}</p>}
        </section>

        <section className="info-overlay-section">
          <h4>Änderungen, die ich mir wünsche</h4>
          {requests.length === 0 && <p className="info-overlay-hint">Noch keine Wünsche notiert.</p>}
          <div className="info-note-list">
            {requests.map(({ r, idx }) => (
              <div className={"info-note-row" + (r.status === "erledigt" ? " info-note-done" : "")} key={`${r.ts}-${idx}`}>
                <input
                  type="checkbox"
                  className="info-note-check"
                  checked={r.status === "erledigt"}
                  aria-label={r.status === "erledigt" ? "Als offen markieren" : "Als erledigt markieren"}
                  onChange={() => toggleDone(idx)}
                />
                <span className="info-note-ts">{displayTs(r.ts)}:</span>
                {editIdx === idx ? (
                  <textarea
                    className="dev-note-input dev-note-edit"
                    rows={2}
                    maxLength={2000}
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        commitEdit();
                      }
                    }}
                  />
                ) : (
                  <span className="info-note-text">{r.text}</span>
                )}
                {r.status === "erledigt" && r.doneAt ? (
                  <span className="info-note-status info-note-status-erledigt">erledigt {displayTs(r.doneAt)}</span>
                ) : (
                  <span className={"info-note-status info-note-status-" + r.status}>{STATUS_LABEL[r.status] ?? r.status}</span>
                )}
                <div className="dev-row-actions">
                  {editIdx === idx ? (
                    <>
                      <button type="button" className="dev-btn dev-btn-small" onClick={commitEdit}>
                        Speichern
                      </button>
                      <button type="button" className="dev-btn dev-btn-small dev-btn-ghost" onClick={() => setEditIdx(null)}>
                        Abbrechen
                      </button>
                    </>
                  ) : confirmDeleteIdx === idx ? (
                    <>
                      <span className="dev-confirm-text">Wirklich löschen?</span>
                      <button type="button" className="dev-btn dev-btn-small dev-btn-danger" onClick={() => deleteEntry(idx)}>
                        Ja, löschen
                      </button>
                      <button
                        type="button"
                        className="dev-btn dev-btn-small dev-btn-ghost"
                        onClick={() => setConfirmDeleteIdx(null)}
                      >
                        Nein
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="dev-btn dev-btn-small dev-btn-ghost" onClick={() => startEdit(idx, r.text)}>
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        className="dev-btn dev-btn-small dev-btn-ghost"
                        onClick={() => {
                          setEditIdx(null);
                          setConfirmDeleteIdx(idx);
                        }}
                      >
                        Löschen
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {requests.length > 0 && (
            <button type="button" className="dev-btn dev-btn-ghost dev-export" onClick={exportRequests}>
              {exported ? "Kopiert ✓" : "Exportieren"}
            </button>
          )}
        </section>

        <details className="info-dev-briefing">
          <summary>Versionsverlauf</summary>
          <div className="dev-versions">
            <div className="dev-versions-head">
              <span>Ver.</span>
              <span>Datum</span>
              <span>Art</span>
              <span>Kurzbeschreibung</span>
            </div>
            {VERSIONSVERLAUF.map((v, i) => (
              <details className="dev-version-row" key={`${v.ver}-${i}`}>
                <summary>
                  <span className="dev-version-ver">{v.ver}</span>
                  <span>{v.datum}</span>
                  <span className={"dev-art dev-art-" + v.art}>{v.art || "–"}</span>
                  <span className="dev-version-short">{v.text}</span>
                </summary>
                <p>{v.text}</p>
              </details>
            ))}
          </div>
        </details>

        <details className="info-dev-briefing">
          <summary>Richtlinie der Benennung</summary>
          <div className="info-dev-briefing-body">
            <div className="info-dev-briefing-section">
              <h5>Versionsnummer</h5>
              <p>
                {"MAJOR.MINOR.PATCH[+design.NN], z. B. 2.26.00 oder 2.26.01+design.02.\nMAJOR: spürbar neue Bedienung oder Bruch mit alten Daten.\nMINOR: neue Funktion, alles Bisherige läuft weiter.\nPATCH (zweistellig): kleine Korrektur ohne Einfluss auf die Bedienung.\n+design.NN: reine Gestaltungsschritte seit der letzten Version.\nIm Projekt-Pass steht davor das Datum: JJJJ-MM-TT|2.26.00 (SemVer+CalVer). package.json braucht striktes SemVer ohne führende Nullen (2.26.0)."}
              </p>
            </div>
            <div className="info-dev-briefing-section">
              <h5>Art einer Änderung</h5>
              <p>{"Neu: neue Funktion · Härtung: sicherer/robuster · Behoben: Fehler korrigiert · Design: nur Aussehen."}</p>
            </div>
            <div className="info-dev-briefing-section">
              <h5>Zeitstempel und Dateinamen</h5>
              <p>
                {"In der App: TT.MM.JJJJ HH:MM. Versionierte Dateien außerhalb von Git: JJJJ-MM-TT_HH.MM_Inhalt_VMAJOR.MINOR (z. B. 2026-10-07_19.30_Bauplan_V1.00)."}
              </p>
            </div>
          </div>
        </details>

        <details className="info-dev-briefing">
          <summary>Tastenkürzel</summary>
          <div className="dev-shortcuts">
            <kbd>Esc</kbd>
            <span>Entwicklerbereich schließen (Entwurf bleibt erhalten)</span>
            <kbd>Strg + Enter</kbd>
            <span>Notiz bzw. bearbeiteten Wunsch speichern</span>
            <kbd>5× Versionsnummer</kbd>
            <span>Entwicklerbereich öffnen (innerhalb von 2 Sekunden)</span>
          </div>
        </details>

        <details className="info-dev-briefing">
          <summary>Für Entwickler — in 7 Minuten wieder einsteigen</summary>
          <div className="info-dev-briefing-body">
            <p className="info-overlay-hint" style={{ marginTop: 8 }}>
              Falls hier jemand ganz ohne Vorwissen ansetzt (neue Entwicklerin, oder eine KI-Sitzung ohne
              Gesprächsverlauf): das reicht, um produktiv weiterzumachen.
            </p>
            {DEV_BRIEFING.map((section) => (
              <div className="info-dev-briefing-section" key={section.heading}>
                <h5>{section.heading}</h5>
                <p>{section.body}</p>
              </div>
            ))}
          </div>
        </details>

        <button type="button" className="dev-btn dev-btn-ghost dev-bauplan-open" onClick={() => setBauplanOpen(true)}>
          ⚓ Bauplan eFahrtenbuch öffnen
        </button>

        <button type="button" className="dev-btn dev-close" onClick={close}>
          Schließen
        </button>
      </div>

      {bauplanOpen && (
        <Suspense fallback={null}>
          <BauplanView onClose={() => setBauplanOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
