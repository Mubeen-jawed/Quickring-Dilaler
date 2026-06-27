#!/usr/bin/env bash
#
# QuickRing — first-time deploy / provisioning script for an Ubuntu VPS.
#
#   Domain : dialer.revenuelyft.com
#   App port: 3002  (Node/Express, behind Nginx)
#
# What it does (idempotent — safe to re-run):
#   1. Installs Node.js 22, Nginx, Certbot, and PM2
#   2. Installs npm deps (root, server, client) and builds the React client
#   3. Creates .env (auto-generating JWT secrets) if it does not exist
#   4. Starts/reloads the app under PM2 and enables boot startup
#   5. Configures the Nginx reverse proxy for dialer.revenuelyft.com
#   6. Obtains/renews a Let's Encrypt TLS certificate via Certbot
#
# Usage (run from the project root on the VPS):
#   sudo bash deploy/deploy.sh
#
# Prerequisites:
#   - A DNS A record for dialer.revenuelyft.com pointing at this server's IP
#   - Ports 80 and 443 open in the firewall / security group
#
set -euo pipefail

# ── Config ──────────────────────────────────────────────
DOMAIN="dialer.revenuelyft.com"
APP_PORT="3002"
APP_NAME="quickring"
NODE_MAJOR="22"
LETSENCRYPT_EMAIL="jawedmuddasir@gmail.com"   # used for cert expiry notices

# Resolve project root = parent of this script's dir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }

if [[ "${EUID}" -ne 0 ]]; then
  warn "Please run with sudo:  sudo bash deploy/deploy.sh"
  exit 1
fi

# Run npm/pm2 as the invoking (non-root) user when available, so file
# ownership and the PM2 daemon live under that user.
RUN_USER="${SUDO_USER:-root}"
run_as() { sudo -u "$RUN_USER" -H bash -lc "$*"; }

# ── 1. System packages ──────────────────────────────────
log "Installing system packages (Node ${NODE_MAJOR}, Nginx, Certbot)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

apt-get install -y nginx certbot python3-certbot-nginx git curl

if ! command -v pm2 >/dev/null 2>&1; then
  log "Installing PM2 globally"
  npm install -g pm2
fi

# ── 2. Environment file ─────────────────────────────────
if [[ ! -f "$APP_DIR/.env" ]]; then
  log "Creating .env from .env.production.example with generated JWT secrets"
  cp "$APP_DIR/.env.production.example" "$APP_DIR/.env"
  JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
  JWT_REFRESH_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|"                 "$APP_DIR/.env"
  sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|" "$APP_DIR/.env"
  chown "$RUN_USER":"$RUN_USER" "$APP_DIR/.env"
  warn "Edit $APP_DIR/.env and set DATABASE_URL and your Twilio credentials,"
  warn "then re-run this script. Stopping now so the app starts with real values."
  exit 0
else
  log ".env already present — leaving it untouched"
fi

# ── 3. Install deps + build client ──────────────────────
log "Installing npm dependencies (root, server, client)"
run_as "cd '$APP_DIR' && npm install --no-audit --no-fund"
run_as "cd '$APP_DIR/server' && npm install --omit=dev --no-audit --no-fund"
run_as "cd '$APP_DIR/client' && npm install --no-audit --no-fund"

log "Building the React client (-> client/dist)"
run_as "cd '$APP_DIR' && npm run build"

# ── 4. Start under PM2 ──────────────────────────────────
log "Starting/reloading app under PM2 on port ${APP_PORT}"
run_as "cd '$APP_DIR' && pm2 startOrReload ecosystem.config.js --update-env"
run_as "pm2 save"

# Enable PM2 on boot for the run user (generate + run the startup command)
STARTUP_CMD="$(run_as "pm2 startup systemd -u $RUN_USER --hp /home/$RUN_USER" | grep 'sudo env' || true)"
if [[ -n "$STARTUP_CMD" ]]; then
  log "Enabling PM2 startup on boot"
  eval "$STARTUP_CMD"
  run_as "pm2 save"
fi

# ── 5. Nginx reverse proxy ──────────────────────────────
log "Configuring Nginx for ${DOMAIN}"
cp "$SCRIPT_DIR/nginx-dialer.conf" "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
# Drop the default site so it doesn't shadow our server_name
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 6. TLS via Certbot ──────────────────────────────────
log "Obtaining/renewing TLS certificate for ${DOMAIN}"
if certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
  warn "Certificate already exists for ${DOMAIN}; Certbot auto-renew is active."
else
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LETSENCRYPT_EMAIL" --redirect \
    || warn "Certbot failed — check that DNS for ${DOMAIN} points here and ports 80/443 are open, then run: certbot --nginx -d ${DOMAIN}"
fi

log "Done. QuickRing should be live at: https://${DOMAIN}"
echo "  PM2 status : pm2 status"
echo "  App logs   : pm2 logs ${APP_NAME}"
echo "  Redeploy   : bash deploy/update.sh"
