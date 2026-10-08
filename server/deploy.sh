#!/usr/bin/env bash
# Projekt: eFahrtenbuch TCO – Urheber: Jakobus Claudius Digitalensis (+KI-Claude)
# Deploy auf den eigenen Server (netcup). Läuft auf dem PC in Git Bash:
#   bash server/deploy.sh
# Baut das eigenständige Next.js-Paket, lädt es mit den Server-Dateien hoch und
# startet dort setup_server.sh (Probelauf, Umschalten, automatischer Rückweg).
# Bei der allerersten Einrichtung wird der Haushalts-PIN aus .env.local über stdin
# weitergereicht – er erscheint weder in der Ausgabe noch in einer Befehlszeile.
set -euo pipefail
cd "$(dirname "$0")/.."
SSH_HOST=${SSH_HOST:-vitalcoach}

# Schutz: leere oder fehlende Server-Dateien nie hochladen
for f in server/setup_server.sh server/import_daten.sh server/ors_schluessel.sh server/efahrtenbuch.service server/Caddyfile.efahrtenbuch; do
  [ -s "$f" ] || { echo "$f fehlt oder ist leer – Abbruch" >&2; exit 1; }
done

echo "== Tests und Build"
npm test --silent
npm run build
rm -rf .deploy
mkdir -p .deploy/app/.next
cp -r .next/standalone/. .deploy/app/
cp -r .next/static .deploy/app/.next/static
cp -r public .deploy/app/public
tar -C .deploy -czf .deploy/app.tar.gz app
echo "   Paket: $(du -h .deploy/app.tar.gz | cut -f1)"

echo "== Hochladen"
ssh "$SSH_HOST" 'mkdir -p ~/efahrtenbuch-deploy && chmod 700 ~/efahrtenbuch-deploy'
scp -q .deploy/app.tar.gz server/setup_server.sh server/import_daten.sh server/ors_schluessel.sh server/efahrtenbuch.service server/Caddyfile.efahrtenbuch \
  "$SSH_HOST":efahrtenbuch-deploy/

echo "== Einrichten auf dem Server"
if ssh "$SSH_HOST" 'sudo -n test -f /etc/efahrtenbuch/efahrtenbuch.env'; then
  ssh "$SSH_HOST" 'bash ~/efahrtenbuch-deploy/setup_server.sh' </dev/null
else
  grep -E '^LADEPROTOKOLL_PIN=' .env.local | head -n 1 | cut -d= -f2- | tr -d '"\r' \
    | ssh "$SSH_HOST" 'bash ~/efahrtenbuch-deploy/setup_server.sh'
fi
