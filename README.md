# Poscal

Poscal is a trading journal and signal platform with a Vite/React frontend, a NestJS backend, PostgreSQL, and background workers for live prices and push notifications.

## Recommended Hosting

- Frontend: Vercel
- Backend + PostgreSQL + workers: Docker on your VPS

That split keeps frontend deploys fast and simple while giving you full control over pricing, notifications, and the database.

## Current Architecture

- `src/`: React frontend
- `backend/`: NestJS API + TypeORM
- `push-sender/`: price ingestor + notification worker
- `docker-compose.yml`: local/VPS Docker stack for backend services
- `api/`: legacy Vercel compatibility routes
- `docs/`: setup and architecture notes

## Live Pricing Model

Poscal now uses a backend cache model for market data:

1. One worker fetches prices from vendors.
2. The worker normalizes `bid_price`, `ask_price`, `mid_price`, and `timestamp`.
3. The worker writes those values into the backend `price_cache`.
4. All users read from the backend/database cache instead of hitting vendors directly.

In `PRICE_PROVIDER_MODE=hybrid`:

- OANDA provides real forex/metals bid/ask quotes
- Finnhub provides crypto prices

This keeps the system low-cost and scalable for many users while improving position-sizing accuracy.

## Quick Start

### Frontend

```bash
npm install
npm run dev
```

### Backend Stack With Docker

```bash
cp backend/.env.example backend/.env
cp push-sender/.env.example push-sender/.env

docker compose up -d --build
docker compose ps
```

Useful logs:

```bash
docker compose logs -f backend
docker compose logs -f poscal-price-ingestor
docker compose logs -f poscal-notification-worker
```

## Local URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health: `http://localhost:3001/health`
- Swagger: `http://localhost:3001/api/docs`

## Docs

- [Docs Index](./docs/README.md)
- [Docker Deployment](./docs/DOCKER_DEPLOYMENT.md)
- [Backend Switch](./docs/BACKEND_SWITCH.md)
- [Ask Price Implementation](./docs/ASK_PRICE_IMPLEMENTATION.md)
- [Backend README](./backend/README.md)
- [Push Sender README](./push-sender/README.md)
