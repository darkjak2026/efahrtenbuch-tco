// "Catching the bus" scenario: whoever picks this project back up next -
// possibly with zero memory of it (a new developer, or a future Claude
// session) - should be productive within ~7 minutes using only this text.
// Shown collapsed in the Entwicklerbereich (Footer -> 5x tap on the version
// number -> DevArea), next to the notes, version history and Bauplan.
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
    body: "npm install\n.env.local braucht: LADEPROTOKOLL_PIN und entweder DATABASE_URL (Postgres) oder KV_REST_API_URL/KV_REST_API_TOKEN (Upstash, nur noch die alte Vercel-Version).\nnpm run dev\nTests: npm test (node:test, lib/*.test.ts). Nach Änderungen am Bauplan: npm run bauplan.\nZum risikofreien Ausprobieren ohne echte Daten: ?testmode=1 an die URL hängen (siehe lib/testData.ts).",
  },
  {
    heading: "Wo die Daten wirklich liegen",
    body: "Seit 08.10.2026: EINE Zeile in Postgres (Tabelle app_data, id 'main') hält das komplette AppData-Objekt als JSON - kein Schema pro Feld. lib/store.ts wählt den Speicher (DATABASE_URL -> lib/pg-store.ts, sonst lib/redis.ts für die alte Vercel-Version). lib/data.ts: migrate() füllt beim Laden fehlende Felder mit Defaults auf. WICHTIG: jedes neue Feld in AppData muss dort ergänzt werden, sonst verhält sich alter gespeicherter Stand beim nächsten Laden inkonsistent statt sauber zu crashen.",
  },
  {
    heading: "Nebenläufigkeit (AppData._rev)",
    body: "Zwei Haushaltsmitglieder können gleichzeitig auf verschiedenen Geräten speichern. _rev ist ein Zähler für optimistisches Locking: setAppData() lehnt ab (Konflikt), wenn der mitgeschickte _rev nicht mehr zum aktuell gespeicherten Stand passt. Auf Postgres echtes atomares Compare-and-Swap (UPDATE ... WHERE rev = erwartete Revision, lib/pg-store.ts). Die alte Upstash-Variante (lib/redis.ts) konnte nur GET-dann-vergleichen-dann-SET.",
  },
  {
    heading: "Komponentenkarte",
    body: "AppClient.tsx - Wurzel, hält den gesamten State, PIN-Gate, 800ms-Autosave-Debounce, Testmodus, Konflikt-/Testmodus-Banner.\nEntryFormModal.tsx - das Herzstück: Ladevorgang erfassen/bearbeiten, \"Vor\"/\"Nach\"-Accordion, die meisten Eingabe-Guards (Datum, Pflichtfelder, Duplikat-Erkennung).\nMonthNav.tsx - schwebende Monatsleiste (◀ ▶, Monatsauswahl, Pfeiltasten). LeasingCountdown.tsx - Freikilometer-Countdown in den TCO-Karten (Rechnung: lib/data.ts leasingKm). ChargeTable.tsx - Lade-Historie in zwei Spalten (links B10, rechts t03, Wischen wechselt den Monat), je Spalte nach Kalenderwochen (lib/data.ts monthWeeks, weekSums); MonthVehicleCards.tsx - Monatsübersicht je Auto (TCO/km, Laden/km; Rechnung in lib/data.ts monthCosts). CostRing.tsx - Kostenring mit Trendpfeilen und Statistik-Blatt (Rechnung: lib/data.ts costStats, trendDegrees), Symbole in CostIcons.tsx.\nFixedCostsPanel / InvestmentsPanel / CardsPanel - Stammdaten (Leasing, Investitionen, Ladekarten).\nFooter.tsx + DevArea.tsx - dieser Entwicklerbereich (5x Tap auf die Versionsnummer); BauplanView.tsx - Bauplan (Inhalt: docs/technisch/bauplan.json).\nlib/data.ts - alle Berechnungen (TCO, km-Stand, Monatsstatement) als reine Funktionen ohne Nebenwirkungen.\nlib/testData.ts - erzeugt den Testmodus-Datensatz.",
  },
  {
    heading: "Eigenheiten, die überraschen könnten",
    body: "- km-Stand (ODO) wird manuell eingetragen, NICHT mehr automatisch geschätzt - die alte Schätzformel wurde bewusst entfernt (siehe Changelog V2.16), weil sie in der Praxis einfach denselben Wert immer wieder kopiert hat, statt echt zu schätzen.\n- b10 hat in den echten Daten oft leere Stichtag-Felder - das Tracking für b10 ist real noch nicht vollständig eingerichtet, das ist kein Bug.\n- Dieses Notizbuch hier speichert NICHT statisch, sondern über denselben Redis-Datensatz (data.featureRequests) - läuft durch dieselbe Autosave-Pipeline wie ein Ladevorgang auch.\n- Einzige Quelle der Versionsnummer ist der neueste changelog-Eintrag in projekt-pass.json (lib/version.ts). package.json muss von Hand mitgezogen werden; lib/version.test.ts schlägt fehl, wenn beide auseinanderlaufen.",
  },
  {
    heading: "Vollständige Doku & Deployment",
    body: "/CLAUDE-eFahrtenbuch.md - Projektregeln (geladen über die Weiche /CLAUDE.md), Abschnitt 3: Server und Deploy.\n/docs/technisch/bauplan.md - Bauplan (technischer Aufbau) zum Lesen.\n/projekt-pass.json - changelog und offene_punkte.\nDeployment: eigener netcup-Server, vom PC aus mit bash server/deploy.sh (Probelauf auf Port 8021, automatischer Rückweg). Ein Push auf GitHub allein ändert nichts an der laufenden App. Zugangsdaten nur in /etc/efahrtenbuch/efahrtenbuch.env auf dem Server.",
  },
];
