# CLAUDE-eFahrtenbuch — Projektregeln

**Projekt:** eFahrtenbuch TCO (Familie Liese-Held)
**Urheber:** Jakobus Claudius Digitalensis (+KI-Claude)
**Version:** 2026-10-08|1.2.00 (SemVer+CalVer) – Abschnitt 4: Monitoring läuft; Abschnitt 1: Datensatz in Postgres
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
  Datensatz (`data.featureRequests`, seit 08.10.2026 in Postgres auf dem eigenen Server), damit sie auf allen Geräten gleich sind (Entscheidung
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

- Vor jedem Deploy: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- **Seit 08.10.2026 läuft die App auf dem eigenen netcup-Server** (derselbe wie VitalCoach/VoiceNotes,
  SSH-Alias `vitalcoach`). Ausliefern vom PC in Git Bash: `bash server/deploy.sh` – Tests, Build, Upload,
  Probelauf auf Port 8021, Umschalten, automatischer Rückweg (Vorbild VoiceNotes). Ein Push auf GitHub
  allein ändert die Alltags-App nicht mehr.
- Aufbau auf dem Server: Dienst `efahrtenbuch` (Systembenutzer, Sandbox, Port 8020), Code unter
  `/opt/efahrtenbuch/releases/…`, Zugangsdaten in `/etc/efahrtenbuch/efahrtenbuch.env` (DATABASE_URL,
  LADEPROTOKOLL_PIN, optional GRAPHHOPPER_API_KEY bzw. ORS_API_KEY – trägt der Urheber per
  `server/graphhopper_schluessel.sh` selbst ein), Postgres-Datenbank `efahrtenbuch_db`, Caddy-Eintrag `/etc/caddy/efahrtenbuch.caddy`,
  nächtliche Sicherung im gemeinsamen `~/scripts/backup_db.sh` (Quelle im VitalCoach-Repo).
- Speicher-Weiche `lib/store.ts`: mit `DATABASE_URL` Postgres, sonst Upstash (nur noch die alte Vercel-Version,
  die per `movedTo` im Datensatz gesperrt ist und auf die neue Adresse verweist).
- Das GitHub-Repository ist **öffentlich**: Server-IP und Adresse nie in Code oder Doku schreiben, die
  nip.io-Adresse ermittelt `setup_server.sh` auf dem Server selbst.
- Testen ohne echte Daten: `?testmode=1` an die Adresse hängen.
- Geheimnisse liegen nur in `.env.local` (lokal) und in der env-Datei auf dem Server, nie im Code oder in der Doku.

## 4. Bauplan pflegen (verbindlich)

- Nach jeder Bauphase, jedem neuen Feature, jeder neuen Abhängigkeit und jeder Änderung an Hosting,
  Datenbank oder API: `docs/technisch/bauplan.json` prüfen und aktualisieren, danach `npm run bauplan`
  ausführen. Das prüft die Verweise, setzt „Stand“ und erzeugt `docs/technisch/bauplan.md`; nie von Hand
  bearbeiten.
- Neue Fachbegriffe ins Glossar aufnehmen und verlinken (`[Text](g:id)`, Bauteile `[Text](b:id)`).
- Erledigte `OFFEN:`-Punkte auflösen, neue Lücken als `OFFEN:` eintragen.
- Wichtige Ereignisse als Meilenstein für das Monitoring eintragen (`meilensteine` in `bauplan.json`,
  Datum `JJJJ-MM-TT`, zeitlich sortiert – ein Test prüft das).
- Monitoring (seit 2.37.00): Messung in `lib/monitoring.ts`, Abfrage `/api/status` (PIN), Timer
  `server/efahrtenbuch-snapshot.*` (23:50 und bei jedem Deploy). Neue Kennzahl = Spalte in
  `metrics_history` (Schema, `COLS`, Retention) und Anzeige in `components/MonitoringView.tsx`.
  Nach einem Deploy kurz in den Bauplan schauen (Sicherung OK, Fehler 0).
- Keine Geheimnisse in den Bauplan schreiben.
