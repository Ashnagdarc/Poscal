# Poscal Docs

This folder holds the current architecture, deployment, and feature notes for Poscal.

## Recommended Deployment Shape

- Frontend on Vercel
- Backend, PostgreSQL, and workers on Docker

That is the current recommended setup for this repo.

## Key Docs

- [Docker Deployment](./DOCKER_DEPLOYMENT.md)
  - How to run `postgres + backend + workers` with Docker on your Mac or VPS.

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

In `hybrid` mode:

- OANDA is used for forex and metals
- Finnhub is used for crypto

This is the current source of truth for live price handling.
