@AGENTS.md

> **Projekt-Hinweis (Abweichung von Abschnitt 3 unten):** In diesem Projekt liegt
> `projekt-pass.json` und das erzeugte `PROJEKT-PASS.pdf` historisch bedingt im
> Wurzelverzeichnis, nicht unter `/Doku`. `/Doku` enthält nur die Vorlagen
> (`build_pdf.py`, `PROJEKT-PASS-ANLEITUNG.md`, `projekt-pass.template.json`) sowie
> `PROJEKT-PASS-ANLEITUNG.md`. Beim Ausführen von `build_pdf.py` entsprechend die
> Pfade zu Root angeben, z. B. `python3 Doku/build_pdf.py projekt-pass.json
> PROJEKT-PASS.pdf` (von der Projektwurzel aus).

---

# CLAUDE.md — Projekt- und Versionierungsregeln

**Version dieser Datei:** 2026-09-01|1.4.01 (SemVer+CalVer)
**Gültig für:** alle bestehenden und zukünftigen Projekte von Jakobus Claudius Digitalensis
**Hinweis:** Diese Datei ist das **einzige** Regelwerk-Dokument und unterliegt selbst den unten beschriebenen Versionierungsregeln. Sie ersetzt die vormals getrennten Dateien "Versionierungs-Regelwerk" und "CLAUDE.md-Vorlage".

> Diese Datei wird von Claude Code bei jedem Sitzungsstart automatisch eingelesen (siehe Abschnitt 6), bevor irgendeine andere Aufgabe begonnen wird.

---

## 1. Versionsformat (SemVer+CalVer)

```
JJJJ-MM-TT|MAJOR.MINOR.PATCH[+design.NN] (SemVer+CalVer)
```

**Beispiele:**
```
2026-09-01|0.3.00+design.02 (SemVer+CalVer)   ← interne Entwicklungsphase
2026-09-01|1.0.00 (SemVer+CalVer)              ← bewusst gewählter "Launch"
2026-09-01|1.2.03+design.05 (SemVer+CalVer)    ← reguläre Weiterentwicklung
```

| Feld | Bedeutung | Beispiel-Änderungen |
|---|---|---|
| `JJJJ-MM-TT` | Datum der Veröffentlichung dieser Version, ISO 8601 | — |
| `MAJOR` (vorne) | Nutzungs-/Usability-relevante Änderungen, neue zentrale Features, Breaking Changes | Neues Bedienkonzept, neues Kernfeature, Datenstruktur inkompatibel zur Vorversion |
| `MINOR` (Mitte) | Neue Funktionalität, ohne bestehende Abläufe zu brechen | Neuer Button/Export-Typ, zusätzliche Auswertung, neues optionales Feld |
| `PATCH` (hinten) | Kleine, nutzungsneutrale Korrekturen | Bugfix, Tippfehler, kleine Performance-Optimierung |
| `+design.NN` | Design-Iterationen seit letzter MINOR/PATCH-Version (offizielle SemVer-Build-Metadaten) | Farbanpassung, Layout-Feinschliff, Icon getauscht |

**Warum dieses Format:** SemVer (`MAJOR.MINOR.PATCH`) ist der international etablierteste Standard für Software-Versionierung (semver.org). ISO 8601 (`JJJJ-MM-TT`) ist die international genormte, sprachunabhängige Datumsschreibweise. Build-Metadaten (`+design.NN`) sind regulärer, offizieller Bestandteil der SemVer-Spezifikation. Das Format ist rein textbasiert und bleibt daher auch in 10+ Jahren ohne Zusatzwerkzeug interpretierbar.

**Vor-Launch-Phase (0.y.z):** Solange ein Projekt sich im "Erschaffungsstadium" befindet, beginnt MAJOR bei `0` (z. B. `0.1.0`, `0.4.12`) — keine Stabilitätsgarantie, alles darf sich jederzeit ändern. Der Sprung auf `1.0.0` ist ein **bewusster, vom Urheber selbst gewählter Schritt** ("Marketing-Launch") — unabhängig davon, wie viele interne 0.x-Versionen vorher existierten.

---

## 2. Urheber- und Versionsnennung (Pflichtregel)

- **Zu Beginn jedes neuen Projekts** aktiv nach dem **Urheber** des Werkes fragen.
- Die **Versionsnummer** wird **in unmittelbarer Nähe der Urheber-Nennung** platziert (Datei-Kopfkommentar und/oder UI-Footer).
- Die Versionsnummer muss **öffentlich sichtbar im UI** stehen (z. B. Footer der Anwendung), nicht nur im Quellcode-Kommentar.
- Bei KI-Beteiligung: kurzer Vermerk direkt im Urheber-Feld, Format `Jakobus Claudius Digitalensis (+KI-[Tool])`, z. B. `(+KI-Claude)`.

**Beispiel Datei-Kopf:**
```
Projekt: [Projektname]
Urheber: Jakobus Claudius Digitalensis (+KI-Claude)
Version: 2026-09-01|1.2.03+design.05 (SemVer+CalVer)
```

**Beispiel UI-Footer:**
```
v1.2.03+design.05 — Jakobus Claudius Digitalensis (+KI-Claude)
```

---

## 3. Der Doku-Ordner: Projekt-Pass-System

- Jedes Projekt erhält **seinen eigenen, dezentralen Doku-Ordner** (kein zentraler, projektübergreifender Ordner).
- Statt separater `metadata.md`/`CHANGELOG.md`-Dateien wird das bereits bestehende **Projekt-Pass-System** verwendet: `projekt-pass.json` ist die editierbare Datenquelle, `build_pdf.py` erzeugt daraus `PROJEKT-PASS.pdf`. Das Changelog liegt direkt im JSON (`changelog`-Array) — eine separate `CHANGELOG.md` entfällt dadurch.
- Empfohlener Aufbau:
  ```
  /Doku
    ├── projekt-pass.json           ← editierbare Datenquelle (Metadaten, Changelog, Feature-Requests, offene Punkte)
    ├── PROJEKT-PASS.pdf            ← generiertes, menschenlesbares Ergebnis
    ├── build_pdf.py                ← Generator-Skript (JSON → PDF)
    └── PROJEKT-PASS-ANLEITUNG.md   ← volle Verhaltensregeln (Abschnitt 4a ist deren Kurzfassung)
  /CLAUDE.md                        ← diese Datei (Projekt-Wurzelverzeichnis, NICHT in /Doku)
  ```
  (Für dieses Projekt siehe den Abweichungs-Hinweis ganz oben.)
- Diese `CLAUDE.md` selbst übernimmt die Rolle des früheren separaten Regelwerks — es gibt bewusst **nur noch eine** zentrale Regel-Datei pro Projekt, um die Dateizahl gering zu halten.
- Vollständige Verhaltensregeln für den Umgang mit `projekt-pass.json` (wann aktualisieren, wie das Changelog formuliert wird, Sicherheitsregel für Zugangsdaten, Feature-Request-Easter-Egg) stehen in der separaten `PROJEKT-PASS-ANLEITUNG.md`, die inhaltlich unter Abschnitt 4a zusammengefasst ist.

---

## 4. Metadaten-Wizard (bei Erstdokumentation)

Bei der **Erstdokumentation** eines Projekts alle folgenden Felder routiniert, einzeln und in einfacher, leicht verständlicher Sprache abfragen (kein Feld auslassen) und in `projekt-pass.json` eintragen:

| Kategorie | Feld in `projekt-pass.json` | Nutzen |
|---|---|---|
| Identifikation | `projektname`, `absicht` | Schnelle Einordnung, auch nach Jahren |
| Verantwortlichkeit | `urheber` | Klare Zuständigkeit |
| Status | `status` (aktiv / archiviert / Prototyp / eingestellt / pausiert) | Verhindert Arbeit an veralteten Ständen |
| Zeitachse | `live_seit`, `aktualisiert`, `naechste_pruefung` | Nachvollziehbarkeit über Zeit |
| Technik | `dienste`, `hosting` | Wichtig für spätere Wartung |
| Datenschutz | `dsgvo_status`, `daten_speicherort`, `avv_stand` | **Pflichtfeld**, da Fälle mit Minderjährigen betroffen sein können |
| Sicherung | `backup` | Schutz vor Datenverlust |
| Änderungshistorie | `changelog` | Zentrale Übersicht aller Versionen |
| Bekanntes | `offene_punkte` | Vermeidet doppelte Fehlersuche |
| Transparenz | KI-Beteiligung, ergänzend zum Kurzvermerk im Urheber-Feld | Nachvollziehbarkeit der Entstehung |
| Lizenz/Nutzung | `lizenz` | Klärung bei Weitergabe |
| Zugangsdaten | `accounts` (nur Hinweis WO hinterlegt, nie Klartext-Passwörter) | Sicherheit |
| Kosten/Wert | `kosten_und_wertschaetzung` | Grobe, informelle Einordnung |

---

## 4a. Projekt-Pass-Workflow (Kurzfassung der PROJEKT-PASS-ANLEITUNG)

1. **Bei Projektstart**: `projekt-pass.template.json` nach `projekt-pass.json` kopieren, sofort ausfüllen, was schon bekannt ist.
2. **Bei jeder nennenswerten Änderung** (neues Feature, neue Abhängigkeit, Bugfix an Kernlogik, Hosting-Wechsel): passende Sektion aktualisieren **und** immer eine neue `changelog`-Zeile ergänzen (Datum, Version, laienverständliche Kurzbeschreibung). Neue Dienste/Accounts sofort eintragen, nicht erst am Ende.
3. **Nach jeder Bearbeitung von `projekt-pass.json`**: `python3 build_pdf.py` ausführen, damit `PROJEKT-PASS.pdf` synchron bleibt.
4. **Unklarheiten nicht verschweigen**: Unsicherheiten offen unter `offene_punkte` eintragen statt zu raten.
5. **Sicherheit**: Unter `accounts` nie echte Passwörter/API-Keys im Klartext — nur der Hinweis, wo sie hinterlegt sind.
6. **Feature-Request-Easter-Egg** (Standard bei jeder Anwendung mit sichtbarer Versionsnummer, sofern nicht ausdrücklich anders gewünscht): 5× Klick auf die Versionsnummer öffnet ein Overlay mit Changelog-Ansicht (laienverständlich, Fachbegriffe in Klammern) und einem Feature-Request-Editor (Zeitstempel `[JJJJ-MM-TT||HH:MM]`, frei beschreibbar). Einträge landen unter `feature_requests` (`[Zeitstempel, Text, Status]`, Status `"offen"`/`"übernommen"`/`"verworfen"`).
   - **Spätestens bei jeder Doku-Aktualisierung**: offene Einträge in `feature_requests` aktiv ansprechen, bevor mit der eigentlichen Aufgabe weitergemacht wird. Entschiedene Punkte je nach Ausgang nach `offene_punkte` (noch zu klären) oder direkt ins nächste Changelog (umgesetzt) übernehmen, Status entsprechend setzen.

---

## 4b. Stresstest vor größeren Releases

Für Anwendungen mit UI steht eine wiederverwendbare **Stresstest-Vorlage** zur Verfügung (technische Szenarien wie Doppelklick, Grenzwerte, konkurrierender Zugriff; menschlicher Faktor wie Abbruch mitten im Workflow, blindes Wegklicken von Warnungen, Minimalangaben). Anwendung: Abschnitt "Anwendungssteckbrief" projektspezifisch ausfüllen, passende Szenario-Kategorien auswählen, idealerweise automatisiert (z. B. Playwright) durchführen lassen. Sinnvoller Anlass: vor einem bewussten `1.0.0`-Launch oder vor einer größeren MAJOR-Version.

---

## 5. Wiederkehrende Dokumentationspflicht

- **Kein fester Zeitplan.** Stattdessen: Während der laufenden Arbeit an einem Projekt selbstständig erkennen, wenn sich eine **Dokumentationsabsicht** abzeichnet (z. B. neues Feature, DSGVO-relevante Änderung, Statuswechsel, größerer Umbau) — und dann **aktiv anbieten**, `projekt-pass.json` fortzuschreiben und `build_pdf.py` erneut laufen zu lassen.
- **Noch offen** (bei Gelegenheit gemeinsam zu klären):
  - Soll zusätzlich zur anlassbezogenen Erkennung ein Rückfall-Mechanismus greifen, falls ein Projekt sehr lange gar nicht bearbeitet wird?
  - Werden bei Anlassfall alle Metadatenfelder erneut kurz durchgegangen, oder nur die zum Anlass passenden?
  - Wie wird mit erkannten Diskrepanzen zwischen dokumentiertem und tatsächlichem Status umgegangen (beiläufig erwähnen vs. aktiv Korrektur vorschlagen)?

---

## 6. Technische Grundlage: automatisches Einlesen

CLAUDE.md-Dateien können im Projekt-Wurzelverzeichnis oder unter `.claude/CLAUDE.md` liegen und werden von Claude Code bei jedem Sitzungsstart automatisch gelesen. Damit greifen die Regeln aus dieser Datei ab der ersten Codezeile, ohne manuelles Anstoßen. Namen, Speicherorte und Ladeverhalten solcher KI-Instruktionsdateien können sich mit Produktupdates ändern — vor größeren Festlegungen lohnt ein Blick in die aktuelle Dokumentation: https://code.claude.com/docs/en/memory

---

## 7. Ablauf bei neuem Projekt (Zusammenfassung)

1. Nach dem **Urheber** fragen.
2. Fragen, ob/wie die **Versionierung** in diesem Projekt gehandhabt werden soll.
3. `/Doku`-Ordner mit `projekt-pass.json` (aus Template), `build_pdf.py` und `PROJEKT-PASS-ANLEITUNG.md` anlegen bzw. referenzieren; diese `CLAUDE.md` ins Projekt-Wurzelverzeichnis legen (nicht in `/Doku`).
4. Versionsnummer **direkt neben der Urheber-Nennung** im Code/UI platzieren.
5. Jede Änderung laufend im `changelog`-Feld von `projekt-pass.json` protokollieren, danach `build_pdf.py` ausführen.
6. Bei Anwendungen mit UI: Feature-Request-Easter-Egg einbauen (siehe 4a), sofern nicht ausdrücklich anders gewünscht.
7. Vor einem bewussten `1.0.0`-Launch oder größeren MAJOR-Versionen: Stresstest-Vorlage anwenden (siehe 4b).
