# PSYX FORTRESS — Self-Host Deploy Guide
Updated: July 2026

## What's inside
```
deploy/
├── api/           ← Node.js API server (bundled, no build needed)
├── public/        ← React frontend (static files for Nginx)
├── ecosystem.config.js   ← PM2 process manager config
├── nginx.conf.example    ← Nginx reverse-proxy template
├── .env.example          ← All environment variables
└── README.md
```

## Requirements
- **Node.js 20+** (check: `node -v`)
- **PostgreSQL 14+**
- **PM2** — `npm i -g pm2`
- **Nginx** + **Certbot** for HTTPS

---

## Step 1 — Upload & install
```bash
scp -r deploy/ user@your-server:/srv/psyx/
cd /srv/psyx
cp .env.example .env
nano .env          # fill in values (see Step 2)
```

## Step 2 — Configure .env
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Random 64-char secret for JWT signing |
| `PORT` | ✅ | API port (default 8080) |
| `PSYX_DOMAIN` | ✅ | Your domain e.g. `psyx.com` |
| `FRONTEND_URL` | ✅ | Full URL e.g. `https://psyx.com` |
| `SMTP_HOST` | ⚡ | SMTP server for **outbound** mail to Gmail/Outlook etc. |
| `SMTP_PORT` | ⚡ | Usually 587 (TLS) or 465 (SSL) |
| `SMTP_USER` | ⚡ | SMTP login email |
| `SMTP_PASS` | ⚡ | SMTP password or app-password |
| `SMTP_INBOUND_PORT` | optional | Port for inbound relay (default 2525) |

> ⚡ = needed only for **sending to external domains** (Gmail, Outlook etc.)
> For Gmail: enable 2FA → generate an App Password at myaccount.google.com → use that as SMTP_PASS

## Step 3 — Database setup
```bash
# Create DB
sudo -u postgres psql -c "CREATE DATABASE psyx;"
sudo -u postgres psql -c "CREATE USER psyx WITH PASSWORD 'strongpassword';"
sudo -u postgres psql -c "GRANT ALL ON DATABASE psyx TO psyx;"

# Push schema (run once, or after updates)
DATABASE_URL=postgres://psyx:strongpassword@localhost/psyx node -e "
  require('./api/index.mjs')
" &
# OR use drizzle-kit push from the source repo
```

## Step 4 — Start with PM2
```bash
cd /srv/psyx
pm2 start ecosystem.config.js
pm2 save
pm2 startup    # follow the printed command to auto-start on reboot
```

## Step 5 — Nginx
```bash
cp nginx.conf.example /etc/nginx/sites-available/psyx
# Edit: replace YOUR_DOMAIN with your actual domain
nano /etc/nginx/sites-available/psyx
ln -s /etc/nginx/sites-available/psyx /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# HTTPS (free certificate)
certbot --nginx -d yourdomain.com
```

## Step 6 — Inbound email (real delivery from Gmail → your inbox)
To receive external email in PSYX:
1. Add an **MX record** in your DNS:
   - Type: `MX`, Name: `@`, Value: `your-server-ip`, Priority: `10`
2. Use a relay service (Cloudflare Email Routing, Mailgun, SendGrid inbound) to forward to port 2525 on your server
3. Open port 2525 in your firewall: `ufw allow 2525/tcp`

## Outbound SMTP setup (Gmail example)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youremail@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx   # Gmail App Password
```
Get App Password: Google Account → Security → 2-Step Verification → App Passwords

## Owner account
Log in with: **ogpsyx731@gmail.com** / `@mayank731`
Navigate to `/owner` for the Owner Override panel.

## Upgrading
1. Build new `api/` and `public/` from source
2. Replace `/srv/psyx/api/` and `/srv/psyx/public/`
3. `pm2 restart psyx-api`

---

## Features
- ✅ @psyx.com inboxes with real SMTP inbound
- ✅ Send to any domain (Gmail, Outlook, etc.) via SMTP
- ✅ Live inbox via WebSocket (auto-reconnect with backoff)
- ✅ Bell turns RED with count badge on new alerts
- ✅ Click notification → jump to that email
- ✅ Browser push notifications with click-to-open
- ✅ Mobile-responsive with drawer sidebar + bottom nav
- ✅ 6 colour themes (Profile → Color Theme)
- ✅ Owner panel with user management, logs, admin registry
- ✅ Draft save, search, pagination, star, spam, trash
