#!/usr/bin/env bash
# Projekt: eFahrtenbuch TCO – Urheber: Jakobus Claudius Digitalensis (+KI-Claude)
# Einmaliger Datenumzug Upstash -> Postgres. Läuft AUF dem Server, der komplette
# Datensatz (JSON, wie ihn GET /api/data liefert) kommt über stdin:
#   ssh vitalcoach 'bash ~/efahrtenbuch-deploy/import_daten.sh' < export.json
# Vorher wird der bisherige Inhalt der Tabelle gesichert. Die Revision (_rev)
# wird übernommen, damit offene Browser-Tabs mit altem Stand sauber einen
# Konflikt melden statt etwas zu überschreiben.
set -euo pipefail
umask 077
cd /tmp
TS=$(date +%Y%m%d_%H%M%S)
IN=$(mktemp)
trap 'shred -u "$IN" 2>/dev/null || rm -f "$IN"' EXIT
cat > "$IN"
[ -s "$IN" ] || { echo "Keine Daten auf stdin" >&2; exit 1; }
chmod 644 "$IN"   # postgres muss die Datei lesen können (liegt in /tmp, wird sofort gelöscht)

# Plausibilität prüfen; den Umzugsvermerk (movedTo) des alten Speichers entfernen
python3 - "$IN" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding="utf-8"))
assert isinstance(d.get("months"), dict) and isinstance(d.get("_rev"), int), "kein AppData-Dokument"
d.pop("movedTo", None)
json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False)
n = sum(1 for rows in d["months"].values() for r in rows if r.get("datum") or r.get("fahrzeug"))
print(f"   Import: {n} Ladevorgänge, _rev {d['_rev']}")
PY

echo "== Bisherigen Inhalt sichern"
sudo -n -u postgres pg_dump -d efahrtenbuch_db -F c > ~/efahrtenbuch-deploy/vor-import_$TS.dump
echo "   ~/efahrtenbuch-deploy/vor-import_$TS.dump"

echo "== Einspielen"
sudo -n -u postgres psql -X -q -v ON_ERROR_STOP=1 -d efahrtenbuch_db -v file="$IN" <<'SQL'
CREATE TABLE IF NOT EXISTS app_data (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  rev integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_data OWNER TO efahrtenbuch;
\set content `cat :file`
INSERT INTO app_data (id, doc, rev, updated_at)
VALUES ('main', :'content'::jsonb, (:'content'::jsonb ->> '_rev')::int, now())
ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, rev = EXCLUDED.rev, updated_at = now();
SQL
sudo -n -u postgres psql -X -At -d efahrtenbuch_db -c "SELECT 'Gespeichert: rev ' || rev || ', ' || pg_size_pretty(pg_column_size(doc)::bigint) FROM app_data WHERE id = 'main'"
