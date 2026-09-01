// "Catching the bus" scenario: whoever picks this project back up next -
// possibly with zero memory of it (a new developer, or a future Claude
// session) - should be productive within ~7 minutes using only this text.
// Shown collapsed in the Feature-Request-Easter-Egg overlay (Footer -> 5x
// tap -> InfoOverlay), separate from the household-facing changelog/ideas.
// Keep this in sync with reality when the architecture changes - a stale
// briefing is worse than none.

export interface BriefingSection {
  heading: string;
  body: string;
}

export const DEV_BRIEFING: BriefingSection[] = [
  {
    heading: "Was das hier ist",
    body: "Ladeprotokoll + TCO-Rechner (Kosten pro gefahrenem km) für zwei E-Autos (Leapmotor B10 \"BIO-Leapy\", Leapmotor T03 \"Leapy\") der Familie Liese-Held. Next.js 16 (App Router, Turbopack), React 19, TypeScript strikt, kein CSS-Framework - reines app/globals.css.",
  },
  {
    heading: "Lokal starten",
    body: "npm install\n.env.local braucht: KV_REST_API_URL, KV_REST_API_TOKEN (Upstash Redis, via Vercel-Marketplace-Integration - NICHT die UPSTASH_REDIS_REST_*-Namen), LADEPROTOKOLL_PIN.\nnpm run dev\nTests: npm test (node:test, bisher nur lib/exports.test.ts).\nZum risikofreien Ausprobieren ohne echte Daten anzufassen: ?testmode=1 an die URL hängen (siehe lib/testData.ts).",
  },
  {
    heading: "Wo die Daten wirklich liegen",
    body: "EIN einziger Redis-Key (REDIS_KEY in lib/constants.ts) hält das komplette AppData-Objekt als JSON-Blob - kein Schema, keine Tabellen, keine Migrations-Tools. lib/redis.ts: getAppData()/setAppData(). lib/data.ts: migrate() füllt beim Laden fehlende Felder mit Defaults auf. WICHTIG: jedes neue Feld in AppData muss dort ergänzt werden, sonst verhält sich alter gespeicherter Stand beim nächsten Laden inkonsistent statt sauber zu crashen.",
  },
  {
    heading: "Nebenläufigkeit (AppData._rev)",
    body: "Zwei Haushaltsmitglieder können gleichzeitig auf verschiedenen Geräten speichern. _rev ist ein Zähler für optimistisches Locking: setAppData() lehnt ab (Konflikt), wenn der mitgeschickte _rev nicht mehr zum aktuell gespeicherten Stand passt. Kein echtes atomares Compare-and-Swap (Upstash REST kennt kein WATCH/MULTI) - nur GET-dann-vergleichen-dann-SET, ein bewusster Kompromiss statt einem ungetesteten Lua-Skript in Produktion. Details im Kommentar über setAppData in lib/redis.ts.",
  },
  {
    heading: "Komponentenkarte",
    body: "AppClient.tsx - Wurzel, hält den gesamten State, PIN-Gate, 800ms-Autosave-Debounce, Testmodus, Konflikt-/Testmodus-Banner.\nEntryFormModal.tsx - das Herzstück: Ladevorgang erfassen/bearbeiten, \"Vor\"/\"Nach\"-Accordion, die meisten Eingabe-Guards (Datum, Pflichtfelder, Duplikat-Erkennung).\nChargeTable.tsx - Lade-Historie-Liste.\nFixedCostsPanel / InvestmentsPanel / CardsPanel - Stammdaten (Leasing, Investitionen, Ladekarten).\nFooter.tsx + InfoOverlay.tsx - dieses Easter-Egg (5x Tap auf die Fußzeile).\nlib/data.ts - alle Berechnungen (TCO, km-Stand, Monatsstatement) als reine Funktionen ohne Nebenwirkungen.\nlib/testData.ts - erzeugt den Testmodus-Datensatz.",
  },
  {
    heading: "Eigenheiten, die überraschen könnten",
    body: "- km-Stand (ODO) wird manuell eingetragen, NICHT mehr automatisch geschätzt - die alte Schätzformel wurde bewusst entfernt (siehe Changelog V2.16), weil sie in der Praxis einfach denselben Wert immer wieder kopiert hat, statt echt zu schätzen.\n- b10 hat in den echten Daten oft leere Stichtag-Felder - das Tracking für b10 ist real noch nicht vollständig eingerichtet, das ist kein Bug.\n- Dieses Notizbuch hier speichert NICHT statisch, sondern über denselben Redis-Datensatz (data.featureRequests) - läuft durch dieselbe Autosave-Pipeline wie ein Ladevorgang auch.\n- Die Versionsnummer im Footer (package.json) und die Changelog-Version in projekt-pass.json werden von Hand synchron gehalten, es gibt keine Automatik dafür.",
  },
  {
    heading: "Vollständige Doku & Deployment",
    body: "/CLAUDE.md - Projektregeln, Versionierungsschema, Doku-Workflow.\n/Doku/PROJEKT-PASS-ANLEITUNG.md - wie projekt-pass.json gepflegt wird.\n/projekt-pass.json - changelog (jede Änderung mit Begründung, laienverständlich) und offene_punkte (bekannte Lücken, nicht verschwiegen).\nDeployment: Vercel, jeder Push auf master deployt automatisch. Env-Vars liegen in den Vercel-Projekteinstellungen, nicht in .env.local (die gilt nur lokal).",
  },
];
