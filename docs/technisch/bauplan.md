# Bauplan eFahrtenbuch

> Erzeugt aus `docs/technisch/bauplan.json` mit `npm run bauplan` – nicht von Hand bearbeiten.

Stand der Dokumentation: 08.10.2026 | 14:58

## Teil 1 – Beschreibung der App

### Kurz gesagt

Das eFahrtenbuch ist ein gemeinsames Ladeprotokoll für die zwei E-Autos der Familie Liese-Held (Leapmotor B10 „BIO-Leapy“ und T03 „Leapy“). Aus jedem Ladevorgang und den Fixkosten rechnet es laufend aus, was ein gefahrener Kilometer wirklich kostet (TCO). Die App läuft im Handy-Browser, die Daten liegen seit dem 08.10.2026 im Laderaum des eigenen Schiffs auf dem eigenen Server (Rumpf).

### 1.1 Ausgangslage, Vorüberlegungen, Zielsetzung

Am Anfang stand eine einzelne HTML-Datei, die nur auf einem Gerät speichern konnte. Ziel war, dass beide Haushaltsmitglieder vom eigenen Handy aus Ladevorgänge eintragen und dieselben Zahlen sehen. Deshalb wurde die App am 05.07.2026 auf Next.js umgebaut, zunächst gemietet bei Vercel mit Upstash-Redis als Speicher. Am 08.10.2026 zog sie auf den eigenen Server um (Daten in der EU, eigene Sicherung, keine Abhängigkeit von zwei fremden Anbietern). Bewusst klein gehalten: ein gemeinsamer PIN statt Benutzerkonten, ein einziger Datensatz.

### 1.2 Aktueller Funktionsumfang und Features

Ein Menü unten führt zu Übersicht, Planung, Statistik, Historie und Einstellungen. Ladevorgänge werden Schritt für Schritt erfasst: „Vor“ dem Laden (Restreichweite, Gesamtkilometer (ODO), Cent-Preis pro kWh, Ladekarte; Fahrzeug, Datum und Standort per GPS erkennt die App selbst) und „Nach“ dem Laden (kWh, Dauer, Reichweite neu, Notiz, Preis) – mit Fortschrittsring um das Auto und Konfetti beim Abschluss. Daraus entstehen €/km je Auto (TCO), ein Freikilometer-Countdown, Monatskarten mit Ringen und eine Wochenübersicht, in der ein Ladering um jeden Ladetag den Ladestand vorher und nachher zeigt. Die Planung rechnet eine Strecke zwischen zwei Adressen durch und schlägt das Auto vor, das die Leasing-Freikilometer am besten ausnutzt.

### 1.3 Backup, Datensicherung, Datenschutz

Jede Nacht um 03:30 sichert der Server die Datenbank mit, die Sicherungen bleiben 30 Tage und werden zusätzlich auf den PC geholt (Rettungsboot); dazu kommt der Handexport als JSON. Die Daten (Ladeorte mit Koordinaten, km-Stände, Kosten) liegen auf dem eigenen Server in Österreich (EU), ohne Auftragsverarbeiter für die Speicherung. Zugang nur mit dem Haushalts-PIN aus dem Tresor. Beim GPS-Abruf gehen die Koordinaten direkt vom Handy an Open Charge Map und OpenStreetMap (Funk).

### 1.4 Abhängigkeiten und beteiligte Dienste

Eigener Server bei netcup (VPS) mit Caddy und PostgreSQL, GitHub (Quellcode), Open Charge Map und Nominatim/OpenStreetMap (Ladestation und Adresse zum Standort), cdnjs (Excel- und PDF-Bausteine). Fällt der Server aus, steht die App; fallen die anderen aus, fehlen nur Komfortfunktionen.

### 1.5 Herausforderungen – Vergangenheit

Am ersten Tag (05.07.2026) entstanden über 50 Änderungen in Folge, vor allem am Eingabeformular; mehrere Bedienideen (Schieberegler, Drehrad für die Dauer) wurden gebaut und wieder verworfen. Fehler, die erst im Alltag auffielen: der Excel-Export stürzte über den Jahreswechsel ab, die Preisautomatik blieb nach dem ersten Rechnen hängen, eine km-Schätzformel kopierte nur alte Werte. Zwei Stresstests im September 2026 fanden u. a. sich gegenseitig überschreibende Speicherungen von zwei Handys; seitdem gibt es eine Konfliktprüfung (optimistisches Sperren).

### 1.5 Herausforderungen – Gegenwart

Seit 08.10.2026 misst das Monitoring (Teil 3) jede Nacht den Zustand von Server und Daten; Alarme bei Ausfällen gibt es noch nicht – auffallen tut ein Problem beim Blick in den Bauplan oder beim Öffnen der App. Der Routendienst für die Planung wartet noch auf seinen Schlüssel. Datenschutzfelder im Projekt-Pass sind nach dem Umzug neu zu bewerten. Für den BIO-Leapy fehlen noch Leasing- und Stichtagsdaten (noch nicht übergeben).

### 1.5 Herausforderungen – Zukunft

Regelmäßige Updates von Node.js (Debian-Pakete) und Next.js, ein Blick in das Monitoring nach jedem Deploy und bei Gelegenheit eine Benachrichtigung, wenn Sicherung oder Schnappschuss ausfallen. Der eine Datensatz wächst bis Leasingende auf einige hundert Ladevorgänge – unkritisch, aber jedes Speichern schickt den ganzen Datensatz; die Verlaufskurve der Datensatzgröße zeigt, wann sich ein Umbau lohnt.

## Teil 2 – Die Bauteile im Detail

### Brücke – Frontend (Benutzeroberfläche)

*Gerät · Next.js 16, React 19, TypeScript, eigene CSS-Datei*

Die Brücke ist alles, was man auf dem Handy sieht und antippt: Kacheln, Lade-Historie, Erfassungsformular, dieser Entwicklerbereich. Gebaut mit React in Next.js; die Seite wird einmal geladen und läuft dann im Browser. Die Rechnungen (TCO, km, Ringe) laufen direkt hier auf dem Handy. Beim Öffnen holt sie den ganzen Datensatz über das Sprachrohr und speichert jede Änderung nach 0,8 Sekunden Ruhe automatisch zurück. Den PIN merkt sie sich im Browser (localStorage).

### Maschinenraum – Backend (Next.js-Server)

*eigener Server · Node.js 20 (Debian), Next.js im eigenständigen Paket, systemd-Dienst*

Im Maschinenraum läuft der Next.js-Server als Dienst (systemd) unter einem eigenen Benutzer ohne Anmeldung. Er liefert die Seite aus und beantwortet das Sprachrohr. Er ist abgeschottet (Sandbox): darf keine Dateien schreiben, keine fremden Ordner sehen und nur seinen eigenen Hafen-Eingang benutzen. Seit der Planung darf er ausgehend ins Internet – genutzt nur für den Routendienst (GraphHopper, Ersatz OpenRouteService).

### Sprachrohr – API-Schicht (5 Endpunkte)

*eigener Server · /api/data (Laden/Speichern), /api/route und /api/geocode (Planung), /api/status (Monitoring), /api/health*

Über feste Befehlsleitungen (Endpunkte) spricht die Brücke mit dem Maschinenraum: /api/data „gib mir alles“ und „speichere alles“, /api/route und /api/geocode für die Planung, /api/status für das Monitoring. Jede Anfrage muss den PIN mitbringen. Beim Speichern prüft der Laderaum in einem Schritt, ob inzwischen jemand anderes gespeichert hat (optimistisches Sperren). /api/health meldet ohne PIN nur „läuft“.

### Laderaum – Datenbank

*eigener Server · PostgreSQL 17, Datenbank efahrtenbuch_db, 3 Tabellen (app_data, ops_events, metrics_history)*

Im Laderaum liegt alles in einer PostgreSQL-Datenbank mit einer Tabelle für die Daten und genau einer Zeile darin: dem kompletten Datensatz als JSON samt Zählnummer. Nur die eigene Datenbank-Rolle der App darf hinein. Fehlen nach einem Update Felder, ergänzt die App sie beim Laden. Bis zum 08.10.2026 lag das in einem gemieteten Lagerhaus (Upstash Redis). Zwei weitere Tabellen gehören dem Logbuch (Monitoring).

### Funkmast – Externe APIs

*fremde Dienste · Open Charge Map, Nominatim (OpenStreetMap), cdnjs, GraphHopper (über den Server; Ersatz OpenRouteService)*

Per Funk fragt die App fremde Stationen: direkt vom Handy Open Charge Map („welche Ladesäule steht hier?“), Nominatim von OpenStreetMap („welche Adresse ist das?“, Reverse Geocoding, in der Planung auch die Adresssuche) und cdnjs (CDN) für die Excel- und PDF-Bausteine. Über den Maschinenraum läuft GraphHopper für Straßenentfernung und Adressvorschläge (Ersatz: OpenRouteService) – der Schlüssel bleibt im Tresor. Fällt ein Dienst aus, fehlt nur Komfort.

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

*eigener Server · systemd-Journal, Deploy-Protokolle, Tabellen ops_events und metrics_history*

Das Logbuch führt der Server selbst: Start, Fehler und jede Anfrage-Panne landen im Systemprotokoll des Dienstes, jeder Stapellauf schreibt ein eigenes Protokoll. Was für den Verlauf zählt, steht zusätzlich im Laderaum: Ereignisse wie Start, Serverfehler, Aufrufe des Routendienstes und das Ergebnis der Sicherung (ops_events) und ein Tageswert je Nacht (Metrics History). Daraus entsteht das Monitoring in Teil 3.

### Rettungsboot – Backup

*eigener Server · nächtlicher pg_dump (03:30), 30 Tage, Abholung auf den PC, dazu Handexport*

Das Rettungsboot läuft jetzt jede Nacht von selbst aus: um 03:30 wird die Datenbank gesichert (Backup), die Sicherungen bleiben 30 Tage auf dem Server und werden auf den PC geholt. Zusätzlich lädt „Exportieren aller Daten“ den Datensatz jederzeit als JSON aufs Handy, und mit dem Ladekran kommt eine Sicherung zurück. Nach jeder Sicherung meldet das Skript Erfolg oder Fehler ins Logbuch – so zeigt das Monitoring, ob die letzte Sicherung geklappt hat.

### Werft – Entwicklung und Deployment

*Werkzeug und Pflege · GitHub (darkjak2026/efahrtenbuch-tco), Claude Code, server/deploy.sh*

In der Werft wird gebaut: der Quellcode liegt bei GitHub, geschrieben wird mit Claude Code auf dem PC. Den Stapellauf startet server/deploy.sh: Tests, Bau, Hochladen, dann ein Probelauf des neuen Stands neben dem laufenden; erst wenn der antwortet, wird umgeschaltet – sonst geht es automatisch zurück auf den vorigen Stand.

### Rumpf – Hosting (eigener Server)

*eigener Server · netcup VPS, Debian 13, Caddy mit automatischem HTTPS, Adresse efahrtenbuch.…nip.io*

Seit dem 08.10.2026 hat das Schiff einen eigenen Rumpf: einen gemieteten VPS bei netcup, auf dem auch VitalCoach und VoiceNotes fahren – jede App abgeschottet für sich. Vorne sitzt Caddy als Hafeneinfahrt: holt das Zertifikat (HTTPS) und reicht Anfragen an den Maschinenraum weiter. Die Adresse läuft über nip.io, eine eigene Domain ist nicht nötig.

### U-Boot – Hintergrund-Jobs

*eigener Server · systemd-Timer efahrtenbuch-snapshot (täglich 23:50), dazu das gemeinsame Sicherungsskript (03:30)*

Das U-Boot taucht jede Nacht von selbst auf: ein Timer weckt um 23:50 einen kleinen Helfer, der die App nach ihren Kennzahlen fragt und daraus einen Schnappschuss ins Logbuch schreibt (Teil 3, Monitoring). Der Helfer läuft mit einem Wegwerf-Benutzer, darf nur die eigene App auf dem Server erreichen und sonst nichts. Um 03:30 läuft außerdem das gemeinsame Sicherungsskript des Servers (Rettungsboot).

## Teil 3 – Monitoring – Metrics History

Ein Timer (systemd, täglich 23:50, zusätzlich bei jedem Deploy) ruft POST /api/status auf; die App schreibt daraufhin einen Snapshot in die Tabelle metrics_history: Datenbankgröße, Einträge je Tabelle, Ladevorgänge, Speichervorgänge, Version, Codezeilen, Endpunkte und Abhängigkeiten, Uptime, Fehler des Tages, Aufrufe des Routendienstes und das Ergebnis der letzten Sicherung. Werte, die der abgeschottete Dienst nicht selbst sehen darf (Sicherungsordner, Systemprotokoll), melden die Beteiligten als Betriebsereignis. Codezeilen, Endpunkte und Abhängigkeiten zählt der PC beim Deploy; für die Zeit vor dem Monitoring sind sie einmalig aus der Git-Historie rekonstruiert (je Woche der letzte Commit, gestrichelt). Retention: Tageswerte 90 Tage, danach Monatswerte. GET /api/status liefert die aktuellen Werte und den Verlauf, nur mit PIN und ohne Geheimnisse oder Inhalte des Datensatzes.

### Meilensteine

- 05.07.2026: Start: Next.js-App auf Vercel mit Upstash Redis (1.0.00)
- 15.08.2026: Neuer Erfassungsdialog „Vor/Nach“ (2.0.00)
- 01.09.2026: Stresstests und Härtung (2.22.00–2.24.00)
- 07.10.2026: Entwicklerbereich neu und Bauplan (2.26.00)
- 08.10.2026: Umzug auf den eigenen netcup-Server (2.34.00), Planung (2.36.00), Monitoring (2.37.00)

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
- **Timer (systemd):** Wecker des Servers: startet eine Aufgabe zu einer festen Uhrzeit, holt einen verpassten Lauf nach dem Neustart nach. Ersatz für den älteren Cron.
- **Schnappschuss (Snapshot):** Momentaufnahme aller Kennzahlen zu einem Zeitpunkt, als eine Zeile gespeichert. Viele Schnappschüsse ergeben den Verlauf.
- **Metrics History:** Tabelle metrics_history: ein Schnappschuss je Tag (Version, Datenbankgröße, Einträge, Codezeilen, Fehler, Sicherung). Nach 90 Tagen werden Tageswerte zu Monatswerten zusammengefasst (Retention).
- **Betriebsereignisse (ops_events):** Tabelle für Ereignisse, die der abgeschottete Dienst nicht selbst messen darf oder kann: Start, Serverfehler, Aufrufe fremder Dienste, Ergebnis der Sicherung. Werden nach 90 Tagen gelöscht.
- **Uptime:** Laufzeit seit dem letzten Start des Dienstes.
- **Codezeilen (LOC):** Lines of Code: Anzahl der nicht leeren Zeilen im Quellcode, grobes Maß für die Größe der App. Wird beim Deploy auf dem PC gezählt.
- **GraphHopper:** Routendienst aus München auf Basis von OpenStreetMap: berechnet Straßenentfernungen und schlägt Adressen vor. Kostenloser Free-Tarif (500 Credits am Tag) nur für private Nutzung; braucht einen Schlüssel.

## Offene Punkte

- OFFEN: Vercel-Projekt abschalten und Upstash-Datenbank löschen (Urheber; die alte Adresse zeigt seit 08.10.2026 nur noch den Umzugshinweis).
