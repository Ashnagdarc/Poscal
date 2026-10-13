#!/usr/bin/env bash
set -euo pipefail
ROOT=/home/ubuntu/poscal-openship-runtime
SRC=${1:-/tmp/poscal-enable-src}
sudo mkdir -p "$ROOT"
sudo rsync -a --delete "$SRC/dist/" "$ROOT/dist/"
sudo mkdir -p "$ROOT/server-dist"
sudo cp "$SRC/server-dist/production.cjs" "$ROOT/server-dist/production.cjs"
sudo tee "$ROOT/compose.yml" >/dev/null <<'YAML'
services:
  web:
    image: node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
    container_name: poscal-openship-runtime-web
    network_mode: host
    user: "1000:1000"
    working_dir: /app
    command: ["node", "server-dist/production.cjs"]
    volumes:
      - ./dist:/app/dist:ro
      - ./server-dist:/app/server-dist:ro
    environment:
      CONVEX_URL: https://convex.poscalfx.com
      VITE_CONVEX_URL: https://convex.poscalfx.com
      VITE_CONVEX_SITE_URL: https://convex-http.poscalfx.com
      LISTEN_HOST: 127.0.0.1
      LISTEN_PORT: "23000"
    # Optional secrets file (payments/R2). Created empty-safe below.
    env_file:
      - path: .env.runtime
        required: false
    restart: unless-stopped
    read_only: true
    security_opt: ["no-new-privileges:true"]
    cap_drop: ["ALL"]
    mem_limit: 512m
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:23000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
YAML
cd "$ROOT"
# Keep existing .env.runtime if present; otherwise create placeholder keys for payments
if [ ! -f .env.runtime ]; then
  sudo tee .env.runtime >/dev/null <<'ENV'
# Fill from cutover secrets (PAYMENT_SYNC_SECRET, PAYSTACK_*, R2_*)
PAYMENT_SYNC_SECRET=
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=
R2_ACCOUNT_ID=97453a60df1c41558fc17637df7626e1
R2_BUCKET_NAME=poscal-journal
R2_ENDPOINT=https://97453a60df1c41558fc17637df7626e1.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
ENV
fi
sudo docker compose up -d --force-recreate
curl -sS http://127.0.0.1:23000/healthz; echo
