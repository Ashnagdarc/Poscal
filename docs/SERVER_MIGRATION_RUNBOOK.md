# Poscal Server Migration Runbook

Use worker hosts as disposable infrastructure.

If a server expires:

- rebuild the worker
- restore secrets
- redeploy jobs

Do not treat the worker host as the primary copy of user data.

## Source Of Truth

- Code: GitHub
- Frontend: Vercel
- App data/auth/backend logic: Convex
- Secrets backup: encrypted env export stored off-server

## What A Worker Host Is Allowed To Own

- temporary logs
- temporary local cache
- running job processes
- market-data polling
- notification/email delivery

## What A Worker Host Must Not Own

- users
- profiles
- journal/history
- subscription state
- payment records
- push subscription records

Those belong in Convex.

## Preferred Shape

Use Cloudflare Workers first.

Use DigitalOcean only if you need:

- a long-running process
- custom binaries
- simpler debugging with SSH

## DigitalOcean Recovery Flow

1. Create a new Ubuntu droplet.
2. Add your SSH key.
3. SSH into it.
4. Install the runtime you need.
5. Clone the repo.
6. restore env values
7. start the worker process
8. verify price ingest or notification processing

## Minimal Droplet Bootstrap

```bash
ssh root@YOUR_DROPLET_IP
apt update
apt install -y curl git unzip
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs
mkdir -p /opt/poscal
cd /opt/poscal
git clone YOUR_GITHUB_REPO_URL .
npm install
```

## Secrets To Restore

Typical secrets:

- `CONVEX_SITE_URL`
- `FINNHUB_API_KEY`
- `PRICE_INGEST_SECRET`
- `NOTIFICATION_WORKER_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- provider email secret if email sending is enabled

Keep these in your encrypted env backup, not on the old server only.

## Encrypted Env Backup

Create one after secrets are correct:

```bash
chmod +x scripts/export-encrypted-env-backup.sh
GPG_PASSPHRASE="YOUR_LONG_PASSPHRASE" ./scripts/export-encrypted-env-backup.sh
```

Store the `.gpg` output off-server.

## Verification

### Price Ingest

Confirm:

- the worker can reach Finnhub
- the worker can call Convex HTTP actions
- fresh price snapshots appear in Convex

### Notifications

Confirm:

- queued notifications can be claimed
- push send succeeds
- email send succeeds if enabled
- queue status updates in Convex

## If Rebuilding On Cloudflare Instead

1. restore Cloudflare secrets
2. redeploy the Worker
3. verify cron triggers
4. confirm Convex HTTP actions respond

## Operational Rule

Losing the worker host should be annoying, not catastrophic.

If losing the box loses user state, the architecture is wrong.
