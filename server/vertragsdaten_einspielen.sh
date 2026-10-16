#!/usr/bin/env bash
# Projekt: eFahrtenbuch TCO – Urheber: Jakobus Claudius Digitalensis (+KI-Claude)
# Version: 2026-10-16|2.48.00 – erste Fassung
# Spielt persönliche Vertragsdaten (Fixkosten, Stammdaten, Investitionen) aus der
# lokalen, per .gitignore ausgeschlossenen Datei server/private/vertragsdaten.local.json
# in den Datensatz auf dem Server ein. Läuft auf dem PC in Git Bash:
#   bash server/vertragsdaten_einspielen.sh --probe   # nur zeigen, was sich ändern würde
#   bash server/vertragsdaten_einspielen.sh           # Sicherung (pg_dump), schreiben, vergleichen
# Regeln: leere Werte werden übersprungen; ein Feld mit einem anderen Wert wird nur
# gemeldet, außer es steht in "ueberschreiben"; Investitionen werden nur ergänzt, wenn
# es keinen Eintrag mit gleichem Fahrzeug, Datum und Betrag gibt. Die Daten gehen über
# stdin der SSH-Verbindung, nie über eine Befehlszeile. Kennzeichen, FIN und
# Vertragsnummer erscheinen in der Ausgabe nur abgedeckt.
set -euo pipefail
cd "$(dirname "$0")/.."
SSH_HOST=${SSH_HOST:-vitalcoach}
DATEI=server/private/vertragsdaten.local.json
MODUS=schreiben
[ "${1:-}" = "--probe" ] && MODUS=probe

[ -s "$DATEI" ] || { echo "$DATEI fehlt – Vorlage: server/private/vertragsdaten.local.example.json" >&2; exit 1; }
git check-ignore -q "$DATEI" || { echo "$DATEI ist NICHT per .gitignore ausgeschlossen – Abbruch" >&2; exit 1; }
python -c "import json,sys; json.load(open(sys.argv[1], encoding='utf-8'))" "$DATEI" || { echo "$DATEI ist kein gültiges JSON" >&2; exit 1; }
grep -q '__VERTRAGSDATEN_ENDE__' "$DATEI" && { echo "Unzulässige Zeichenfolge in $DATEI" >&2; exit 1; }

remote_teil() {
cat <<'REMOTE'
cd /tmp
TS=$(date +%Y%m%d_%H%M%S)
PSQL="sudo -n -u postgres psql -X -At -v ON_ERROR_STOP=1 -d efahrtenbuch_db"
$PSQL -c "SELECT rev FROM app_data WHERE id = 'main'" > "$ARB/rev"
$PSQL -c "SELECT doc::text FROM app_data WHERE id = 'main'" > "$ARB/alt.json"
[ -s "$ARB/alt.json" ] || { echo "Kein Datensatz in app_data gefunden – Abbruch" >&2; exit 1; }

rc=0
python3 - "$ARB" <<'PY' || rc=$?
import json, os, re, sys

arb = sys.argv[1]
alt = json.load(open(f"{arb}/alt.json", encoding="utf-8"))
neu = json.load(open(f"{arb}/neu.json", encoding="utf-8"))
rev = int(open(f"{arb}/rev").read().strip())

FIX = ["leasing", "versicherung", "start", "stichtag", "stichtagKm", "stichtagLadekosten", "leasingMonate",
       "freiKmGesamt", "freiKmProJahr", "kmBeiLeasingbeginn", "mehrKmCent", "mehrKmSchwelle", "mehrKmCent2",
       "minderKmCent", "minderKmSchwelle", "minderKmCent2", "freigrenzeKm", "verbrauchKwh100"]
STAMM = ["modell", "farbe", "kennzeichen", "fin", "leasinggeber", "vertragsnummer", "haendler", "hauptfahrer"]
GEHEIM = {"kennzeichen", "fin", "vertragsnummer"}
DATUM = {"start", "stichtag"}
DATUM_RE = re.compile(r"\d{4}-\d{2}-\d{2}")

def leer(v):
    return v is None or (isinstance(v, str) and v.strip() == "")

def zahl(v):
    try:
        return float(str(v).replace(",", "."))
    except ValueError:
        return None

def gleich(a, b):
    za, zb = zahl(a), zahl(b)
    if za is not None and zb is not None:
        return abs(za - zb) < 1e-9
    return str(a).strip() == str(b).strip()

def zeig(feld, v):
    if leer(v):
        return "(leer)"
    if feld in GEHEIM:
        return f"gesetzt ({len(str(v))} Zeichen)"
    return str(v)

doc = json.loads(json.dumps(alt))
fehler, aenderungen, abweichend, gleich_ = [], [], [], []
ueber = set(neu.get("ueberschreiben") or [])
erwartet = {}

def setze(ziel, feld, wert, pfad, anzeige_feld):
    vorher = ziel.get(feld, "")
    if gleich(vorher, wert) and not leer(vorher):
        gleich_.append(pfad)
    elif leer(vorher) or pfad in ueber:
        ziel[feld] = wert
        erwartet[pfad] = wert
        aenderungen.append(f"{pfad}: {zeig(anzeige_feld, vorher)} -> {zeig(anzeige_feld, wert)}")
    else:
        abweichend.append(f"{pfad}: in der App {zeig(anzeige_feld, vorher)}, Datei {zeig(anzeige_feld, wert)} (nicht geändert)")

for k in ("b10", "t03"):
    f = (neu.get("fahrzeuge") or {}).get(k) or {}
    veh = doc["vehicles"][k]
    for feld, wert in (f.get("fixkosten") or {}).items():
        if feld not in FIX:
            fehler.append(f"{k}.{feld}: unbekanntes Feld")
            continue
        if leer(wert):
            continue
        wert = str(wert).strip()
        if feld in DATUM:
            if not DATUM_RE.fullmatch(wert):
                fehler.append(f"{k}.{feld}: kein Datum JJJJ-MM-TT")
                continue
        elif zahl(wert) is None or zahl(wert) < 0:
            fehler.append(f"{k}.{feld}: keine Zahl >= 0")
            continue
        setze(veh, feld, wert, f"{k}.{feld}", feld)
    if not isinstance(veh.get("stammdaten"), dict):
        veh["stammdaten"] = {}
    for feld, wert in (f.get("stammdaten") or {}).items():
        if feld not in STAMM:
            fehler.append(f"{k}.stammdaten.{feld}: unbekanntes Feld")
            continue
        if leer(wert):
            continue
        wert = str(wert)
        if wert.strip() == "XX-AB 123":
            fehler.append(f"{k}.stammdaten.{feld}: Platzhalter aus der Vorlage")
            continue
        setze(veh["stammdaten"], feld, wert.strip(), f"{k}.stammdaten.{feld}", feld)

invest = doc.setdefault("investitionen", [])
neue_invest = []
for i in neu.get("investitionen") or []:
    d, fz, b, t = str(i.get("datum", "")), str(i.get("fahrzeug", "")), str(i.get("betrag", "")), str(i.get("beschreibung", "")).strip()
    if not DATUM_RE.fullmatch(d) or fz not in ("b10", "t03", "") or not zahl(b) or zahl(b) <= 0 or not t or t == "Beispiel":
        fehler.append(f"Investition {t or '?'}: Datum, Fahrzeug, Beschreibung oder Betrag ungültig")
        continue
    if any(x.get("fahrzeug", "") == fz and x.get("datum") == d and gleich(x.get("betrag", ""), b) for x in invest):
        gleich_.append(f"Investition {d} {fz} {t}")
        continue
    eintrag = {"datum": d, "fahrzeug": fz, "beschreibung": t, "betrag": b}
    invest.append(eintrag)
    neue_invest.append(eintrag)
    aenderungen.append(f"Investition neu: {d} {fz or 'Haushalt'} {t} {b} €")

print(f"== Datensatz rev {rev}")
for z in aenderungen:
    print("   ÄNDERN   " + z)
for z in abweichend:
    print("   MELDUNG  " + z)
print(f"   unverändert (schon gleich): {len(gleich_)}")
if fehler:
    for z in fehler:
        print("   FEHLER   " + z)
    sys.exit(2)
if not aenderungen:
    print("   Nichts zu ändern.")
    sys.exit(3)

doc["_rev"] = rev + 1
text = json.dumps(doc, ensure_ascii=False)
tag = "vd" + os.urandom(6).hex()
assert f"${tag}$" not in text
with open(f"{arb}/update.sql", "w", encoding="utf-8") as fh:
    fh.write(f"UPDATE app_data SET doc = ${tag}${text}${tag}$::jsonb, rev = rev + 1, updated_at = now() WHERE id = 'main' AND rev = {rev};\n")
json.dump({"erwartet": erwartet, "investitionen": neue_invest, "rev": rev}, open(f"{arb}/plan.json", "w", encoding="utf-8"), ensure_ascii=False)
PY
case $rc in
  0) ;;
  3) exit 0 ;;
  *) echo "Abbruch, nichts geschrieben." >&2; exit 1 ;;
esac

if [ "$MODUS" = probe ]; then
  echo "== Probe: nichts geschrieben."
  exit 0
fi

echo "== Sicherung"
mkdir -p ~/efahrtenbuch-deploy
sudo -n -u postgres pg_dump -d efahrtenbuch_db -F c > ~/efahrtenbuch-deploy/vor-vertragsdaten_$TS.dump
chmod 600 ~/efahrtenbuch-deploy/vor-vertragsdaten_$TS.dump
echo "   ~/efahrtenbuch-deploy/vor-vertragsdaten_$TS.dump ($(du -h ~/efahrtenbuch-deploy/vor-vertragsdaten_$TS.dump | cut -f1))"

echo "== Schreiben"
ERG=$($PSQL < "$ARB/update.sql")
[ "$ERG" = "UPDATE 1" ] || { echo "Datensatz wurde inzwischen in der App geändert ($ERG) – nichts geschrieben, bitte erneut starten." >&2; exit 1; }

echo "== Vergleich vorher/nachher (Feld für Feld)"
$PSQL -c "SELECT doc::text FROM app_data WHERE id = 'main'" > "$ARB/nachher.json"
python3 - "$ARB" <<'PY'
import json, sys
arb = sys.argv[1]
alt = json.load(open(f"{arb}/alt.json", encoding="utf-8"))
nach = json.load(open(f"{arb}/nachher.json", encoding="utf-8"))
plan = json.load(open(f"{arb}/plan.json", encoding="utf-8"))

def flach(o, p=""):
    if isinstance(o, dict):
        r = {}
        for k, v in o.items():
            r.update(flach(v, f"{p}.{k}" if p else k))
        return r
    if isinstance(o, list):
        r = {}
        for i, v in enumerate(o):
            r.update(flach(v, f"{p}[{i}]"))
        return r
    return {p: o}

a, n = flach(alt), flach(nach)
erlaubt = {f"vehicles.{k}" for k in plan["erwartet"]} | {"_rev"}
n_alt_inv = len(alt.get("investitionen", []))
for i in range(len(plan["investitionen"])):
    for f in ("datum", "fahrzeug", "beschreibung", "betrag"):
        erlaubt.add(f"investitionen[{n_alt_inv + i}].{f}")
diff = {k for k in a.keys() | n.keys() if a.get(k, "<fehlt>") != n.get(k, "<fehlt>")}
unerwartet = sorted(diff - erlaubt)
falsch = [k for k, v in plan["erwartet"].items() if n.get(f"vehicles.{k}") != v]
neu_inv = nach.get("investitionen", [])[n_alt_inv:]
if unerwartet or falsch or neu_inv != plan["investitionen"] or nach.get("_rev") != plan["rev"] + 1:
    print("   ABWEICHUNG! unerwartet:", unerwartet, "falsch:", falsch)
    sys.exit(1)
print(f"   OK: {len(diff)} Felder geändert, alle wie geplant; {len(a) - len(diff & a.keys())} Felder unverändert.")
PY
$PSQL -c "SELECT 'Gespeichert: rev ' || rev || ', ' || to_char(updated_at, 'DD.MM.YYYY HH24:MI') FROM app_data WHERE id = 'main'"
REMOTE
}

echo "== Vertragsdaten einspielen ($MODUS) auf $SSH_HOST"
{
  echo 'set -euo pipefail'
  echo 'umask 077'
  echo "MODUS=$MODUS"
  echo 'ARB=$(mktemp -d)'
  echo 'trap '"'"'shred -u "$ARB"/* 2>/dev/null; rm -rf "$ARB"'"'"' EXIT'
  echo "cat > \"\$ARB/neu.json\" <<'__VERTRAGSDATEN_ENDE__'"
  cat "$DATEI"
  echo
  echo '__VERTRAGSDATEN_ENDE__'
  remote_teil
} | ssh "$SSH_HOST" 'bash -s'
