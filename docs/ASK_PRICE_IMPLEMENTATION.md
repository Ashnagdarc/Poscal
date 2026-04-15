# Ask/Bid Price Implementation

This document explains the current production price-sizing flow in Poscal.

## Why This Changed

The calculator used to size positions from mid-market prices. That caused small but important differences versus professional tools like Stinu because a trader does not enter at the mid:

- buys execute at `ask`
- sells execute at `bid`

For a trading calculator, execution-side pricing is the correct model.

## Current System

Poscal now uses a backend cache architecture instead of having each user call a market-data API directly.

### Flow

1. One `push-sender` worker fetches market data.
2. The worker normalizes:
   - `bid_price`
   - `ask_price`
   - `mid_price`
   - `timestamp`
3. The worker writes that batch to the Nest backend `/prices/batch-update`.
4. The backend stores the latest values in `price_cache`.
5. The frontend reads prices from the backend cache only.

That means:

- better rate-limit protection
- one shared source of truth
- support for large numbers of users without each user hitting Finnhub or OANDA directly

## Provider Modes

### Recommended: `PRICE_PROVIDER_MODE=hybrid`

- OANDA provides real `closeoutBid` and `closeoutAsk` for forex and metals
- Finnhub provides crypto prices

### Other Modes

- `PRICE_PROVIDER_MODE=oanda`
  - OANDA-only for mapped instruments
- `PRICE_PROVIDER_MODE=finnhub`
  - keeps the older trade-tick approach with synthetic bid/ask estimation

## Calculator Logic

The calculator is now direction-aware.

### Long / Buy

- use `ask_price` as the execution-side price

### Short / Sell

- use `bid_price` as the execution-side price

### Cross Pair Conversion

Pip-value conversion also uses sided quotes where available instead of treating every conversion as a pure mid-price calculation.

That matters most for pairs like:

- `GBP/JPY`
- `EUR/JPY`
- other non-USD crosses

## Stale Handling

The frontend now treats cached quotes as one of:

- `fresh`
- `stale`
- `unavailable`

Rules:

- if a required quote is unavailable, the calculator should not silently size from missing data
- if the worker temporarily stops updating a symbol, the last good cached quote can still be shown as stale

This avoids silently swapping forex back to fake bid/ask values during an outage.

## Fallback Policy

### Forex and Metals

- primary source: OANDA
- if OANDA fails, keep the last good cached OANDA quote
- do not overwrite forex rows with synthetic Finnhub values in hybrid mode

### Crypto

- primary source: Finnhub
- if Finnhub fails, crypto data becomes stale or unavailable until the worker recovers

## Why This Architecture Matters

This design solves both accuracy and scaling:

- users get execution-side bid/ask aware sizing
- the app does not multiply vendor API requests by user count
- one worker can serve many users through the shared backend cache

That is the right structure for a low-cost build.

## Files Involved

### Frontend

- `src/components/Calculator.tsx`
- `src/hooks/use-realtime-prices.ts`
- `src/lib/forexCalculations.ts`

### Backend

- `backend/src/prices/prices.controller.ts`
- `backend/src/prices/prices.service.ts`
- `backend/src/prices/entities/price-cache.entity.ts`

### Worker

- `push-sender/src/workers/priceIngestor.ts`
- `push-sender/src/providers/oandaQuoteProvider.ts`
- `push-sender/src/lib/config.ts`
- `push-sender/src/lib/symbols.ts`

## Deployment Notes

Recommended production split:

- frontend on Vercel
- backend + PostgreSQL + workers on Docker on your VPS

That keeps frontend deploys simple while preserving the centralized cached pricing model on the server side.

## Verification Checklist

- the worker is running
- `/prices/batch-update` receives quote batches
- `price_cache` contains `bid_price`, `ask_price`, `mid_price`, and timestamps
- the frontend reads from the backend only
- buy sizing uses ask
- sell sizing uses bid
- stale quotes are shown as stale, not treated as fresh
