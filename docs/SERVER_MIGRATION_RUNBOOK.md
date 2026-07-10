# Poscal Server Migration Runbook

Use DigitalOcean as a disposable worker server. Important app data must live outside the droplet, preferably in Convex or another hosted database. If a droplet expires, rebuild it from this document instead of trying to rescue the old server.

## What DigitalOcean Runs

- Finnhub price ingestor
- push notification worker
- optional email worker
- optional Nest API during migration
- Docker Compose, logs, and health checks

Do not make the droplet the only copy of users, journals, accounts, payments, saved trades, or important settings.

## Source Of Truth

- Code: GitHub repository
- User data: Convex or hosted database
- Disposable price cache: DigitalOcean worker/backend cache
- Secrets: encrypted env backup stored off-server
- Temporary Postgres data: daily `pg_dump` stored off-server

## New Droplet Setup

1. Create a DigitalOcean Ubuntu droplet.
2. Add your SSH key.
3. SSH into it:

```bash
ssh root@YOUR_DROPLET_IP
```

4. Install Docker:

```bash
apt update
apt install -y ca-certificates curl git gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

5. Clone the repo:

```bash
mkdir -p /opt/poscal
cd /opt/poscal
git clone YOUR_GITHUB_REPO_URL .
```

6. Create env files:

```bash
cp backend/.env.example backend/.env
cp docs/env/worker.env.example push-sender/.env
```

7. Edit secrets:

```bash
nano backend/.env
nano push-sender/.env
```

Make sure `backend/.env` `SERVICE_TOKEN` matches `push-sender/.env` `NESTJS_SERVICE_TOKEN`.

8. Start services:

```bash
docker compose up -d --build
docker compose ps
```

## Verification

Backend:

```bash
curl http://127.0.0.1:3001/health
docker compose logs --tail=100 backend
```

Price worker:

```bash
docker compose logs --tail=100 poscal-price-ingestor
curl "http://127.0.0.1:3001/prices/multiple?symbols=EUR/USD,USD/JPY"
```

Push worker:

```bash
docker compose logs --tail=100 poscal-notification-worker
```

Database, if temporary Postgres is still running on DigitalOcean:

```bash
docker compose exec postgres psql -U poscal_user -d poscal_db -c "select count(*) from price_cache;"
```

## Backup Setup

Run this only if Postgres is temporarily kept on DigitalOcean:

```bash
chmod +x scripts/backup-postgres-to-drive.sh
mkdir -p /opt/poscal-backups
```

Optional Google Drive upload uses `rclone`. Configure a Drive remote once:

```bash
apt install -y rclone
rclone config
```

Example backup env:

```bash
export BACKUP_DIR=/opt/poscal-backups
export RCLONE_REMOTE="gdrive:Poscal/backups/postgres"
export GPG_PASSPHRASE="use-a-long-private-passphrase"
```

Test backup:

```bash
./scripts/backup-postgres-to-drive.sh
```

Schedule daily backup at 2 AM:

```bash
crontab -e
```

Add:

```cron
0 2 * * * cd /opt/poscal && BACKUP_DIR=/opt/poscal-backups RCLONE_REMOTE="gdrive:Poscal/backups/postgres" GPG_PASSPHRASE="YOUR_LONG_PASSPHRASE" ./scripts/backup-postgres-to-drive.sh >> /var/log/poscal-backup.log 2>&1
```

## Encrypted Env Backup

After the env files are correct, create an encrypted copy:

```bash
chmod +x scripts/export-encrypted-env-backup.sh
GPG_PASSPHRASE="YOUR_LONG_PASSPHRASE" ./scripts/export-encrypted-env-backup.sh
```

Upload the generated `.tar.gz.gpg` file to Google Drive or another off-server location. Do not commit real env files to Git.

## Moving To A New Droplet

1. Create the new droplet.
2. Install Docker.
3. Clone the repo.
4. Download the encrypted env backup.
5. Decrypt it:

```bash
gpg --batch --yes --passphrase "YOUR_LONG_PASSPHRASE" -o poscal-env-backup.tar.gz -d poscal-env-backup.tar.gz.gpg
tar -xzf poscal-env-backup.tar.gz
```

6. Copy env files into `backend/.env` and `push-sender/.env`.
7. Run:

```bash
docker compose up -d --build
docker compose ps
```

8. Verify backend, price worker, and push worker.
9. Update DNS, Vercel `BACKEND_URL`, or any API proxy to point to the new server.
10. Shut down the old droplet after the new one is healthy.

## Restore Temporary Postgres

Only needed if app data is still in Postgres on DigitalOcean:

```bash
gpg --batch --yes --passphrase "YOUR_LONG_PASSPHRASE" -o backup.sql.gz -d backup.sql.gz.gpg
gunzip backup.sql.gz
docker compose exec -T postgres psql -U poscal_user -d poscal_db < backup.sql
```

## Convex Rule

When Convex becomes the source of truth, do not write high-frequency price ticks into Convex. Store only the latest price snapshot or user-facing state there. High-frequency price cache can be rebuilt and can live on the worker server.
