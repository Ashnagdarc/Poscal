# Cloudflare Worker Setup

Use Cloudflare Workers as the smallest low-cost job runner for Poscal.

## Recommended Worker Jobs

### 1. Price Ingest Worker

Purpose:

- fetch Finnhub prices
- normalize quote payloads
- write latest snapshots into Convex

Suggested cadence:

- every 1 minute for active market data
- slower if you want to reduce vendor usage

### 2. Notification Worker

Purpose:

- call Convex HTTP action to claim pending notifications
- send push notifications
- send queued emails

## Required Secrets

Set these in Cloudflare:

- `CONVEX_SITE_URL`
- `NOTIFICATION_WORKER_SECRET`
- `PRICE_INGEST_SECRET`
- `NEWS_INGEST_SECRET`
- `FINNHUB_API_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `EMAIL_PROVIDER_API_KEY` if email delivery is enabled

## Convex Endpoints

Current HTTP actions live under Convex:

- `/prices/ingest`
- `/news/ingest`
- `/notifications/process`

### 3. Calendar Ingest Worker

Purpose:

- call Convex `POST /news/ingest` on a schedule
- economic calendar fetch + cache happens inside Convex (Forex Factory weekly feed)

Suggested cadence:

- every 30–60 minutes

Convex env required:

- `NEWS_INGEST_SECRET`

Example:

```bash
curl -X POST "$CONVEX_SITE_URL/news/ingest" \
  -H "Authorization: Bearer $NEWS_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"force": false}'
```

Optional force (bypass min interval):

```bash
curl -X POST "$CONVEX_SITE_URL/news/ingest" \
  -H "x-news-ingest-secret: $NEWS_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

## Deployment Rule

Cloudflare Worker code should stay stateless.

Do not store app state in the worker.
Only:

- fetch
- transform
- forward
- mark result

## Failure Rule

If the worker fails:

- user data is still safe in Convex
- price cache can be repopulated
- notification queue can be retried
