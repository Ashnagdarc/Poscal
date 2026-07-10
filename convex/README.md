# Convex Backend

This folder is the new durable data backend for Poscal.

DigitalOcean remains disposable worker infrastructure. Convex is where user-owned app data should move first:

- profiles
- trading accounts
- journal entries
- calculator history
- notification queue state

High-frequency Finnhub ticks should not be stored as history here. Store only the latest price snapshot or user-facing state; the worker cache can always be rebuilt.

## Commands

```bash
npm run convex:dev
npm run convex:deploy
npm run convex:data
npm run convex:export
```

## Current Deployments

- Dev: `valuable-axolotl-815`
- Prod: `helpful-sturgeon-546`

The local `.env.local` file stores the selected dev deployment and is intentionally ignored by Git.
