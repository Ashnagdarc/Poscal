# Poscal Architecture

## Current Stack

- Frontend: Vite + React
- Hosting: Vercel
- Auth + database + app backend: Convex
- Background jobs: Cloudflare Workers preferred
- Optional disposable worker host: DigitalOcean
- Payments: Vercel `/api` routes syncing into Convex

## Source Of Truth

- User accounts: Convex auth
- Profiles: Convex
- Trading signals: Convex
- Journal/history: Convex
- Subscription state: Convex
- Push subscription records: Convex
- Notification/email queues: Convex

Important rule:

- User data lives in Convex
- Price cache can be rebuilt

## Market Data Flow

1. A worker fetches vendor prices.
2. The worker normalizes `bid`, `ask`, `mid`, and timestamp.
3. The worker writes the latest snapshot into Convex.
4. The app reads shared snapshots from Convex instead of calling vendors directly.

This keeps the calculator consistent across users and avoids per-user vendor calls.

## Push And Email Flow

Push registration treats the browser Web Push subscription as a device identity.

1. The browser creates or reuses one Web Push subscription for the active service worker.
2. The authenticated Poscal session reconciles that browser endpoint with Convex.
3. Registration is idempotent. Repeated enable attempts return "already registered" instead of creating duplicates.
4. If the same browser endpoint was previously bound to another Poscal account, the server may rebind it only when the subscription key material matches. Older backend deployments are handled by rotating the browser subscription to a new endpoint.
5. Admin/app events queue notifications in Convex.
6. A worker pulls queued jobs from Convex HTTP actions.
7. The worker sends push/email and marks the job status back in Convex.

Operational rule: browser permission, browser subscription state, authenticated user binding, and notification delivery are separate states. The UI must reconcile them instead of assuming that one implies the others.

## Deployment Shape

### Required

- Vercel for frontend
- Convex deployment for backend/data/auth

### Optional

- Cloudflare Worker for price ingest
- Cloudflare Worker for notification/email processing
- DigitalOcean only if you want a disposable long-running worker box

## What Was Removed

The repo no longer treats these as active architecture:

- NestJS backend
- PostgreSQL as app source of truth
- Docker Compose app stack
- Supabase auth/realtime/database flows
- `push-sender` and `realtime-proxy` runtime paths

## Operational Rule

If a server expires, recreate the worker.

Do not rebuild user state from the worker box.
Rebuild only:

- env values
- worker deployment
- worker secrets
- price ingestion
- notification processing
