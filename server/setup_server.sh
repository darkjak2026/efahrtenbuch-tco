#!/usr/bin/env bash
# Projekt: eFahrtenbuch TCO – Urheber: Jakobus Claudius Digitalensis (+KI-Claude)
# Läuft AUF dem Server (aufgerufen von server/deploy.sh auf dem PC). Idempotent.
# Vorbild: VoiceNotes setup_server.sh (gleicher Server, gleiches Muster).
#
# Aufbau:
#   /opt/efahrtenbuch/releases/<Zeit>/   Next.js-Paket je Deploy   } gehört root,
#   /opt/efahrtenbuch/current            Verknüpfung auf aktiven Stand } Dienst liest nur
#   /etc/efahrtenbuch/efahrtenbuch.env   DB-Zugang + Haushalts-PIN, 600 root
#   ~/efahrtenbuch-deploy/               Upload von deploy.sh + Protokolle
#
# Jeder Lauf: neuen Stand in eigenen Ordner legen (laufender Dienst unberührt)
# -> Probelauf mit identischer Sandbox auf Port 8021 -> erst dann umschalten und
# neu starten -> antwortet der Dienst nicht, automatisch zurück auf den vorigen Stand.
#
# Neuinstallation (keine env-Datei): installiert Node.js (Debian-Paket), legt
# Systembenutzer, DB-Rolle und Datenbank an und erwartet den Haushalts-PIN auf stdin.
set -euo pipefail
cd ~/efahrtenbuch-deploy
exec 9>>"$HOME/efahrtenbuch-deploy/.setup.lock"
flock -n 9 || { echo "Ein anderer Deploy läuft noch – Protokoll: neuestes ~/efahrtenbuch-deploy/setup_*.log" >&2; exit 1; }

APP=efahrtenbuch
OPT=/opt/efahrtenbuch
ENV_DIR=/etc/efahrtenbuch
ENV_FILE=$ENV_DIR/efahrtenbuch.env
UNIT=/etc/systemd/system/efahrtenbuch.service
PROBE=/run/systemd/system/efahrtenbuch-probe.service
PORT=8020
PROBE_PORT=8021
TS=$(date +%Y%m%d_%H%M%S)
REL=releases/$TS
LOG=~/efahrtenbuch-deploy/setup_$TS.log

# Gesund = Seite lädt, Health meldet DB ok, Daten-API verlangt den PIN (401).
app_ok() {
  local port=$1 i
  for i in $(seq 1 30); do
    if curl -fs -m 3 -o /dev/null "http://127.0.0.1:$port/" \
       && curl -fs -m 3 "http://127.0.0.1:$port/api/health" | grep -q '"ok":true' \
       && [ "$(curl -s -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/api/data")" = 401 ]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# --- Ausgangslage (nur hier wird stdin gelesen) ---
if sudo test -f "$ENV_FILE"; then
  ENV_MODE=vorhanden
else
  ENV_MODE=neu
  read -r APP_PIN || true
  APP_PIN="${APP_PIN%$'\r'}"
  [ -n "$APP_PIN" ] || { echo "Neuinstallation: kein PIN auf stdin erhalten" >&2; exit 1; }
  # Nur einfache Zeichen, damit die env-Datei sicher zu schreiben ist
  [[ "$APP_PIN" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "PIN enthält Sonderzeichen – bitte von Hand einrichten" >&2; exit 1; }
fi

trap '' HUP
(umask 077 && : > "$LOG")
exec > >(tee -p -a "$LOG") 2>&1
find ~/efahrtenbuch-deploy -maxdepth 1 -name 'setup_*.log' -mtime +30 -delete

PREV_REL=$(readlink "$OPT/current" 2>/dev/null || true)
UNIT_PREV=$(mktemp)
[ -f "$UNIT" ] && cat "$UNIT" > "$UNIT_PREV"

probe_weg() {
  sudo systemctl stop efahrtenbuch-probe 2>/dev/null || true
  sudo systemctl reset-failed efahrtenbuch-probe 2>/dev/null || true
  if sudo test -f "$PROBE"; then sudo rm -f "$PROBE"; sudo systemctl daemon-reload || true; fi
}
rueckweg() {
  if [ -z "$PREV_REL" ]; then
    echo "   Erste Installation – kein vorheriger Stand, Dienst wird gestoppt." >&2
    sudo systemctl stop "$APP" || true
    return 0
  fi
  [ -s "$UNIT_PREV" ] && sudo install -m 644 -o root -g root "$UNIT_PREV" "$UNIT" || true
  sudo ln -sfn "$PREV_REL" "$OPT/current" || true
  sudo systemctl daemon-reload || true
  sudo systemctl restart "$APP" || true
  if app_ok $PORT; then echo "   Vorheriger Stand läuft wieder." >&2
  else echo "ACHTUNG: auch der vorherige Stand antwortet nicht – Protokoll: $LOG" >&2; fi
}
PHASE=vorbereitung
beenden() {
  local rc=$?
  trap - EXIT
  set +e
  probe_weg
  if [ "$PHASE" = umschalten ]; then
    echo "!! Abbruch beim Umschalten – automatischer Rückweg" >&2
    rueckweg
  fi
  rm -f "$UNIT_PREV"
  if [ "$PHASE" = fertig ]; then echo "Protokoll: $LOG"
  elif [ "$PHASE" = vorbereitung ] || [ "$PHASE" = probe ]; then
    echo "== Abgebrochen vor dem Umschalten – laufender Dienst unverändert. Protokoll: $LOG" >&2
  else echo "== Abgebrochen. Protokoll: $LOG" >&2; fi
  exit $rc
}
trap beenden EXIT
echo "== $(date '+%d.%m.%Y %H:%M:%S') Deploy $TS (Zugangsdaten: $ENV_MODE)"

# --- Node.js (Debian-Paket, mit den normalen Sicherheitsupdates) ---
if ! command -v node >/dev/null; then
  echo "== Node.js installieren (Debian-Paket nodejs)"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q nodejs
fi
echo "   Node.js $(node --version)"
# Next.js 16 braucht Node >= 20.9
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=9)?0:1)' \
  || { echo "Node.js zu alt für Next.js 16" >&2; exit 1; }

getent passwd "$APP" >/dev/null \
  || sudo useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$APP"

# --- Neuer Stand (root-eigen), der laufende Dienst bleibt unberührt ---
echo "== Paket nach $OPT/$REL"
sudo install -d -o root -g root -m 755 "$OPT" "$OPT/releases" "$OPT/$REL"
sudo tar -C "$OPT/$REL" --no-same-owner -xzf app.tar.gz --strip-components=1
sudo chmod -R u=rwX,go=rX "$OPT/$REL"
sudo test -f "$OPT/$REL/server.js" || { echo "Paket unvollständig (server.js fehlt)" >&2; exit 1; }

# --- Zugangsdaten nach /etc/efahrtenbuch ---
if [ "$ENV_MODE" = neu ]; then
  echo "== Neuinstallation: Datenbank-Rolle, Datenbank und $ENV_FILE anlegen"
  DB_PW=$(openssl rand -hex 24)
  # SQL über stdin statt -c: das Passwort erscheint so nicht in der Prozessliste
  sudo -u postgres psql -X -v ON_ERROR_STOP=1 -q <<SQL
SELECT 'CREATE ROLE efahrtenbuch LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'efahrtenbuch')\gexec
ALTER ROLE efahrtenbuch PASSWORD '$DB_PW' CONNECTION LIMIT 10;
SQL
  sudo -u postgres psql -XtAc "SELECT 1 FROM pg_database WHERE datname = 'efahrtenbuch_db'" | grep -q 1 \
    || sudo -u postgres createdb -O efahrtenbuch efahrtenbuch_db
  # Nur die Eigentümer-Rolle darf sich verbinden (wie VitalCoach/VoiceNotes)
  sudo -u postgres psql -X -v ON_ERROR_STOP=1 -q -c 'REVOKE CONNECT, TEMPORARY ON DATABASE efahrtenbuch_db FROM PUBLIC'
  sudo install -d -o root -g root -m 700 "$ENV_DIR"
  printf "DATABASE_URL='postgresql://efahrtenbuch:%s@127.0.0.1:5432/efahrtenbuch_db'\nLADEPROTOKOLL_PIN='%s'\n" "$DB_PW" "$APP_PIN" \
    | sudo sh -c 'umask 077 && cat > "$1"' sh "$ENV_FILE"
  unset DB_PW APP_PIN
  echo "   $ENV_FILE angelegt"
fi

# --- Probelauf: neuer Stand, identische Sandbox, Port 8021 ---
PHASE=probe
echo "== Probelauf auf Port $PROBE_PORT (laufender Dienst bleibt unberührt)"
probe_weg
PROBE_TMP=$(mktemp -d)
sed -e "s#^WorkingDirectory=.*#WorkingDirectory=$OPT/$REL#" \
    -e "s#^ExecStart=.*#ExecStart=/usr/bin/node $OPT/$REL/server.js#" \
    -e "s/^Environment=PORT=$PORT/Environment=PORT=$PROBE_PORT/" -e "s/tcp:$PORT/tcp:$PROBE_PORT/" \
    -e 's/^Environment=EFB_INSTANZ=.*/Environment=EFB_INSTANZ=probe/'     -e 's/^Restart=.*/Restart=no/' -e 's/^Description=.*/Description=eFahrtenbuch Probelauf/' efahrtenbuch.service \
  > "$PROBE_TMP/efahrtenbuch-probe.service"
if ! verify_out=$(sudo systemd-analyze verify "$PROBE_TMP/efahrtenbuch-probe.service" 2>&1) || [ -n "$verify_out" ]; then
  printf '%s\n' "$verify_out" >&2
  rm -rf "$PROBE_TMP"
  echo "Unit-Datei fehlerhaft" >&2; exit 1
fi
sudo install -m 644 -o root -g root "$PROBE_TMP/efahrtenbuch-probe.service" "$PROBE"
rm -rf "$PROBE_TMP"
sudo systemctl daemon-reload
if sudo systemctl start efahrtenbuch-probe && app_ok $PROBE_PORT; then
  echo "   Probelauf OK"
else
  sudo journalctl -u efahrtenbuch-probe --since "-2min" --no-pager -o cat | tail -n 30 >&2 || true
  echo "Probelauf fehlgeschlagen" >&2; exit 1
fi
probe_weg

# --- Umschalten ---
PHASE=umschalten
echo "== Dienst umschalten"
sudo ln -sfn "$REL" "$OPT/current"
sudo install -m 644 -o root -g root efahrtenbuch.service "$UNIT"
sudo systemctl daemon-reload
sudo systemctl enable -q "$APP"
if ! sudo systemctl restart "$APP" || ! app_ok $PORT; then
  echo "Neuer Dienst antwortet nicht:" >&2
  sudo journalctl -u "$APP" --since "-2min" --no-pager -o cat | tail -n 30 >&2 || true
  exit 1   # beenden() übernimmt den Rückweg
fi
PHASE=caddy

# --- Monitoring: nächtlicher Schnappschuss als systemd-Timer (nicht Cron) ---
# Gehört nicht zum Rückweg: ein Fehler hier lässt die neue App laufen.
echo "== Monitoring-Timer"
for f in efahrtenbuch-snapshot.service efahrtenbuch-snapshot.timer; do
  if ! verify_out=$(sudo systemd-analyze verify "$PWD/$f" 2>&1) || [ -n "$verify_out" ]; then
    printf '%s
' "$verify_out" >&2; echo "$f fehlerhaft" >&2; exit 1
  fi
done
sudo install -m 644 -o root -g root efahrtenbuch-snapshot.service efahrtenbuch-snapshot.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable -q --now efahrtenbuch-snapshot.timer
# Schnappschuss gleich jetzt: neue Version und Komplexitätswerte stehen sofort im Verlauf
if sudo systemctl start efahrtenbuch-snapshot.service; then
  echo "   Schnappschuss OK, nächster Lauf: $(systemctl show -p NextElapseUSecRealtime --value efahrtenbuch-snapshot.timer)"
else
  sudo journalctl -u efahrtenbuch-snapshot --since "-2min" --no-pager -o cat | tail -n 10 >&2 || true
  echo "WARNUNG: Schnappschuss fehlgeschlagen (App läuft trotzdem)" >&2
fi

# --- Caddy: eigener Block in eigener Datei, im Haupt-Caddyfile nur per import ---
BASE_HOST=$(sudo grep -oE '^[0-9]+-[0-9]+-[0-9]+-[0-9]+\.nip\.io' /etc/caddy/Caddyfile | head -n 1)
[ -n "$BASE_HOST" ] || { echo "nip.io-Adresse im Caddyfile nicht gefunden" >&2; exit 1; }
HOST="efahrtenbuch.$BASE_HOST"
SNIP=/etc/caddy/efahrtenbuch.caddy
SNIP_BAK=$(mktemp); HAD_SNIP=0; CF_BAK=
if sudo test -f "$SNIP"; then sudo cat "$SNIP" > "$SNIP_BAK"; HAD_SNIP=1; fi
sed "s/__HOST__/$HOST/" Caddyfile.efahrtenbuch | sudo sh -c 'cat > "$1" && chmod 644 "$1"' sh "$SNIP"
if ! sudo grep -q '^import efahrtenbuch.caddy' /etc/caddy/Caddyfile; then
  CF_BAK="/etc/caddy/Caddyfile.bak-$(date +%Y%m%d-%H%M%S)"
  sudo cp -a /etc/caddy/Caddyfile "$CF_BAK"
  printf '\nimport efahrtenbuch.caddy\n' | sudo tee -a /etc/caddy/Caddyfile >/dev/null
fi
if ! caddy_out=$(sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1); then
  printf '%s\n' "$caddy_out" | tail -n 5 >&2
  if [ "$HAD_SNIP" = 1 ]; then sudo install -m 644 -o root -g root "$SNIP_BAK" "$SNIP"; else sudo rm -f "$SNIP"; fi
  [ -z "$CF_BAK" ] || sudo install -m 644 -o root -g root "$CF_BAK" /etc/caddy/Caddyfile
  rm -f "$SNIP_BAK"
  echo "Caddy-Konfiguration ungültig – alte wiederhergestellt, Caddy nicht neu geladen." >&2
  exit 1
fi
rm -f "$SNIP_BAK"
sudo systemctl reload caddy

# --- Abschluss ---
PHASE=fertig
# Aktueller und vorheriger Stand bleiben (Rückweg), alles andere weg
CUR=$(readlink "$OPT/current")
for d in $(sudo find "$OPT/releases" -mindepth 1 -maxdepth 1 -printf 'releases/%f\n'); do
  [ "$d" = "$REL" ] || [ "$d" = "$PREV_REL" ] || [ "$d" = "$CUR" ] || sudo rm -rf "${OPT:?}/$d"
done
rm -f app.tar.gz
PID=$(systemctl show -p MainPID --value "$APP")
echo "App OK – Stand $REL, läuft als: $(ps -o user:20= -p "$PID")"
echo "Sandbox: $(sudo systemd-analyze security "$APP" --no-pager 2>/dev/null | tail -n 1)"
ok=0
for i in $(seq 1 20); do
  if curl -fs -m 10 "https://$HOST/api/health" | grep -q '"ok":true'; then ok=1; break; fi
  sleep 3   # beim ersten Mal holt Caddy noch das Zertifikat
done
if [ "$ok" = 1 ]; then echo "Von außen (https) erreichbar: OK – https://$HOST"
else echo "WARNUNG: https://$HOST/api/health antwortet (noch) nicht" >&2; fi
