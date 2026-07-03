#!/bin/bash
# Doppio-click per aprire space. Si apre il Terminale, parte il server e
# il browser va da solo su http://localhost:3000. Per spegnere: chiudi
# questa finestra del Terminale (o Ctrl+C).

cd "$(dirname "$0")" || exit 1

# Se e' gia in esecuzione, apri solo il browser.
if curl -s http://localhost:3000 >/dev/null 2>&1; then
  open http://localhost:3000
  exit 0
fi

echo "Avvio space…"
[ -d node_modules ] || npm install
[ -d .next ] || { echo "Primo avvio: preparo l'app (un minuto)…"; npm run build; }

# Appena il server risponde, apri il browser.
( until curl -s http://localhost:3000 >/dev/null 2>&1; do sleep 1; done; open http://localhost:3000 ) &

npm run start
