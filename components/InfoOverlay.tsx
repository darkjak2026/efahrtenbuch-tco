"use client";

import { useState } from "react";
import projektPass from "../projekt-pass.json";
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
  const requests = [...(data.featureRequests || [])].sort((a, b) => b.ts.localeCompare(a.ts));

  const commitDraft = () => {
    const text = draft.trim();
    setAdding(false);
    setDraft("");
    if (!text) return;
    updateData((d) => {
      d.featureRequests.unshift({ ts: nowTimestamp(), text, status: "offen" });
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
            {requests.map((r, i) => (
              <div className="info-note-row" key={`${r.ts}-${i}`}>
                <span className="info-note-ts">[{r.ts}]:</span>
                <span className="info-note-text">{r.text}</span>
                <span className={"info-note-status info-note-status-" + r.status}>{STATUS_LABEL[r.status] ?? r.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
