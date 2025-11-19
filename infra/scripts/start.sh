#!/usr/bin/env bash
set -euo pipefail
ROLE=${1:-web}

if [ "$ROLE" = "web" ]; then
  echo "[start] launching Next.js web"
  cd /app/repo-frontend
  if [ -d node_modules ]; then
    npm run start
  else
    echo "[start] node_modules missing; running dev server"
    npm run dev
  fi
elif [ "$ROLE" = "worker" ]; then
  echo "[start] launching Python worker"
  cd /app/repo-worker
  if [ -d venv ]; then
    source venv/bin/activate
  fi
  python -m worker.main
else
  echo "unknown role: $ROLE" >&2
  exit 1
fi
