# Docker Deployment Guide

## Recommended Hosting Split

Keep the frontend on Vercel and run the backend stack on your VPS with Docker.

- Vercel: frontend
- VPS Docker: PostgreSQL, Nest backend, price ingestor, notification worker

This keeps frontend deploys fast and simple while giving you full control over the backend and worker services.

## Services in Docker

The root `docker-compose.yml` starts:

- `postgres`
- `backend`
- `poscal-price-ingestor`
- `poscal-notification-worker`

The backend container:

- waits for PostgreSQL
- bootstraps schema once on a fresh empty Docker database
- runs pending TypeORM migrations
- starts Nest on port `3001`

## Local Setup On Your Mac

1. Copy env files:

```bash
cp backend/.env.example backend/.env
cp push-sender/.env.example push-sender/.env
```

2. Make sure these values line up:

- `backend/.env`
  - `SERVICE_TOKEN`
  - `BACKEND_SERVICE_TOKEN`
  - `FRONTEND_URL`
- `push-sender/.env`
  - `NESTJS_SERVICE_TOKEN`
  - `FINNHUB_API_KEY`
  - `OANDA_API_KEY`
  - `OANDA_ACCOUNT_ID`

`NESTJS_SERVICE_TOKEN` must match `backend/.env` `SERVICE_TOKEN`.

3. Start the stack:

```bash
docker compose up -d --build
```

4. Check it:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f poscal-price-ingestor
```

Backend URLs:

- API: `http://localhost:3001`
- Health: `http://localhost:3001/health`
- Swagger: `http://localhost:3001/api/docs`

## VPS Deploy Flow

Use this simple flow:

```bash
git pull
docker compose up -d --build
docker compose ps
```

That is the easiest and safest beginner workflow.

## What Not To Do First

Do not try to make your Mac Docker daemon auto-sync live containers to your VPS.

That is possible with more advanced tooling, but it adds confusion fast. Start with:

- edit locally
- test locally
- push code
- pull on VPS
- rebuild containers

## Fast Change Loop

For frontend changes:

- push to Git
- Vercel redeploys automatically

For backend and worker changes:

- `git pull`
- `docker compose up -d --build`

That gives you a clean and predictable deploy process without learning too many things at once.
