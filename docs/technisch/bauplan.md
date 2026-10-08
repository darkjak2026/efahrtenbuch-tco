# Bauplan eFahrtenbuch

> Erzeugt aus `docs/technisch/bauplan.json` mit `npm run bauplan` – nicht von Hand bearbeiten.

Stand der Dokumentation: 08.10.2026 | 07:02

## Teil 1 – Beschreibung der App

### Kurz gesagt

Das eFahrtenbuch ist ein gemeinsames Ladeprotokoll für die zwei E-Autos der Familie Liese-Held (Leapmotor B10 „BIO-Leapy“ und T03 „Leapy“). Aus jedem Ladevorgang und den Fixkosten rechnet es laufend aus, was ein gefahrener Kilometer wirklich kostet (TCO). Die App läuft im Handy-Browser, die Daten liegen zentral in einem gemieteten Lagerhaus.

### 1.1 Ausgangslage, Vorüberlegungen, Zielsetzung

Am Anfang stand eine einzelne HTML-Datei, die nur auf einem Gerät speichern konnte. Ziel war, dass beide Haushaltsmitglieder vom eigenen Handy aus Ladevorgänge eintragen und dieselben Zahlen sehen. Deshalb wurde die App am 05.07.2026 auf Next.js umgebaut, bekam einen gemeinsamen Speicher (Redis bei Upstash) und einen Liegeplatz bei Vercel. Bewusst klein gehalten: ein gemeinsamer PIN statt Benutzerkonten, ein einziger Datensatz statt Datenbanktabellen.

### 1.2 Aktueller Funktionsumfang und Features

Ladevorgänge werden in zwei Schritten erfasst: „Vor“ dem Laden (Fahrzeug, km-Stand (ODO), Ladekarte, €/kWh, Standort per GPS) und „Nach“ dem Laden (kWh, Reichweite, Dauer). Die Oberfläche ist zweigeteilt (links B10, rechts t03): oben €/km und ein Countdown der Leasing-Freikilometer je Auto, darunter die Lade-Historie mit schwebender Monatsleiste, Ladevorgängen nach Kalenderwochen und je Auto einer Monatskarte (TCO je km, Ladekosten je km, gefahrene km und Fitnessringe je Kostenart mit Trendpfeilen; antippen zeigt Vormonat, Minimum und Maximum). Dazu PDF- und Excel-Exporte. Dazu kommen Fixkosten, Investitionen (über 36 Monate verteilt), Ladekarten, ein Testmodus mit erfundenen Daten und dieser Entwicklerbereich.

### 1.3 Backup, Datensicherung, Datenschutz

Ein automatisches Backup gibt es nicht: gesichert wird nur per Hand über „Exportieren aller Daten“ als JSON-Datei aufs Gerät. Die Daten (Ladeorte mit Koordinaten, km-Stände, Kosten) liegen bei Upstash; OFFEN: in welcher Region (EU/USA) und mit welchem Auftragsverarbeitungsvertrag (AVV). Zugang nur mit dem Haushalts-PIN, der im Tresor liegt. Beim GPS-Abruf gehen die Koordinaten an Open Charge Map und OpenStreetMap (Funk).

### 1.4 Abhängigkeiten und beteiligte Dienste

Vercel (Hosting und Stapellauf), Upstash (Datenspeicher), GitHub (Quellcode), Open Charge Map und Nominatim/OpenStreetMap (Ladestation und Adresse zum Standort), cdnjs (lädt die Excel- und PDF-Bausteine nach). Fällt Vercel oder Upstash aus, steht die App; fallen die anderen aus, fehlen nur Komfortfunktionen.

### 1.5 Herausforderungen – Vergangenheit

Am ersten Tag (05.07.2026) entstanden über 50 Änderungen in Folge, vor allem am Eingabeformular; mehrere Bedienideen (Schieberegler, Drehrad für die Dauer) wurden gebaut und wieder verworfen. Fehler, die erst im Alltag auffielen: der Excel-Export stürzte über den Jahreswechsel ab, die Preisautomatik blieb nach dem ersten Rechnen hängen, eine km-Schätzformel kopierte nur alte Werte. Zwei Stresstests im September 2026 fanden u. a. sich gegenseitig überschreibende Speicherungen von zwei Handys; seitdem gibt es eine Konfliktprüfung (optimistisches Sperren).

### 1.5 Herausforderungen – Gegenwart

Es gibt kein automatisches Backup und keine Überwachung (Monitoring): niemand merkt es aktiv, wenn Vercel oder Upstash Fehler melden. Datenschutzfelder im Projekt-Pass (DSGVO, Speicherort, AVV) sind noch leer. Für den BIO-Leapy fehlen noch Stichtag-Werte, daher zeigt er noch keine €/km.

### 1.5 Herausforderungen – Zukunft

Geplant ist der Umzug auf den eigenen netcup-Server: eigener Rumpf statt Liegeplatz, eigene Datenbank statt fremdem Lagerhaus, nächtliches Backup und das Monitoring (Teil 3) als systemd-Timer. Der eine große Datensatz wächst bis Leasingende (Oktober 2028) auf geschätzt einige hundert Ladevorgänge – unkritisch, aber jedes Speichern schickt den ganzen Datensatz. Regelmäßig nötig: Abhängigkeiten aktualisieren (Next.js, React) und die Datenschutzangaben nachziehen.

## Teil 2 – Die Bauteile im Detail

### Brücke – Frontend (Benutzeroberfläche)

*Gerät · Next.js 16, React 19, TypeScript, eigene CSS-Datei*

Die Brücke ist alles, was man auf dem Handy sieht und antippt: Kacheln, Lade-Historie, Erfassungsformular, dieser Entwicklerbereich. Gebaut mit React in Next.js; die Seite wird einmal geladen und läuft dann im Browser. Beim Öffnen holt sie den ganzen Datensatz über das Sprachrohr und speichert jede Änderung nach 0,8 Sekunden Ruhe automatisch zurück. Den PIN merkt sie sich im Browser (localStorage).

### Maschinenraum – Geschäftslogik

*Gerät · lib/data.ts (reine Rechenfunktionen)*

Ungewöhnlich für ein Schiff: der Maschinenraum sitzt direkt hinter der Brücke auf dem Handy. Alle Rechnungen – TCO, €/km, gefahrene km pro Monat, Abschreibung der Investitionen – laufen im Browser, nicht auf einem Server. Das hält die Serverseite winzig, heißt aber auch: jedes Gerät rechnet selbst. Die Rechenfunktionen haben keine Nebenwirkungen und sind mit automatischen Tests abgesichert.

### Sprachrohr – API-Schicht (1 Endpunkt)

*fremde Dienste · app/api/data/route.ts – GET und POST /api/data*

Über genau eine feste Befehlsleitung (Endpunkt) spricht die Brücke mit dem Lagerhaus: „gib mir alles“ (GET) und „speichere alles“ (POST). Jede Anfrage muss den PIN mitbringen, sonst kommt nichts heraus. Beim Speichern wird geprüft, ob inzwischen jemand anderes gespeichert hat (optimistisches Sperren); dann gibt es eine Warnung statt stillem Überschreiben.

### Beiboot – Serverless-Funktion

*fremde Dienste · Vercel Functions (Node.js)*

Es gibt keinen dauernd laufenden Server. Stattdessen läuft bei jeder Anfrage ans Sprachrohr kurz ein Beiboot aus (Serverless), prüft den PIN, holt oder schreibt den Datensatz im Lagerhaus und legt wieder an. Vorteil: kein eigener Server zu warten. Nachteil: die erste Anfrage nach längerer Pause kann etwas länger dauern (Kaltstart).

### Lagerhaus am Kai – Datenbank (Key-Value-Speicher)

*fremde Dienste · Upstash Redis, 1 Schlüssel „ladeprotokoll:2026“*

Alle Daten liegen in einem gemieteten Lagerhaus neben dem Schiff: Redis beim Anbieter Upstash. Dort gibt es keine Tabellen, sondern genau ein Fach (Schlüssel) mit dem kompletten Datensatz als JSON: Ladevorgänge aller Monate, Fixkosten, Investitionen, Ladekarten, Wünsche aus dem Entwicklerbereich. Fehlen nach einem Update Felder, ergänzt die App sie beim Laden (Migration in lib/data.ts). OFFEN: Region des Lagerhauses (EU oder USA).

### Funkmast – Externe APIs

*fremde Dienste · Open Charge Map, Nominatim (OpenStreetMap), cdnjs*

Per Funk fragt die Brücke drei fremde Stationen direkt aus dem Browser: Open Charge Map („welche Ladesäule steht hier?“), Nominatim von OpenStreetMap („welche Adresse ist das?“, Reverse Geocoding) und cdnjs (CDN), das die Excel- und PDF-Bausteine liefert. Keine davon braucht einen Schlüssel. Fällt eine aus, bleibt die App benutzbar – es fehlt nur der Komfort.

### Boje – Externe Datenquelle: Standort des Handys

*Gerät · Browser-Geolocation (GPS)*

Die Boje ist das GPS des Handys (Geolocation). Beim Erfassen eines Ladevorgangs liest die App den Standort – automatisch nur, wenn die Erlaubnis schon früher erteilt wurde, sonst per Knopf. Mit den Koordinaten wird über den Funkmast die Ladesäule bzw. Adresse gesucht. Funktioniert nur über eine sichere Verbindung (HTTPS).

### Ladekran – Datenimport

*Gerät · „Sicherung wiederherstellen“ (JSON-Datei)*

Mit dem Ladekran hebt man eine früher exportierte Sicherung (JSON-Datei) wieder an Bord. Die App prüft dabei die Form der Datei und verwirft unbekannte Monate, statt sie unsichtbar mitzuschleppen. Danach wird der Datensatz wie jede Änderung ins Lagerhaus gespeichert – er ersetzt den bisherigen Stand.

### Tresor – Umgebungsvariablen / Geheimnisse

*fremde Dienste · Vercel-Projekteinstellungen, lokal .env.local*

Im Tresor liegen drei Geheimnisse als Umgebungsvariablen: der Haushalts-PIN und die Zugangsdaten zum Lagerhaus (Adresse und Schlüssel). Sie stehen in den Projekteinstellungen bei Vercel und für die Entwicklung in einer lokalen Datei, die nie zu GitHub hochgeladen wird. Nur das Beiboot kann sie lesen, die Brücke nie.

### Logbuch – Logs (Fehler- und Ereignisprotokolle)

*fremde Dienste · Vercel-Laufzeitprotokolle*

Das Logbuch führt Vercel automatisch: jede Anfrage ans Beiboot und jeder Fehler landet dort. Es wird aber von niemandem regelmäßig gelesen und nur kurz aufbewahrt. Eine eigene Auswertung (Monitoring, Teil 3) gibt es noch nicht – sie kommt mit dem Umzug auf den eigenen Server.

### Rettungsboot – Backup

*Gerät · manueller JSON-Export „Exportieren aller Daten“*

Das Rettungsboot muss man selbst zu Wasser lassen: „Exportieren aller Daten“ lädt den kompletten Datensatz als JSON-Datei aufs Handy. Ein automatisches, regelmäßiges Backup gibt es nicht; geht beim Anbieter des Lagerhauses etwas verloren, ist nur die letzte Handsicherung da. Mit dem Ladekran kommt eine Sicherung zurück.

### Werft – Entwicklung und Deployment

*Werkzeug und Pflege · GitHub (darkjak2026/efahrtenbuch-tco), Claude Code, Vercel-Auto-Deploy*

In der Werft wird gebaut: der Quellcode liegt bei GitHub, geschrieben wird mit Claude Code auf dem PC. Jeder Upload auf den Hauptzweig (master) löst bei Vercel automatisch einen Stapellauf aus: die App wird neu gebaut und ist eine Minute später live. Vorher laufen lokal Tests, Typprüfung (TypeScript) und Lint.

### Liegeplatz bei Vercel – Hosting (gemietet)

*fremde Dienste · Vercel, Adresse efahrtenbuch-tco.vercel.app*

Das Schiff hat keinen eigenen Rumpf auf eigenem Grund, sondern einen gemieteten Liegeplatz bei Vercel. Vercel liefert die Seite aus, stellt die sichere Verbindung (HTTPS) und lässt die Beiboote laufen. Eine eigene Domain gibt es nicht. Geplant ist der Umzug in den eigenen Hafen (netcup-Server).

### U-Boot – Hintergrund-Jobs (nicht vorhanden)

*eigener Server · –*

Kein U-Boot an Bord: es laufen keine geplanten Hintergrundaufgaben (Cron-Jobs). Nichts passiert, solange niemand die App öffnet.

## Teil 3 – Monitoring – Metrics History

Noch nicht eingerichtet, folgt mit dem Umzug auf den netcup-Server.

## Glossar

- **TCO (Total Cost of Ownership):** Alle Kosten eines Autos zusammen – Laden, Leasing, Versicherung, Anschaffungen, Abos –, hier geteilt durch die gefahrenen Kilometer.
- **ODO (Odometer):** Der Gesamt-Kilometerstand des Autos. Wird bei jedem Ladevorgang von Hand eingetragen.
- **Next.js:** Baukasten für Webseiten auf Basis von React; liefert Seite und Server-Endpunkte aus einem Projekt.
- **React:** Bibliothek, mit der die Oberfläche aus kleinen Bausteinen (Komponenten) zusammengesetzt wird.
- **TypeScript:** JavaScript mit Typprüfung: findet viele Tippfehler im Code, bevor die App überhaupt läuft.
- **Redis:** Sehr schneller Speicher, der Daten unter einem Namen (Schlüssel) ablegt, ohne Tabellen (Key-Value-Speicher).
- **Vercel:** Anbieter, der Next.js-Apps hostet und bei jedem Code-Upload automatisch neu ausliefert.
- **Serverless:** Server-Code, der nur bei Bedarf kurz gestartet wird, statt dauernd auf einem eigenen Rechner zu laufen.
- **Endpunkt (Endpoint):** Eine feste Adresse auf dem Server, die eine bestimmte Anfrage beantwortet, hier /api/data.
- **JSON:** Einfaches Textformat für strukturierte Daten; lesbar für Mensch und Maschine.
- **PIN:** Gemeinsame Geheimzahl des Haushalts. Ersetzt Benutzerkonten: wer den PIN kennt, sieht und ändert alles.
- **Optimistisches Sperren (Optimistic Locking):** Jeder Datenstand trägt eine Zählnummer. Wer mit einer veralteten Nummer speichern will, wird abgewiesen – so überschreiben sich zwei Handys nicht still.
- **localStorage:** Kleiner Speicher im Browser, nur auf diesem einen Gerät. Hier für PIN und Notiz-Entwurf.
- **Umgebungsvariable:** Einstellung, die dem Programm von außen mitgegeben wird, statt im Code zu stehen – der übliche Ort für Passwörter und Schlüssel.
- **Geolocation:** Standortabfrage des Browsers (GPS, WLAN, Mobilfunk); braucht die Erlaubnis der Nutzerin bzw. des Nutzers.
- **Reverse Geocoding:** Aus Koordinaten eine lesbare Adresse machen (Straße, PLZ, Ort).
- **CDN (Content Delivery Network):** Netz von Servern, das häufig gebrauchte Dateien (hier Programmbausteine) schnell ausliefert.
- **Deployment (Stapellauf):** Eine neue Version bauen und live schalten.
- **GitHub:** Online-Ablage für Quellcode mit vollständiger Versionsgeschichte (Git).
- **Backup:** Sicherungskopie der Daten, aus der man nach einem Verlust den alten Stand wiederherstellen kann.
- **AVV (Auftragsverarbeitungsvertrag):** Vertrag nach DSGVO mit einem Dienstleister, der personenbezogene Daten im eigenen Auftrag speichert oder verarbeitet.

## Offene Punkte

- OFFEN: Region des Upstash-Lagerhauses (EU oder USA) und Stand des AVV.
- OFFEN: Monitoring (Teil 3) – folgt mit dem Umzug auf den netcup-Server (Entscheidung vom 07.10.2026).
- OFFEN: kein automatisches Backup, nur die Handsicherung.
