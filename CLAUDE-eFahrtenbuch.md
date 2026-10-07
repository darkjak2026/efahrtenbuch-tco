# CLAUDE-eFahrtenbuch — Projektregeln

**Projekt:** eFahrtenbuch TCO (Familie Liese-Held)
**Urheber:** Jakobus Claudius Digitalensis (+KI-Claude)
**Version:** 2026-10-07|1.0.00 (SemVer+CalVer)
**Datei:** `CLAUDE-eFahrtenbuch.md` (fester Name, geladen über die Weiche `CLAUDE.md`)
**Änderungen gegenüber der Vorfassung:** Die alte `CLAUDE.md` war eine Kopie des früheren allgemeinen
Regelwerks (Stand 2026-09-01|1.4.01). Sie ist ersetzt durch die Weiche `CLAUDE.md` und diese Projektdatei.
Allgemeines steht nur noch in `CLAUDE-Allgemein.md`. Die Vorfassung liegt in der Git-Historie.

Allgemeine Regeln: `C:\Claude-Code\Doku-Streßtest KI-Projekte\CLAUDE-Allgemein.md` (benutzerweit geladen).
Bei Widerspruch gilt diese Datei.

@AGENTS.md

---

## 1. Abweichungen von CLAUDE-Allgemein

- **Projekt-Pass liegt im Wurzelordner, nicht unter `/Doku`:** `projekt-pass.json` und `PROJEKT-PASS.pdf`
  liegen historisch bedingt in der Projektwurzel. Die App liest das Changelog direkt aus `projekt-pass.json`.
  PDF erzeugen (von der Projektwurzel aus): `python Doku/build_pdf.py projekt-pass.json PROJEKT-PASS.pdf`
- **Notizen im Entwicklerbereich liegen auf dem Server (6.4):** Die Wünsche stehen im gemeinsamen
  Datensatz (`data.featureRequests` in Upstash Redis), damit sie auf allen Geräten gleich sind (Entscheidung
  des Urhebers vom 07.10.2026). Nur der ungespeicherte Entwurf liegt im `localStorage` unter
  `efahrtenbuch_notizblock_v2_entwurf`. Gespeichertes Zeitformat `JJJJ-MM-TT||HH:MM`, angezeigt als
  `TT.MM.JJJJ HH:MM`.
- **Status „erledigt“:** Zusätzlich zu offen/übernommen/verworfen gibt es in der App ein Häkchen
  „erledigt“. Beim Exportieren wird es als „übernommen“ ausgegeben.

## 2. Version

- Einzige Quelle ist der neueste Eintrag im `changelog` von `projekt-pass.json` (`lib/version.ts`:
  `VERSIONSVERLAUF`, `TOOL_VERSION`). Jede Text-Zeile beginnt mit der Art (`Neu:`, `Härtung:`,
  `Behoben:`, `Design:`).
- `package.json` von Hand mitziehen (striktes SemVer, z. B. `2.26.0` zu `2.26.00`).
  `lib/version.test.ts` prüft das.

## 3. Prüfen und Ausliefern

- Vor jedem Push: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Jeder Push auf `master` geht über Vercel sofort live in die Alltags-App des Haushalts. Testen ohne echte
  Daten: `?testmode=1` an die Adresse hängen.
- Geheimnisse (`LADEPROTOKOLL_PIN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`) liegen nur in `.env.local` und
  in den Vercel-Projekteinstellungen, nie im Code oder in der Doku.

## 4. Bauplan pflegen (verbindlich)

- Nach jeder Bauphase, jedem neuen Feature, jeder neuen Abhängigkeit und jeder Änderung an Hosting,
  Datenbank oder API: `docs/technisch/bauplan.json` prüfen und aktualisieren, danach `npm run bauplan`
  ausführen. Das prüft die Verweise, setzt „Stand“ und erzeugt `docs/technisch/bauplan.md`; nie von Hand
  bearbeiten.
- Neue Fachbegriffe ins Glossar aufnehmen und verlinken (`[Text](g:id)`, Bauteile `[Text](b:id)`).
- Erledigte `OFFEN:`-Punkte auflösen, neue Lücken als `OFFEN:` eintragen.
- Wichtige Ereignisse als Meilenstein für das Monitoring eintragen (Monitoring folgt mit dem Umzug auf
  netcup).
- Keine Geheimnisse in den Bauplan schreiben.
