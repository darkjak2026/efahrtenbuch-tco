# Projekt-Pass — Anleitung für die KI (z.B. Claude Code)

Diese Datei in jedes neue Projekt legen (z.B. als Teil von `CLAUDE.md` einfügen oder
danebenlegen). Sie sagt der KI, wie sie den Projekt-Pass automatisch mitpflegt.

## Was ist das

`projekt-pass.json` ist die editierbare Quelle für ein PDF-Dokument ("Projekt-Pass"),
das zusammenfasst: Absicht des Projekts, Funktionsumfang, Abhängigkeiten (Hosting,
Dienste, Accounts) und ein Änderungsprotokoll. `build_pdf.py` wandelt diese JSON-Datei
in `PROJEKT-PASS.pdf` um.

## Verhalten, das von dir erwartet wird

1. **Beim Start eines neuen Projekts**: Kopiere `projekt-pass.template.json` nach
   `projekt-pass.json` in den Projektordner. Fülle sofort aus, was zu diesem
   Zeitpunkt schon bekannt ist (Projektname, Absicht, geplanter Funktionsumfang).
2. **Bei jeder nennenswerten Änderung** (neues Feature, neue Abhängigkeit, Bugfix an
   einer Berechnung/Kernlogik, Wechsel des Hosting-Anbieters o.ä.):
   - Aktualisiere die passende Sektion in `projekt-pass.json` direkt mit.
   - Ergänze **immer** eine neue Zeile in `changelog` mit Datum, Versionsnummer und
     einer kurzen, verständlichen Beschreibung (kein Fachjargon, für den Menschen
     nach einer Pause verständlich).
   - Trage neue Dienste/Accounts unter `dienste` bzw. `accounts` ein, sobald sie ins
     Projekt kommen — nicht erst am Ende.
3. **Nach dem Bearbeiten von `projekt-pass.json`**: `python3 build_pdf.py` ausführen,
   damit `PROJEKT-PASS.pdf` synchron bleibt.
4. **Unklarheiten nicht verschweigen**: Wenn du selbst nicht sicher bist, wofür ein
   Dienst genutzt wird oder ob eine Angabe noch stimmt, trage das offen unter
   `offene_punkte` ein, statt zu raten oder es wegzulassen.
5. **Sicherheit**: Unter `accounts` niemals echte Passwörter, API-Keys oder Tokens im
   Klartext eintragen — nur den Hinweis, wo sie hinterlegt sind (Passwort-Manager,
   `.env`-Datei, Vercel Environment Variables, etc.).
6. **Feature-Request-Easter-Egg**: Hat die Anwendung eine Oberfläche mit sichtbarer
   Versionsnummer, gehört standardmäßig folgender versteckter Mechanismus dazu, damit
   spontane Ideen der Nutzerin/des Nutzers nicht verloren gehen:
   - 5x Klick/Tippen auf die Versionsnummer öffnet ein Overlay im selben Fenster mit
     zwei Bereichen:
     - **Changelog**: die Einträge aus `changelog`, jeweils hinter dem Zeitstempel
       eingeklappt. Die Kurzbeschreibung ist bewusst einfach/laienverständlich
       formuliert; IT-Fachbegriffe stehen zusätzlich in Klammern dahinter, damit auch
       ein technisch informierter Dritter zuordnen kann, was gemeint ist.
     - **Feature-Request-Editor**: wirkt wie ein kleiner Notizeditor im selben
       Fenster. Klick/Tipp erzeugt automatisch einen neuen Zeitstempel im Format
       `[JJJJ-MM-TT||HH:MM]:`, danach ist der Text frei beschreibbar. Hier trägt die
       Nutzerin/der Nutzer eigene Ideen für zukünftige Funktionen ein.
   - Die Einträge des Feature-Request-Editors werden unter `feature_requests` in
     `projekt-pass.json` gespeichert (Format wie `changelog`:
     `[Zeitstempel, Text, Status]`, Status z.B. `"offen"`/`"übernommen"`/`"verworfen"`).
   - **Beim Start eines neuen Projekts** ist dieser Mechanismus standardmäßig mit
     einzubauen, sofern die Anwendung eine Oberfläche hat — außer es wird
     ausdrücklich anders gewünscht.
   - **Spätestens beim Schreiben/Aktualisieren der Dokumentation** (also immer, wenn
     `projekt-pass.json` ohnehin angefasst wird): prüfe `feature_requests` auf neue
     Einträge mit Status `"offen"`. Sprich diese aktiv an, bevor mit der eigentlichen
     Aufgabe weitergemacht wird, statt sie kommentarlos liegen zu lassen. Übernimm
     entschiedene Punkte je nach Ausgang entweder nach `offene_punkte` (wenn noch zu
     klären) oder direkt ins nächste Changelog (wenn umgesetzt), und setze den Status
     entsprechend. So bleiben im Overlay eingetragene Ideen nicht folgenlos, weil sie
     an den ohnehin verpflichtenden Dokumentationsschritt gekoppelt sind.

## Format von projekt-pass.json (Kurzreferenz)

- `funktionen`, `hosting`, `dienste`, `accounts`, `changelog`, `feature_requests`:
  jeweils eine Liste von Listen (= Tabellenzeilen).
  `changelog`-Zeilen: `["TT.MM.JJJJ", "Version", "Was wurde geändert"]`.
  `feature_requests`-Zeilen: `["[JJJJ-MM-TT||HH:MM]", "Ideentext", "Status"]` — kommen
  aus dem Feature-Request-Easter-Egg der Anwendung, siehe Punkt 6 oben.
- `offene_punkte`: einfache Liste von Text-Strings.
- `urheber`, `status`, `dsgvo_status`, `daten_speicherort`, `avv_stand`, `backup`, `lizenz`:
  einfache Text-Strings, siehe CLAUDE.md Abschnitt 4 (Metadaten-Wizard) für die Bedeutung
  jedes Feldes. `dsgvo_status` ist Pflichtfeld, sobald personenbezogene Daten (insbesondere
  von Minderjährigen) im Projekt vorkommen können.
- Alle anderen Felder: einfache Text-Strings.
- Emoji und Symbole außerhalb des Standard-Zeichensatzes werden beim PDF-Export
  automatisch entfernt (die PDF-Schriftart kann sie nicht darstellen) — im
  Projektnamen etc. lieber ohne Emoji arbeiten.
