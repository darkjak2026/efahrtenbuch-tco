#!/usr/bin/env bash
# Projekt: eFahrtenbuch TCO – Urheber: Jakobus Claudius Digitalensis (+KI-Claude)
# GraphHopper-Schlüssel für den Menüpunkt "Planung" eintragen (seit v2.40.00;
# graphhopper.com, Free-Tarif, nur private Nutzung). Auf dem PC:
#   ssh -t vitalcoach 'sudo bash ~/efahrtenbuch-deploy/graphhopper_schluessel.sh'
# Der Schlüssel wird verdeckt abgefragt (erscheint nicht am Bildschirm und in keiner
# Befehlszeile), in /etc/efahrtenbuch/efahrtenbuch.env geschrieben (600 root) und der
# Dienst neu gestartet. Erneut aufrufen ersetzt den alten Schlüssel; leer lassen = entfernen.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Bitte mit sudo aufrufen." >&2; exit 1; }
ENV_FILE=/etc/efahrtenbuch/efahrtenbuch.env
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE fehlt – erst einrichten (server/deploy.sh)." >&2; exit 1; }

read -r -s -p "GraphHopper-Schlüssel (leer = entfernen): " KEY
echo
KEY="${KEY//[[:space:]]/}"
if [ -n "$KEY" ] && [[ ! "$KEY" =~ ^[A-Za-z0-9=_-]{20,200}$ ]]; then
  echo "Das sieht nicht nach einem GraphHopper-Schlüssel aus – nichts geändert." >&2
  exit 1
fi

TMP=$(mktemp)
trap 'shred -u "$TMP" 2>/dev/null || rm -f "$TMP"' EXIT
grep -v '^GRAPHHOPPER_API_KEY=' "$ENV_FILE" > "$TMP" || true
[ -z "$KEY" ] || printf "GRAPHHOPPER_API_KEY='%s'\n" "$KEY" >> "$TMP"
install -m 600 -o root -g root "$TMP" "$ENV_FILE"
unset KEY

systemctl restart efahrtenbuch
for i in $(seq 1 30); do
  curl -fs -m 3 http://127.0.0.1:8020/api/health | grep -q '"ok":true' && break
  sleep 1
done
if grep -q '^GRAPHHOPPER_API_KEY=' "$ENV_FILE"; then
  echo "Schlüssel eingetragen, Dienst neu gestartet. In der App unter Planung testen."
else
  echo "Schlüssel entfernt, Dienst neu gestartet."
fi
