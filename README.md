# Poscal

Poscal is a trading journal and signal platform built around a Vite/React frontend, Convex for auth/database/backend logic, and Cloudflare Workers for lightweight background jobs.

## Current Stack

- Frontend: Vercel
- App backend + database + auth: Convex
- Background workers: Cloudflare Workers
- Payments/webhooks: Vercel `/api` routes + Convex sync

## Repo Layout

- `src/`: React frontend
- `convex/`: schema, auth, signals, journal, notifications, and HTTP actions
- `api/`: Vercel serverless routes still used for payment-related flows
- `docs/`: setup and architecture notes

## Live Pricing Model

Poscal uses shared price snapshots:

1. A worker fetches prices from vendors.
2. The worker normalizes `bid_price`, `ask_price`, `mid_price`, and `timestamp`.
3. The worker writes those values into Convex.
4. All users read the shared Convex snapshot instead of hitting vendors directly.

## Quick Start

```bash
npm install
npm run dev
```

## Local URLs

- Frontend: `http://localhost:8080`
- Convex dev: run `npm run convex:dev` in another terminal when needed

## Docs

- [Docs Index](./docs/README.md)
- [Ask Price Implementation](./docs/ASK_PRICE_IMPLEMENTATION.md)
