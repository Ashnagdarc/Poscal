# Cloudflare market-data worker

Minimal Cloudflare Worker cron for polling Finnhub and writing latest snapshots into Convex.

## Runtime model

- Cloudflare Worker cron polls Finnhub every 5 minutes
- Worker sends normalized quotes to Convex's public mutation API on the `.convex.cloud` URL
- Worker also triggers Convex notification/email processing on the `.convex.site` URL
- Convex validates a shared secret and upserts `priceSnapshots`

## Local files

- Config: `workers/market-data/wrangler.jsonc`
- Worker: `workers/market-data/src/index.ts`
- Local secrets template: `workers/market-data/.dev.vars.example`

## Required secrets

Set the same `PRICE_INGEST_SECRET` in both places:

- Convex env: `PRICE_INGEST_SECRET`
- Cloudflare Worker secret: `PRICE_INGEST_SECRET`

Other required Worker secrets/vars:

- `CONVEX_URL`
- `CONVEX_SITE_URL`
- `FINNHUB_API_KEY`
- `NOTIFICATION_WORKER_SECRET`
- `WORKER_TRIGGER_SECRET` for authenticated manual POST runs

Optional vars:

- `POLL_SYMBOLS`
- `ESTIMATED_SPREAD_BPS`

`POLL_SYMBOLS` accepts either:

- built-in display symbols: `BTC/USD,ETH/USD`
- or explicit mappings: `US500=OANDA:SPX500_USD,BTC/USD=BINANCE:BTCUSDT`

Recommended production setup for this repo:

- Use the Worker for a very small shared symbol set with stable Finnhub coverage
- Use frontend fallback/shared cache for forex-heavy lot-size calculations
- Keep `XAU/USD` active in the frontend live symbol set even if it is not written by this Worker
- If one provider quote fails or is rate-limited, the Worker ingests the symbols that succeeded instead of failing the whole run

The current Finnhub key on this project returns `403` for `OANDA:*` forex symbols and can also hit `429` when the polled set is too broad. The checked-in Worker default is intentionally limited to `BTC/USD` and `ETH/USD` so the shared ingestion path stays reliable for 100-1000 users.

## Public route behavior

- `GET /` returns a health payload only and does **not** call Finnhub
- `POST /` runs a manual ingestion pass only when `Authorization: Bearer <WORKER_TRIGGER_SECRET>` or `x-worker-trigger-secret` matches
- Cron remains the normal production ingestion path

## Commands

From repo root:

- `npm run worker:prices:dev`
- `npm run worker:prices:deploy`
