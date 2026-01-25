# Push-Sender Single Instance & Price Cache Architecture Fix

## Problem Summary

### 1. **Multiple Instances Running** (4 simultaneous)
- Each restart attempt created a new process instead of stopping the old one
- No lock file mechanism to enforce single instance
- Multiple `setInterval` timers for batch updates running in parallel

### 2. **Finnhub Rate Limit (429 errors)**
- 4 instances × 200+ currency pair subscriptions = 800+ simultaneous requests
- Finnhub free tier has per-IP rate limiting
- Should have max 1 WebSocket connection per API key

### 3. **Price Cache Architecture Issues**
- Frontend correctly calls `/api/prices/multiple` (cached endpoint)
- Backend correctly stores prices from push-sender batches
- But no enforcement that:
  - Only ONE push-sender runs
  - Users never call Finnhub directly (only via cache)
  - Old push-sender instances are properly cleaned up

## Solution Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  10+ Users                              │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│    Frontend Hook: useRealtimePrices                      │
│    - Polls /api/prices/multiple every 10 sec           │
│    - Gets cached data from price_cache table           │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│    Backend: GET /prices/multiple                        │
│    - Returns from price_cache table (PostgreSQL)       │
│    - No Finnhub calls on frontend request              │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│    Push-Sender Service (SINGLE INSTANCE)                │
│    - Connects to Finnhub WebSocket ONCE                │
│    - Batches prices every 1 sec                        │
│    - POSTs to /prices/batch-update every 1 sec        │
│    - Protected by systemd/lock file                   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│    Finnhub API                                          │
│    - Only 1 WebSocket connection (1 push-sender)      │
│    - Subscribed to 200+ pairs                         │
│    - No rate limit issues                             │
└─────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create systemd service for push-sender
- Replaces ad-hoc `npm start` commands
- Ensures single instance via systemd socket/type
- Auto-restarts on crash
- Proper process cleanup

### Step 2: Fix push-sender code
- Remove old instance spawning on reconnects
- Ensure only ONE batch timer
- Graceful shutdown handling

### Step 3: Deploy and verify
- Only 1 process running
- Prices populate every 1-10 seconds
- No 429 errors from Finnhub
- Frontend displays cached prices correctly

## Cost Impact for 10+ Users

### Before (if users called Finnhub directly):
- 10 users × 6 requests/min = 60 requests/min
- 60 × 60 × 24 = 86,400 requests/day
- Finnhub free tier = 60 requests/min = 86,400/day limit
- **Would hit rate limit with 10 users**

### After (single push-sender + price_cache):
- 1 push-sender × 1 WebSocket connection
- 1 price update to backend every 1 second = 86,400/day backend calls
- 10 users × 6 frontend API calls/min = 86,400/day frontend calls
- Finnhub: **Only 1 connection** (no rate limit)
- Backend: **Handles all user requests from cache**
- **Infinite scalability, no Finnhub limits**

## Key Files to Modify

1. `/opt/poscal/push-sender/systemd-service.sh` - Create systemd service
2. `/opt/poscal/push-sender/index.ts` - Remove duplicate batch timers
3. Verify Vercel API routes proxy correctly to backend
