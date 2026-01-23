# Cache Architecture Clarification & Verification

## ❌ What You Described (Incorrect)

> "Market price is stored in the **Subscription Cache** table, and position size calculator uses the Subscription Cache updated every 10 seconds"

**Problem:** This is NOT correct. We have TWO different caches:

---

## ✅ What Actually Exists (Correct)

### Database Tables:

1. **`price_cache` table** ← FOR MARKET PRICES
   - Stores: symbol, price, bid, ask, high_24h, low_24h, volume, change
   - Updated: Every **1 second** (not 10 seconds)
   - Source: Finnhub WebSocket
   - Used by: Position size calculator, any price queries

2. **`push_subscriptions` table** ← FOR NOTIFICATIONS ONLY
   - Stores: user_id, endpoint, encryption keys
   - Updated: When user subscribes/unsubscribes
   - Source: User browser web-push subscription
   - Used by: Push notification system to know which users to notify

---

## 📊 Architecture Comparison

### WRONG UNDERSTANDING:
```
Market Price Flow:
Finnhub → Subscription Cache (DB) → Position Size Calculator
Updates every 10 seconds ❌
```

### CORRECT UNDERSTANDING:
```
Market Price Flow (Two Levels):
┌─ IN-MEMORY CACHE (push-sender service)
│  ├─ Finnhub sends price tick
│  ├─ Cached instantly in memory (for <2ms response)
│  └─ Batch accumulated for 1 second
│
└─ DATABASE CACHE (price_cache table)
   ├─ Every 1 second, batch upload to price_cache
   ├─ Position size calculator queries from price_cache
   └─ Always fresh prices (max 1 second old)

Updates every 1 SECOND (not 10 seconds) ✅
```

---

## 🎯 The Three-Layer System (Correct)

### Layer 1: Finnhub WebSocket (Real-time)
```
Finnhub sends EUR/USD price tick every 1-2 seconds
```

### Layer 2: In-Memory Price Cache (push-sender service)
```
All 65 prices cached in RAM for <2ms response
Updated every Finnhub tick (1-2 seconds)
Batched for 1 second, then uploaded to database
```

### Layer 3: Database Price Cache Table
```
CREATE TABLE price_cache (
  id UUID PRIMARY KEY,
  symbol VARCHAR(20) UNIQUE,  -- "EUR/USD", "BTC/USD", etc.
  price DECIMAL(15,5),        -- Latest price
  bid DECIMAL(15,5),          -- Bid price
  ask DECIMAL(15,5),          -- Ask price
  high_24h DECIMAL(15,5),     -- 24h high
  low_24h DECIMAL(15,5),      -- 24h low
  volume_24h DECIMAL,         -- 24h volume
  change_24h DECIMAL,         -- Price change in 24h
  change_percent_24h DECIMAL, -- % change in 24h
  source VARCHAR(50),         -- "finnhub", "binance", etc.
  updated_at TIMESTAMP,       -- When last updated
  created_at TIMESTAMP        -- When first created
);
```

**Updated:** Every 1 second from push-sender batch
**Used by:** Position size calculator, price queries, frontend

---

## 🔄 How Position Size Calculator Gets Prices

### Current Flow (What You Want):

```
1. User opens Position Size Calculator
2. Selects symbol: "EUR/USD"
3. Calculator queries backend API
   GET /prices?symbol=EUR%2FUSD
   ↓
4. Backend checks price_cache table
   SELECT price, bid, ask FROM price_cache 
   WHERE symbol = 'EUR/USD'
   ↓
5. Returns: { price: 1.0855, bid: 1.0854, ask: 1.0856 }
6. Position size calculator displays instantly
   ├─ Price is fresh (max 1 second old)
   ├─ From database (not from third-party API)
   └─ User never calls Finnhub API directly
```

**NOT from Subscription Cache** ❌
**FROM price_cache table** ✅

---

## 📋 Correct Table Names

| Table | Purpose | Update Frequency | Used By |
|-------|---------|------------------|---------|
| `price_cache` | Store market prices for all 65 pairs | Every 1 second | Position size calculator, frontend price queries |
| `push_subscriptions` | Store user browser subscriptions | On subscribe/unsubscribe | Push notification system |
| `push_notification_queue` | Queue notifications to send | On new notification | Push sender microservice |

---

## ✅ Verification: Is This Correct?

### Question 1: Does market price store in "Subscription Cache"?
**Answer:** NO ❌
- Market prices store in **`price_cache` table**
- Subscription Cache stores **`push_subscriptions`** (notification endpoints only)

### Question 2: Is "Subscription Cache" the right table for prices?
**Answer:** NO ❌
- "Subscription Cache" is for notifications, not prices
- For prices, use **`price_cache` table**

### Question 3: Is prices updated every 10 seconds?
**Answer:** NO ❌
- Prices updated every **1 second** (not 10 seconds)
- Finnhub sends ticks every 1-2 seconds
- We batch and update database every 1 second

### Question 4: Does position size calculator use "Subscription Cache"?
**Answer:** NO ❌
- Position size calculator uses **`price_cache` table**
- Gets fresh prices (max 1 second old)
- No API calls to Finnhub or external services

---

## 🔧 How to Fix Position Size Calculator

If it's currently getting prices from wrong place, update it:

### WRONG (Current - probably):
```typescript
// Don't do this - hits external API
const price = await fetchFromFinnhub('EUR/USD');
```

### CORRECT (What it should do):
```typescript
// Do this - hits local database cache
const price = await backend.get('/prices?symbol=EUR%2FUSD');
// Response: { price: 1.0855, bid: 1.0854, ask: 1.0856 }
```

---

## 📊 Real Data Flow for Position Size Calculator

```
USER ACTION:
User opens position size calculator
  ↓
FRONTEND:
  selects symbol "EUR/USD"
  ↓
API CALL:
  GET http://localhost:3000/prices?symbol=EUR%2FUSD
  ↓
BACKEND (NestJS):
  Query price_cache table
  SELECT * FROM price_cache WHERE symbol = 'EUR/USD'
  ↓
DATABASE (PostgreSQL):
  Returns row:
  {
    symbol: "EUR/USD",
    price: 1.0855,
    bid: 1.0854,
    ask: 1.0856,
    high_24h: 1.0900,
    low_24h: 1.0800,
    volume_24h: 125000000,
    change_24h: 0.0055,
    change_percent_24h: 0.51,
    updated_at: "2026-01-23T16:30:45Z"
  }
  ↓
BACKEND:
  Returns price data to frontend
  ↓
FRONTEND:
  Displays in calculator:
  "EUR/USD: 1.0855 (Bid: 1.0854 | Ask: 1.0856)"
  "24h Change: +0.51%"
  "24h Volume: 125M"
  ↓
USER:
  Enters lot size: 1.0
  Calculator instantly shows:
  "Position Size: 1000 EUR"
  "Margin: $1,085.50"
  "Risk: $108.55"
```

---

## 🚀 How Push-Sender Keeps Prices Fresh

Every second (not 10 seconds):

```
1. Finnhub WebSocket sends 65 price ticks
   └─ EUR/USD: 1.0855
   └─ GBP/USD: 1.2665
   └─ BTC/USD: 42,500
   ... (65 total)

2. Push-sender cache updates instantly
   └─ priceBatch['EUR/USD'] = { price: 1.0855, bid: 1.0854, ask: 1.0856 }
   └─ priceBatch['GBP/USD'] = { price: 1.2665, ... }
   └─ ... (all 65)

3. After 1 second, batch upload
   POST /prices/batch-update [65 prices]
   
   Database updates:
   UPDATE price_cache SET price=1.0855, bid=1.0854, ask=1.0856 WHERE symbol='EUR/USD'
   UPDATE price_cache SET price=1.2665, ... WHERE symbol='GBP/USD'
   ... (65 updates in 1 batch)

4. Next second, user queries
   GET /prices?symbol=EUR%2FUSD
   └─ Returns fresh price: 1.0855 (max 1 second old)
```

---

## ✨ Summary

### What You Got Right:
✅ Position size calculator should use cached prices
✅ Prices should be fresh and real-time
✅ No repeated external API calls

### What Was Confused:
❌ Market prices ≠ Subscription Cache
❌ Use `price_cache` table, NOT subscription table
❌ Update frequency is 1 second, NOT 10 seconds

### The Correct Flow:
```
Finnhub (1sec ticks)
    ↓
Push-sender (in-memory cache)
    ↓
price_cache table (batched every 1sec)
    ↓
Position Size Calculator (always fresh)
```

**Subscription Cache = Notifications only (push_subscriptions table)**
**Price Cache = Market prices (price_cache table)**

---

## 🎯 Action Items

If position size calculator is not using price_cache:

1. Check where it currently gets prices
2. Update to query: `GET /prices?symbol=SYMBOL`
3. Add a prices controller endpoint if missing
4. Verify it returns data from `price_cache` table
5. Test with position size calculator - should be instant (<2ms)

---

## 📝 Code Example for Position Size Calculator

```typescript
// In position size calculator component
async function calculatePositionSize(symbol: string, lotSize: number) {
  // Get latest price from cache (not external API)
  const priceResponse = await fetch(
    `http://localhost:3000/prices?symbol=${encodeURIComponent(symbol)}`
  );
  
  const { price, bid, ask } = await priceResponse.json();
  
  // Use price for calculations
  const positionSize = lotSize * 100000; // 1 lot = 100,000 units
  const marginRequired = (positionSize * price) / 100; // 1% margin
  const riskAmount = marginRequired * 0.05; // 5% risk
  
  return {
    symbol,
    price,
    bid,
    ask,
    positionSize,
    marginRequired,
    riskAmount
  };
}
```

**That's it!** No Finnhub API, no repeated calls. Just query the local price_cache database table. ✅

