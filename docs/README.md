# Poscal Docs

This folder now tracks the current Convex + Vercel + worker architecture.

## Read These First

- [Architecture](./ARCHITECTURE.md)
  - current stack, source of truth, and data flow

- [Server Migration Runbook](./SERVER_MIGRATION_RUNBOOK.md)
  - how to recover fast if a worker host dies

- [Cloudflare Worker Setup](./CLOUDFARE_WORKER_SETUP.md)
  - what the small worker layer should do

## Calculator Docs

- [Forex Calculations Guide](./FOREX_CALCULATIONS_GUIDE.md)
- [Position Size Accuracy Fix](./POSITION_SIZE_ACCURACY_FIX.md)

## Legacy Migration Notes

- [Convex Migration Map](./CONVEX_MIGRATION_MAP.md)
  - only needed if importing old Postgres-era data into Convex

## Future Planning

- [MT5 Integration Plan](./MT5_INTEGRATION_PLAN.md)

## Docs Policy

If a doc describes:

- Supabase auth/database/realtime
- NestJS backend runtime
- Docker Compose app stack
- `push-sender` runtime
- deleted UI routes/features

it should not be treated as current operating guidance.
