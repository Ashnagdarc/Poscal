# PosCal Push Sender Services (Notification Worker + Price Ingestor)

This package now ships **two focused Node.js workers** that talk to the NestJS backend only:

1. **Notification Worker** – polls `/notifications/push/pending`, delivers Web Push messages, and updates queue status.
2. **Price Ingestor** – ingests market prices and POSTs normalized bid/ask/mid data to `/prices/batch-update`.

Both workers share common config/logging/retry helpers in `src/lib` and can be run independently on the same host.

---

## 📁 Repository Layout

| Path | Purpose |
|------|---------|
| `src/notification-worker.ts` | Entry point for queue processing service |
| `src/price-ingestor.ts` | Entry point for the market-data → backend bridge |
| `src/workers/*` | Worker implementations |
| `src/lib/*` | Shared config, logger, NestJS Axios client, retry helper, symbol map |
| `ecosystem.config.js` | PM2 definition for running both workers |
| `.env.example` | Environment template referencing NestJS + VAPID secrets |

---

## 🔐 Environment Variables

The workers rely on the NestJS internal API rather than talking to the database directly. Copy `.env.example` to `.env` and customize these values:

| Name | Required | Default | Notes |
|------|----------|---------|-------|
| `NESTJS_API_URL` | ✅ | `http://localhost:3000` | Base URL for the backend |
| `NESTJS_SERVICE_TOKEN` | ✅ | – | Must match `SERVICE_TOKEN` configured in the backend |
| `PRICE_PROVIDER_MODE` | ❌ | `hybrid` | `hybrid` uses OANDA for forex/metals and Finnhub for crypto |
| `OANDA_ENV` | ❌ | `practice` | `practice` uses fxPractice and `live` uses fxTrade |
| `FINNHUB_API_KEY` | ✅ (`PRICE_PROVIDER_MODE=finnhub` or `hybrid`) | – | Required for the Finnhub crypto branch |
| `OANDA_API_URL` | ❌ | `https://api-fxpractice.oanda.com` | Override with `https://api-fxtrade.oanda.com` for a live OANDA account |
| `OANDA_API_KEY` | ✅ (`PRICE_PROVIDER_MODE=oanda` or `hybrid`) | – | Personal access token for OANDA REST pricing |
| `OANDA_ACCOUNT_ID` | ✅ (`PRICE_PROVIDER_MODE=oanda` or `hybrid`) | – | Account ID used for OANDA pricing requests |
| `OANDA_INSTRUMENT_CHUNK_SIZE` | ❌ | `25` | Instruments fetched per OANDA pricing request |
| `VAPID_PUBLIC_KEY` | ✅ (notifications) | – | Already embedded in the frontend; keep in sync |
| `VAPID_PRIVATE_KEY` | ✅ (notifications) | – | Private VAPID key used to sign pushes |
| `VAPID_SUBJECT` | ❌ | `mailto:info@poscalfx.com` | Contact email advertised in VAPID headers |
| `POLL_INTERVAL` | ❌ | `30000` | Notification polling interval in ms |
| `BATCH_INTERVAL` | ❌ | `1000` | Price flush interval in ms |

`dotenv` is loaded automatically by the shared config helper, so placing the `.env` file in the `push-sender/` directory is enough for both workers.

---

## 🧪 Local Development

```bash
cd push-sender
npm install
cp .env.example .env   # update the secrets mentioned above

# Type-check & build once
npm run build

# Run the workers (in two terminals)
npm run dev:notification
npm run dev:prices

# Alternatively run one-off
npm start            # notification worker (alias of start:notification)
npm run start:prices # price ingestor
```

- The dev scripts use `tsx watch` so code changes hot-reload.
- Each worker can be started/stopped independently, which is handy when you only need notifications on a staging box.

---

## 🚀 Production Deployment with PM2

The repo ships with `ecosystem.config.js` to keep both workers alive via PM2:

```bash
cd /opt/poscal/push-sender
npm ci
npm run build

# Start both apps via ecosystem config
pm2 start ecosystem.config.js

# Persist across reboots
pm2 startup
pm2 save

# Inspect
pm2 ls
pm2 logs poscal-notification-worker
pm2 logs poscal-price-ingestor
```

The config ensures:
- Processes run from the repo root so `.env` is discovered.
- Each worker is limited to ~250 MB and auto restarts on failure.

> Prefer Systemd? You can still wrap the same `node dist/<worker>.js` commands in unit files, but PM2 keeps the Node-specific ergonomics (logs, restarts, env inheritance) simple.

---

## 🧱 Build & Release Artifacts

`npm run build` compiles both entry points to `dist/notification-worker.js` and `dist/price-ingestor.js`. Any process manager (PM2, Systemd, Docker) should execute those files rather than the TypeScript sources in production.

Existing Dockerfiles or deployment scripts that previously ran `index.ts` need to be updated to run both workers (or just the one you require). For a minimal Docker multi-process setup you can use two containers referencing the same image or supervise them via a process manager inside the container.

---

## 🛠 Common Tasks

### Regenerate VAPID Keys

```bash
npx web-push generate-vapid-keys
# update VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env and the frontend
```

### Verify Notification Flow

1. Queue a notification through the product (or manually via `/notifications/push` endpoints).
2. Tail logs: `pm2 logs poscal-notification-worker`.
3. Confirm the queue row transitions from `pending` → `sent`.

### Verify Price Flow

1. Check that the provider-specific credentials are present and correct.
2. Tail logs: `pm2 logs poscal-price-ingestor`.
3. Ensure `/prices/batch-update` responds 2xx and price cache rows update.

---

## 🔍 Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `Missing required environment variable` on boot | `.env` not present or wrong working dir | Ensure PM2/Systemd `cwd` is `push-sender/` |
| HTTP 401 from backend | `NESTJS_SERVICE_TOKEN` mismatch | Update `.env` to match the backend token |
| Finnhub reconnect loop | Invalid / rate-limited API key | Double-check key or reduce subscribed symbols |
| OANDA pricing 401/403 | Bad token, wrong API URL, or account mismatch | Verify `OANDA_API_KEY`, `OANDA_ACCOUNT_ID`, and practice/live URL pairing |
| Pushes never send | Missing VAPID keys or queue empty | Validate `.env` keys and inspect `/notifications/push/pending` |

Use `npm run build` before redeploying so the latest TypeScript changes are in `dist/`.

---

## Price Sources

- `PRICE_PROVIDER_MODE=hybrid`: OANDA powers forex/metals while Finnhub powers crypto.
- `PRICE_PROVIDER_MODE=finnhub`: keeps the existing WebSocket trade-tick flow and estimates bid/ask around the last trade for all supported symbols.
- `PRICE_PROVIDER_MODE=oanda`: polls OANDA’s official pricing endpoint and stores real `closeoutBid` / `closeoutAsk` for all `OANDA:*` mapped instruments.

If your main goal is Stinu-style forex sizing parity without dropping crypto coverage, use `hybrid`.

## 📚 Related Docs

- [docs/PUSH_NOTIFICATION_DEPLOYMENT.md](../docs/PUSH_NOTIFICATION_DEPLOYMENT.md)
- [docs/WEBSOCKET_MIGRATION.md](../docs/WEBSOCKET_MIGRATION.md)

These still contain historical context; this README is now the source of truth for the split-worker implementation.
