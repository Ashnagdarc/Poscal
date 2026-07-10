# Poscal Docs

This folder holds the current architecture, deployment, and feature notes for Poscal.

## Recommended Deployment Shape

- Frontend on Vercel
- Backend, PostgreSQL, and workers on Docker

That is the current recommended setup for this repo.

## Key Docs

- [Docker Deployment](./DOCKER_DEPLOYMENT.md)
  - How to run `postgres + backend + workers` with Docker on your Mac or VPS.

- [Server Migration Runbook](./SERVER_MIGRATION_RUNBOOK.md)
  - How to rebuild a disposable DigitalOcean worker server and restore backups.

- [Backend Switch](./BACKEND_SWITCH.md)
  - Why the app moved away from the older Supabase-centered flow toward NestJS + PostgreSQL.

- [Ask Price Implementation](./ASK_PRICE_IMPLEMENTATION.md)
  - How the calculator now uses execution-side prices and the backend price cache.

- [API Endpoints](./API_ENDPOINTS.md)
  - Backend and compatibility route reference.

- [Push Notification Deployment](./PUSH_NOTIFICATION_DEPLOYMENT.md)
  - Web push setup and worker deployment notes.

## Current Price Architecture

Poscal uses a centralized cache model:

1. `push-sender` fetches market data.
2. It writes `bid_price`, `ask_price`, `mid_price`, and `timestamp` into the backend.
3. The backend persists those values in `price_cache`.
4. Clients read from the backend instead of calling price vendors directly.

The current worker runtime uses Finnhub. Treat Finnhub prices as market prices and apply the app's spread model for estimated execution-side bid/ask until a broker-grade bid/ask feed is available.
