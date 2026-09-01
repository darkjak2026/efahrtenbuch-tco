"use client";

import { useState } from "react";
import projektPass from "../projekt-pass.json";
import { DEV_BRIEFING } from "@/lib/devBriefing";
import type { AppData } from "@/lib/types";

function nowTimestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}||${p(d.getHours())}:${p(d.getMinutes())}`;
}

const STATUS_LABEL: Record<string, string> = {
  offen: "offen",
  uebernommen: "übernommen",
  verworfen: "verworfen",
  erledigt: "erledigt",
};

export default function InfoOverlay({
  data,
  updateData,
  onClose,
}: {
  data: AppData;
  updateData: (fn: (d: AppData) => void) => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  // projekt-pass.json lists the changelog oldest-first (how entries get appended);
  // shown here newest-first, same convention as the feature-request notes below.
  const changelog = [...projektPass.changelog].reverse();
  // Sort a list of {entry, idx} pairs (not the entries themselves) so the
  // checkbox below can still write back to the right slot in
  // data.featureRequests after the display order has been reversed.
  const requests = (data.featureRequests || [])
    .map((r, idx) => ({ r, idx }))
    .sort((a, b) => b.r.ts.localeCompare(a.r.ts));

  const commitDraft = () => {
    const text = draft.trim();
    setAdding(false);
    setDraft("");
    if (!text) return;
    updateData((d) => {
      d.featureRequests.unshift({ ts: nowTimestamp(), text, status: "offen" });
    });
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

  return (
    <div className="fab-overlay" onClick={onClose}>
      <div className="fab-modal fab-modal-info" onClick={(e) => e.stopPropagation()}>
        <div className="info-overlay-head">
          <div>
            <h3>Info &amp; Ideen</h3>
            <p className="info-overlay-sub">eFahrtenbuch TCO · v{projektPass.changelog.at(-1)?.[1] ?? ""}</p>
          </div>
          <button type="button" className="info-overlay-close" aria-label="Schließen" onClick={onClose}>
            ×
          </button>
        </div>

        <section className="info-overlay-section">
          <h4>Ideen für später</h4>
          <p className="info-overlay-hint">Antippen, um eine neue Notiz mit Zeitstempel zu beginnen.</p>

          {!adding ? (
            <button type="button" className="info-note-add" onClick={() => setAdding(true)}>
              + Neue Notiz
            </button>
          ) : (
            <div className="info-note-row info-note-editing">
              <span className="info-note-ts">[{nowTimestamp()}]:</span>
              <input
                type="text"
                className="info-note-input"
                autoFocus
                maxLength={500}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setDraft("");
                    setAdding(false);
                  }
                }}
              />
            </div>
          )}

          <div className="info-note-list">
            {requests.map(({ r, idx }) => (
              <div className={"info-note-row" + (r.status === "erledigt" ? " info-note-done" : "")} key={`${r.ts}-${idx}`}>
                <input
                  type="checkbox"
                  className="info-note-check"
                  checked={r.status === "erledigt"}
                  title={r.status === "erledigt" ? "Als offen markieren" : "Als erledigt markieren"}
                  onChange={() => toggleDone(idx)}
                />
                <span className="info-note-ts">[{r.ts}]:</span>
                <span className="info-note-text">{r.text}</span>
                {r.status === "erledigt" && r.doneAt ? (
                  <span className="info-note-status info-note-status-erledigt">erledigt [{r.doneAt}]</span>
                ) : (
                  <span className={"info-note-status info-note-status-" + r.status}>{STATUS_LABEL[r.status] ?? r.status}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="info-overlay-section">
          <h4>Änderungsprotokoll</h4>
          <div className="info-changelog">
            {changelog.map(([datum, version, text], i) => (
              <details className="info-changelog-entry" key={`${datum}-${version}-${i}`}>
                <summary>
                  {datum} · {version}
                </summary>
                <p>{text}</p>
              </details>
            ))}
          </div>
        </section>

        <details className="info-dev-briefing">
          <summary>🛠️ Für Entwickler — in 7 Minuten wieder einsteigen</summary>
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
      </div>
    </div>
  );
}
