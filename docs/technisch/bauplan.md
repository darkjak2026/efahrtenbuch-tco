# Bauplan eFahrtenbuch

> Erzeugt aus `docs/technisch/bauplan.json` mit `npm run bauplan` – nicht von Hand bearbeiten.

Stand der Dokumentation: 08.10.2026 | 09:36

## Teil 1 – Beschreibung der App

### Kurz gesagt

Das eFahrtenbuch ist ein gemeinsames Ladeprotokoll für die zwei E-Autos der Familie Liese-Held (Leapmotor B10 „BIO-Leapy“ und T03 „Leapy“). Aus jedem Ladevorgang und den Fixkosten rechnet es laufend aus, was ein gefahrener Kilometer wirklich kostet (TCO). Die App läuft im Handy-Browser, die Daten liegen seit dem 08.10.2026 im Laderaum des eigenen Schiffs auf dem eigenen Server (Rumpf).

### 1.1 Ausgangslage, Vorüberlegungen, Zielsetzung

Am Anfang stand eine einzelne HTML-Datei, die nur auf einem Gerät speichern konnte. Ziel war, dass beide Haushaltsmitglieder vom eigenen Handy aus Ladevorgänge eintragen und dieselben Zahlen sehen. Deshalb wurde die App am 05.07.2026 auf Next.js umgebaut, zunächst gemietet bei Vercel mit Upstash-Redis als Speicher. Am 08.10.2026 zog sie auf den eigenen Server um (Daten in der EU, eigene Sicherung, keine Abhängigkeit von zwei fremden Anbietern). Bewusst klein gehalten: ein gemeinsamer PIN statt Benutzerkonten, ein einziger Datensatz.

### 1.2 Aktueller Funktionsumfang und Features

Ein Menü unten führt zu Übersicht, Planung, Statistik, Historie und Einstellungen. Ladevorgänge werden in zwei Schritten erfasst: „Vor“ dem Laden (Fahrzeug, km-Stand (ODO), Ladekarte, €/kWh, Standort per GPS) und „Nach“ dem Laden (kWh, Reichweite, Dauer). Daraus entstehen €/km je Auto (TCO), ein Freikilometer-Countdown, Monatskarten mit Ringen und eine Wochenübersicht. Die Planung rechnet eine Strecke zwischen zwei Adressen durch und schlägt das Auto vor, das die Leasing-Freikilometer am besten ausnutzt.

### 1.3 Backup, Datensicherung, Datenschutz

Jede Nacht um 03:30 sichert der Server die Datenbank mit, die Sicherungen bleiben 30 Tage und werden zusätzlich auf den PC geholt (Rettungsboot); dazu kommt der Handexport als JSON. Die Daten (Ladeorte mit Koordinaten, km-Stände, Kosten) liegen auf dem eigenen Server in Österreich (EU), ohne Auftragsverarbeiter für die Speicherung. Zugang nur mit dem Haushalts-PIN aus dem Tresor. Beim GPS-Abruf gehen die Koordinaten direkt vom Handy an Open Charge Map und OpenStreetMap (Funk).

### 1.4 Abhängigkeiten und beteiligte Dienste

Eigener Server bei netcup (VPS) mit Caddy und PostgreSQL, GitHub (Quellcode), Open Charge Map und Nominatim/OpenStreetMap (Ladestation und Adresse zum Standort), cdnjs (Excel- und PDF-Bausteine). Fällt der Server aus, steht die App; fallen die anderen aus, fehlen nur Komfortfunktionen.

### 1.5 Herausforderungen – Vergangenheit

Am ersten Tag (05.07.2026) entstanden über 50 Änderungen in Folge, vor allem am Eingabeformular; mehrere Bedienideen (Schieberegler, Drehrad für die Dauer) wurden gebaut und wieder verworfen. Fehler, die erst im Alltag auffielen: der Excel-Export stürzte über den Jahreswechsel ab, die Preisautomatik blieb nach dem ersten Rechnen hängen, eine km-Schätzformel kopierte nur alte Werte. Zwei Stresstests im September 2026 fanden u. a. sich gegenseitig überschreibende Speicherungen von zwei Handys; seitdem gibt es eine Konfliktprüfung (optimistisches Sperren).

### 1.5 Herausforderungen – Gegenwart

Das Monitoring (Teil 3) fehlt noch: Ausfälle fallen nur auf, wenn jemand die App öffnet. Datenschutzfelder im Projekt-Pass sind nach dem Umzug neu zu bewerten. Für den BIO-Leapy fehlen noch Leasing- und Stichtagsdaten.

### 1.5 Herausforderungen – Zukunft

Monitoring mit nächtlichem Schnappschuss und Statusseite, ein Menü mit „Planung“ (Streckenrechner, Autovorschlag), regelmäßige Updates von Node.js (Debian-Pakete) und Next.js. Der eine Datensatz wächst bis Leasingende auf einige hundert Ladevorgänge – unkritisch, aber jedes Speichern schickt den ganzen Datensatz.

## Teil 2 – Die Bauteile im Detail

### Brücke – Frontend (Benutzeroberfläche)

*Gerät · Next.js 16, React 19, TypeScript, eigene CSS-Datei*

Die Brücke ist alles, was man auf dem Handy sieht und antippt: Kacheln, Lade-Historie, Erfassungsformular, dieser Entwicklerbereich. Gebaut mit React in Next.js; die Seite wird einmal geladen und läuft dann im Browser. Die Rechnungen (TCO, km, Ringe) laufen direkt hier auf dem Handy. Beim Öffnen holt sie den ganzen Datensatz über das Sprachrohr und speichert jede Änderung nach 0,8 Sekunden Ruhe automatisch zurück. Den PIN merkt sie sich im Browser (localStorage).

### Maschinenraum – Backend (Next.js-Server)

*eigener Server · Node.js 20 (Debian), Next.js im eigenständigen Paket, systemd-Dienst*

Im Maschinenraum läuft der Next.js-Server als Dienst (systemd) unter einem eigenen Benutzer ohne Anmeldung. Er liefert die Seite aus und beantwortet das Sprachrohr. Er ist abgeschottet (Sandbox): darf keine Dateien schreiben, keine fremden Ordner sehen und nur seinen eigenen Hafen-Eingang benutzen. Seit der Planung darf er ausgehend ins Internet – genutzt nur für OpenRouteService.

### Sprachrohr – API-Schicht (4 Endpunkte)

*eigener Server · /api/data (Laden/Speichern), /api/route und /api/geocode (Planung), /api/health*

Über feste Befehlsleitungen (Endpunkte) spricht die Brücke mit dem Maschinenraum: /api/data „gib mir alles“ und „speichere alles“, /api/route und /api/geocode für die Planung. Jede Anfrage muss den PIN mitbringen. Beim Speichern prüft der Laderaum in einem Schritt, ob inzwischen jemand anderes gespeichert hat (optimistisches Sperren). /api/health meldet ohne PIN nur „läuft“.

### Laderaum – Datenbank

*eigener Server · PostgreSQL 17, Datenbank efahrtenbuch_db, 1 Tabelle*

Im Laderaum liegt alles in einer PostgreSQL-Datenbank mit genau einer Tabelle und einer Zeile: dem kompletten Datensatz als JSON samt Zählnummer. Nur die eigene Datenbank-Rolle der App darf hinein. Fehlen nach einem Update Felder, ergänzt die App sie beim Laden. Bis zum 08.10.2026 lag das in einem gemieteten Lagerhaus (Upstash Redis).

### Funkmast – Externe APIs

*fremde Dienste · Open Charge Map, Nominatim (OpenStreetMap), cdnjs, OpenRouteService (über den Server)*

Per Funk fragt die App fremde Stationen: direkt vom Handy Open Charge Map („welche Ladesäule steht hier?“), Nominatim von OpenStreetMap („welche Adresse ist das?“, Reverse Geocoding, in der Planung auch die Adresssuche) und cdnjs (CDN) für die Excel- und PDF-Bausteine. Über den Maschinenraum läuft OpenRouteService für Straßenentfernung und Adressvorschläge – dessen Schlüssel bleibt im Tresor. Fällt ein Dienst aus, fehlt nur Komfort.

### Boje – Externe Datenquelle: Standort des Handys

*Gerät · Browser-Geolocation (GPS)*

Die Boje ist das GPS des Handys (Geolocation). Beim Erfassen eines Ladevorgangs liest die App den Standort – automatisch nur, wenn die Erlaubnis schon früher erteilt wurde, sonst per Knopf. Mit den Koordinaten wird über den Funkmast die Ladesäule bzw. Adresse gesucht. Funktioniert nur über eine sichere Verbindung (HTTPS).

### Ladekran – Datenimport

*Gerät · „Sicherung wiederherstellen“ (JSON-Datei)*

Mit dem Ladekran hebt man eine früher exportierte Sicherung (JSON-Datei) wieder an Bord. Die App prüft dabei die Form der Datei und verwirft unbekannte Monate, statt sie unsichtbar mitzuschleppen. Danach wird der Datensatz wie jede Änderung ins Lagerhaus gespeichert – er ersetzt den bisherigen Stand.

### Tresor – Umgebungsvariablen / Geheimnisse

*eigener Server · geschützte Einstellungsdatei auf dem Server (nur root)*

Im Tresor liegen die Geheimnisse als Umgebungsvariablen: der Haushalts-PIN und der Zugang zum Laderaum (Zufallspasswort). Die Datei auf dem Server kann nur root lesen; der Maschinenraum bekommt die Werte beim Start. Für die Entwicklung gibt es eine lokale Datei, die nie zu GitHub geht.

### Logbuch – Logs (Fehler- und Ereignisprotokolle)

*eigener Server · systemd-Journal, Deploy-Protokolle*

Das Logbuch führt der Server selbst: Start, Fehler und jede Anfrage-Panne landen im Systemprotokoll des Dienstes, jeder Stapellauf schreibt ein eigenes Protokoll. Ausgewertet wird es noch nicht – das kommt mit dem Monitoring (Teil 3).

### Rettungsboot – Backup

*eigener Server · nächtlicher pg_dump (03:30), 30 Tage, Abholung auf den PC, dazu Handexport*

Das Rettungsboot läuft jetzt jede Nacht von selbst aus: um 03:30 wird die Datenbank gesichert (Backup), die Sicherungen bleiben 30 Tage auf dem Server und werden auf den PC geholt. Zusätzlich lädt „Exportieren aller Daten“ den Datensatz jederzeit als JSON aufs Handy, und mit dem Ladekran kommt eine Sicherung zurück.

### Werft – Entwicklung und Deployment

*Werkzeug und Pflege · GitHub (darkjak2026/efahrtenbuch-tco), Claude Code, server/deploy.sh*

In der Werft wird gebaut: der Quellcode liegt bei GitHub, geschrieben wird mit Claude Code auf dem PC. Den Stapellauf startet server/deploy.sh: Tests, Bau, Hochladen, dann ein Probelauf des neuen Stands neben dem laufenden; erst wenn der antwortet, wird umgeschaltet – sonst geht es automatisch zurück auf den vorigen Stand.

### Rumpf – Hosting (eigener Server)

*eigener Server · netcup VPS, Debian 13, Caddy mit automatischem HTTPS, Adresse efahrtenbuch.…nip.io*

Seit dem 08.10.2026 hat das Schiff einen eigenen Rumpf: einen gemieteten VPS bei netcup, auf dem auch VitalCoach und VoiceNotes fahren – jede App abgeschottet für sich. Vorne sitzt Caddy als Hafeneinfahrt: holt das Zertifikat (HTTPS) und reicht Anfragen an den Maschinenraum weiter. Die Adresse läuft über nip.io, eine eigene Domain ist nicht nötig.

### U-Boot – Hintergrund-Jobs (nicht vorhanden)

*eigener Server · –*

Kein eigenes U-Boot: die App hat keine geplanten Hintergrundaufgaben. Die nächtliche Sicherung erledigt das gemeinsame Sicherungsskript des Servers mit.

## Teil 3 – Monitoring – Metrics History

Noch nicht eingerichtet, folgt mit dem Umzug auf den netcup-Server.

## Glossar

- **TCO (Total Cost of Ownership):** Alle Kosten eines Autos zusammen – Laden, Leasing, Versicherung, Anschaffungen, Abos –, hier geteilt durch die gefahrenen Kilometer.
- **ODO (Odometer):** Der Gesamt-Kilometerstand des Autos. Wird bei jedem Ladevorgang von Hand eingetragen.
- **Next.js:** Baukasten für Webseiten auf Basis von React; liefert Seite und Server-Endpunkte aus einem Projekt.
- **React:** Bibliothek, mit der die Oberfläche aus kleinen Bausteinen (Komponenten) zusammengesetzt wird.
- **TypeScript:** JavaScript mit Typprüfung: findet viele Tippfehler im Code, bevor die App überhaupt läuft.
- **Redis:** Schneller Schlüssel-Wert-Speicher; beim eFahrtenbuch bis 08.10.2026 bei Upstash der Datenspeicher.
- **Vercel:** Anbieter, der Next.js-Apps hostet; beim eFahrtenbuch bis 08.10.2026 der Liegeplatz.
- **Serverless:** Server-Code, der nur bei Bedarf kurz gestartet wird (so lief die App bei Vercel).
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
- **PostgreSQL:** Bewährte Open-Source-Datenbank; läuft auf dem eigenen Server für alle drei Apps, jede mit eigener Datenbank und Rolle.
- **Caddy:** Webserver vor den Apps: holt HTTPS-Zertifikate automatisch und leitet Anfragen an die richtige App weiter.
- **systemd:** Startet und überwacht Dienste unter Linux, startet sie nach einem Absturz neu und setzt die Abschottung (Sandbox) um.
- **Sandbox (Abschottung):** Regeln, die einem Dienst fast alles verbieten, was er nicht braucht: keine Dateien schreiben, kein Internet, keine fremden Ordner.
- **VPS (Virtual Private Server):** Ein gemieteter virtueller Server mit eigenem Betriebssystem, den man selbst verwaltet.
- **nip.io:** Kostenloser Dienst, bei dem die IP-Adresse des Servers mit Bindestrichen im Namen steht (name.<IP>.nip.io) und auf genau diesen Server zeigt – so bekommt man HTTPS ohne eigene Domain.
- **OpenRouteService:** Routendienst der Uni Heidelberg auf Basis von OpenStreetMap: berechnet Straßenentfernungen und schlägt Adressen vor; braucht einen kostenlosen Schlüssel.

## Offene Punkte

- OFFEN: Monitoring (Teil 3) – nächtlicher Schnappschuss, Statusseite, Verlauf (jetzt auf dem eigenen Server umsetzbar).
- OFFEN: Vercel-Projekt abschalten und Upstash-Datenbank löschen (Urheber; die alte Adresse zeigt seit 08.10.2026 nur noch den Umzugshinweis).
