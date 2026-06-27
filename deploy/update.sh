#!/usr/bin/env bash
#
# QuickRing — redeploy script (run after pulling/uploading new code).
# Reinstalls deps, rebuilds the client, and zero-downtime reloads PM2.
#
# Usage (from the project root on the VPS):
#   bash deploy/update.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# If this is a git checkout, pull latest first.
if [[ -d "$APP_DIR/.git" ]]; then
  log "Pulling latest code"
  git pull --ff-only
fi

log "Installing dependencies"
npm install --no-audit --no-fund
( cd server && npm install --omit=dev --no-audit --no-fund )
( cd client && npm install --no-audit --no-fund )

log "Rebuilding client"
npm run build

log "Reloading app (zero-downtime)"
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

log "Done. Live at https://dialer.revenuelyft.com"
pm2 status
