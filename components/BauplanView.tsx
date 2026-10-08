"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import bauplanJson from "../docs/technisch/bauplan.json";
import { BESCHREIBUNG_BLOECKE, ORT_LABEL, parseLinks, plainText, type Bauplan, type BauteilOrt } from "@/lib/bauplan";

const bauplan = bauplanJson as Bauplan;

const ORT_COLOR: Record<BauteilOrt, string> = {
  geraet: "var(--glacier)",
  server: "var(--range-yellow)",
  extern: "var(--violet)",
  werkzeug: "var(--teal)",
};

// Where each ship part sits in the cross-section (viewBox 360 x 240).
// Only parts that exist in bauplan.json with vorhanden=true are drawn.
const SHAPES: Record<string, { x: number; y: number; w: number; h: number; label: string; boat?: boolean }> = {
  werft: { x: 4, y: 8, w: 58, h: 34, label: "Werft" },
  funk: { x: 150, y: 6, w: 44, h: 40, label: "Funkmast" },
  bruecke: { x: 118, y: 50, w: 80, h: 44, label: "Brücke" },
  maschinenraum: { x: 198, y: 104, w: 58, h: 34, label: "Maschine" },
  sprachrohr: { x: 64, y: 66, w: 54, h: 28, label: "Sprachrohr" },
  ladekran: { x: 256, y: 26, w: 44, h: 68, label: "Ladekran" },
  rettungsboot: { x: 6, y: 74, w: 54, h: 20, label: "Rettung", boat: true },
  tresor: { x: 74, y: 104, w: 58, h: 34, label: "Tresor" },
  logbuch: { x: 136, y: 104, w: 58, h: 34, label: "Logbuch" },
  boje: { x: 6, y: 168, w: 34, h: 34, label: "Boje" },
  laderaum: { x: 92, y: 142, w: 140, h: 24, label: "Laderaum (Datenbank)" },
  rumpf: { x: 104, y: 178, w: 116, h: 22, label: "Rumpf (eigener Server)" },
};

const STICKY_OFFSET = 8;

function anchorId(kind: "g" | "b", id: string): string {
  return kind === "g" ? `bp-g-${id}` : `bp-b-${id}`;
}

export default function BauplanView({ onClose }: { onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const parts = bauplan.schiff.filter((p) => p.vorhanden);
  const missing = bauplan.schiff.filter((p) => !p.vorhanden);
  const usedOrte = Array.from(new Set(parts.map((p) => p.ort)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Target position from the element's place in the content (not its current
  // screen position), landing below the sticky bar; corrected once after the
  // smooth scroll in case late-loading fonts shifted the layout.
  const jump = (elementId: string) => {
    const box = scrollRef.current;
    const el = document.getElementById(elementId);
    if (!box || !el) return;
    const target = () => {
      const barH = elementId === "bp-schiff" ? 0 : (barRef.current?.offsetHeight ?? 0) + STICKY_OFFSET;
      return el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - barH;
    };
    box.scrollTo({ top: target(), behavior: "smooth" });
    window.setTimeout(() => {
      const t = target();
      if (Math.abs(box.scrollTop - t) > 4) box.scrollTo({ top: t });
    }, 600);
  };

  const copy = async (key: string, title: string, text: string) => {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${plainText(text)}`);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      setCopied(null);
    }
  };

  const rich = (text: string) =>
    parseLinks(text).map((s, i) =>
      s.kind === "text" ? (
        <Fragment key={i}>{s.text}</Fragment>
      ) : (
        <button type="button" key={i} className={"bp-link bp-link-" + s.kind} onClick={() => jump(anchorId(s.kind, s.id))}>
          {s.text}
        </button>
      )
    );

  const copyBtn = (k: string, title: string, text: string) => (
    <button type="button" className="bp-copy" onClick={() => copy(k, title, text)}>
      {copied === k ? "Kopiert ✓" : "Kopieren"}
    </button>
  );

  // Portal to <body>: inside the Entwicklerbereich overlay (its own stacking
  // context) the Testmodus/Konflikt banners would still sit on top.
  return createPortal(
    // React events still bubble to the Entwicklerbereich backdrop (which closes on click).
    <div className="bp-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="bp-scroll" ref={scrollRef}>
        <div className="bp-inner">
          <div className="bp-top">
            <div className="bp-path">Entwicklerbereich › Bauplan</div>
            <button type="button" className="info-overlay-close" aria-label="Bauplan schließen" onClick={onClose}>
              ×
            </button>
          </div>
          <h2 className="bp-title">Bauplan {bauplan.app}</h2>
          <p className="bp-stand">Stand der Dokumentation: {bauplan.stand}</p>

          <section id="bp-schiff" className="bp-ship-wrap">
            <h3 className="bp-h3">Der Bauplan von {bauplan.app} – Erklärt an einem Schiff</h3>
            <svg className="bp-ship" viewBox="0 0 360 240" role="img" aria-label="Schiffsquerschnitt mit antippbaren Bauteilen">
              <rect x="0" y="150" width="300" height="90" fill="color-mix(in srgb, var(--glacier-deep) 22%, transparent)" />
              <path d="M0 152 q 15 -6 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0" fill="none" stroke="var(--glacier)" strokeWidth="1.5" opacity="0.6" />
              <path d="M28 96 L296 96 L270 172 L52 172 Z" fill="var(--lav)" stroke="var(--line)" strokeWidth="2" />
              <line x1="28" y1="96" x2="296" y2="96" stroke="var(--ink-soft)" strokeWidth="2" />
              {parts.map((p) => {
                const s = SHAPES[p.id];
                if (!s) return null;
                const color = ORT_COLOR[p.ort];
                return (
                  <g
                    key={p.id}
                    className="bp-part"
                    role="button"
                    tabIndex={0}
                    aria-label={`${p.name} – ${p.it}`}
                    onClick={() => jump(anchorId("b", p.id))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        jump(anchorId("b", p.id));
                      }
                    }}
                  >
                    {s.boat ? (
                      <path
                        d={`M${s.x} ${s.y} L${s.x + s.w} ${s.y} L${s.x + s.w - 8} ${s.y + s.h} L${s.x + 8} ${s.y + s.h} Z`}
                        fill={`color-mix(in srgb, ${color} 35%, var(--panel))`}
                        stroke={color}
                        strokeWidth="1.5"
                      />
                    ) : (
                      <rect
                        x={s.x}
                        y={s.y}
                        width={s.w}
                        height={s.h}
                        rx="4"
                        fill={`color-mix(in srgb, ${color} 35%, var(--panel))`}
                        stroke={color}
                        strokeWidth="1.5"
                      />
                    )}
                    <text x={s.x + s.w / 2} y={s.y + s.h / 2 + 3} textAnchor="middle" className="bp-part-label">
                      {s.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="bp-legend">
              {usedOrte.map((o) => (
                <span key={o}>
                  <i style={{ background: ORT_COLOR[o] }} /> {ORT_LABEL[o]}
                </span>
              ))}
            </div>
            {missing.length > 0 && (
              <p className="bp-missing">Nicht an Bord: {missing.map((p) => `${p.name} (${p.it})`).join(", ")}.</p>
            )}
          </section>

          <nav className="bp-bar" ref={barRef} aria-label="Bauteile">
            <button type="button" className="bp-chip bp-chip-ship" aria-label="Zurück zur Schiffsgrafik" onClick={() => jump("bp-schiff")}>
              ⚓
            </button>
            <button type="button" className="bp-chip" onClick={() => jump("bp-teil1")}>
              Beschreibung
            </button>
            {parts.map((p) => (
              <button
                type="button"
                key={p.id}
                className="bp-chip"
                style={{ borderColor: ORT_COLOR[p.ort], color: ORT_COLOR[p.ort] }}
                onClick={() => jump(anchorId("b", p.id))}
              >
                {p.name}
              </button>
            ))}
            <button type="button" className="bp-chip" onClick={() => jump("bp-monitoring")}>
              Monitoring
            </button>
            <button type="button" className="bp-chip" onClick={() => jump("bp-glossar")}>
              Glossar
            </button>
          </nav>

          <section id="bp-teil1">
            <h3 className="bp-h3">Teil 1 – Beschreibung der App</h3>
            {BESCHREIBUNG_BLOECKE.map((blk) => (
              <article className="bp-block" key={blk.key}>
                <div className="bp-block-head">
                  <h4>{blk.titel}</h4>
                  {copyBtn(blk.key, blk.titel, blk.get(bauplan))}
                </div>
                <p>{rich(blk.get(bauplan))}</p>
              </article>
            ))}
          </section>

          <section>
            <h3 className="bp-h3">Teil 2 – Die Bauteile im Detail</h3>
            {parts.map((p) => (
              <article className="bp-block" id={anchorId("b", p.id)} key={p.id} style={{ borderLeftColor: ORT_COLOR[p.ort] }}>
                <div className="bp-block-head">
                  <h4>
                    {p.name} <span className="bp-it">({p.it})</span>
                  </h4>
                  {copyBtn(p.id, `${p.name} (${p.it})`, p.text)}
                </div>
                <p className="bp-meta">
                  {ORT_LABEL[p.ort]} · {p.technik}
                </p>
                <p>{rich(p.text)}</p>
                <button type="button" className="bp-back" onClick={() => jump("bp-schiff")}>
                  ↑ zurück zum Schiff
                </button>
              </article>
            ))}
          </section>

          <section id="bp-monitoring">
            <h3 className="bp-h3">Teil 3 – Monitoring – Metrics History</h3>
            <article className="bp-block">
              <div className="bp-block-head">
                <h4>Status</h4>
              </div>
              <p>
                Noch nicht eingerichtet (Entscheidung vom 07.10.2026): Snapshots in einer Tabelle metrics_history, ein
                abgesicherter Status-Endpunkt und Verlaufskurven entstehen mit dem Umzug auf den netcup-Server, dort als
                nächtlicher systemd-Timer.
              </p>
            </article>
          </section>

          <section id="bp-glossar">
            <h3 className="bp-h3">Glossar</h3>
            <dl className="bp-glossar">
              {bauplan.glossar.map((g) => (
                <div className="bp-g" id={anchorId("g", g.id)} key={g.id}>
                  <dt>{g.begriff}</dt>
                  <dd>{rich(g.erklaerung)}</dd>
                </div>
              ))}
            </dl>
          </section>

          {bauplan.offen.length > 0 && (
            <section>
              <h3 className="bp-h3">Offene Punkte</h3>
              <ul className="bp-offen">
                {bauplan.offen.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </section>
          )}

          <button type="button" className="dev-btn dev-close" onClick={onClose}>
            Bauplan schließen
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
