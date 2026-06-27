# Deploying QuickRing to an Ubuntu VPS

Production target:

- **URL:** https://dialer.revenuelyft.com
- **App port:** 3002 (Node/Express, bound to 127.0.0.1, fronted by Nginx)
- **Process manager:** PM2
- **TLS:** Let's Encrypt via Certbot
- **Database:** Neon Postgres (external; configured via `DATABASE_URL`)

## Before you start

1. **DNS** — create an `A` record for `dialer.revenuelyft.com` pointing to the VPS public IP. Verify with `dig +short dialer.revenuelyft.com`.
2. **Firewall** — open ports `22`, `80`, and `443`. Port `3002` stays internal (do **not** expose it).
3. Get the code onto the server, e.g.:
   ```bash
   sudo mkdir -p /opt/quickring && sudo chown $USER /opt/quickring
   # then upload the project there (scp/rsync/git clone) so files live in /opt/quickring
   cd /opt/quickring
   ```

## First deploy

```bash
sudo bash deploy/deploy.sh
```

On the **first** run it creates `.env` (auto-generating the JWT secrets) and stops so you can fill in:

- `DATABASE_URL` — your Neon connection string
- the `TWILIO_*` values — required for real calls

Then run it again:

```bash
sudo bash deploy/deploy.sh
```

This installs Node 22 + Nginx + Certbot + PM2, builds the client, starts the app
under PM2 (on boot too), wires up the Nginx proxy, and issues the TLS cert.

> The script does **not** run `db:setup`. The Neon database is already seeded, and
> re-seeding would rotate the agents' TOTP secrets (invalidating existing
> authenticator entries). Only run `npm run db:setup` manually if you intend to
> reset those.

## Updating after a code change

```bash
bash deploy/update.sh
```

Reinstalls deps, rebuilds the client, and zero-downtime reloads PM2.

## Handy commands

```bash
pm2 status            # process state
pm2 logs quickring    # tail app logs
pm2 restart quickring # hard restart
sudo nginx -t && sudo systemctl reload nginx   # validate + reload proxy
sudo certbot renew --dry-run                    # test cert auto-renewal
```
