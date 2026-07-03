#!/bin/bash
# Doppio-click per aprire space. Si apre il Terminale, parte il server e
# il browser va da solo su http://localhost:3000. Per spegnere: chiudi
# questa finestra del Terminale (o Ctrl+C).

cd "$(dirname "$0")" || exit 1

server_sano() {
  local html asset
  html="$(curl -fsS http://localhost:3000 2>/dev/null)" || return 1
  while IFS= read -r asset; do
    curl -fsS "http://localhost:3000$asset" >/dev/null 2>&1 || return 1
  done < <(printf "%s" "$html" | grep -Eo '/_next/static/[^" ]+\.(js|css)' | head -n 8)
  return 0
}

# Se e' gia in esecuzione e i bundle client rispondono, apri solo il browser.
if server_sano; then
  open http://localhost:3000
  exit 0
fi

# Se la pagina risponde ma i chunk JS/CSS vanno in errore, la UI resta visibile
# ma non cliccabile. In quel caso fermiamo il vecchio server e ripartiamo puliti.
if curl -fsS http://localhost:3000 >/dev/null 2>&1; then
  echo "Server space attivo ma client non sano: riavvio…"
  pids="$(lsof -tiTCP:3000 -sTCP:LISTEN)"
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
  for _ in 1 2 3 4 5; do
    sleep 1
    lsof -tiTCP:3000 -sTCP:LISTEN >/dev/null 2>&1 || break
  done
  if lsof -tiTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -tiTCP:3000 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
fi

echo "Avvio space…"
[ -d node_modules ] || npm install
# ricompila solo se i sorgenti sono cambiati dall'ultima build
# (space.config.json e .env.local si leggono a runtime: niente rebuild)
if [ ! -f .next/BUILD_ID ] || [ -n "$(find src package.json next.config.ts -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]; then
  echo "Preparo l'app…"
  npm run build || exit 1
fi

# Appena il server risponde, apri il browser.
( until curl -s http://localhost:3000 >/dev/null 2>&1; do sleep 1; done; open http://localhost:3000 ) &

npm run start
