# Real-Time Prices & WebSocket Flow

## Overview
How live market prices flow from Finnhub WebSocket through backend to frontend in real-time.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FINNHUB MARKET DATA                      │
│                  (Real-time tick data)                      │
│            wss://ws.finnhub.io (WebSocket)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Receives: EUR/USD @ 1.0892
                           │ Receives: GBP/USD @ 1.2745
                           │ Every tick (sub-100ms)
                           ↓
┌─────────────────────────────────────────────────────────────┐
│         DigitalOcean Droplet (push-sender service)          │
│          Node.js WebSocket Client & Server                  │
│                                                             │
│  push-sender/index.ts:                                      │
│  ├─ import WebSocket from 'ws'                              │
│  ├─ connectPriceWebSocket()                                 │
│  ├─ Subscribe to symbols: OANDA:EUR_USD, etc.              │
│  ├─ Receive trade messages                                  │
│  ├─ Parse bid/ask prices                                    │
│  ├─ Calculate mid price                                     │
│  └─ Upsert to price_cache table                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ INSERT/UPDATE price_cache
                           │ Example row:
                           │ {
                           │   symbol: 'EUR/USD',
                           │   bid_price: 1.08920,
                           │   ask_price: 1.08925,
                           │   mid_price: 1.089225,
                           │   timestamp: 1705083600000,
                           │   updated_at: NOW()
                           │ }
                           ↓
┌─────────────────────────────────────────────────────────────┐
│            SUPABASE POSTGRESQL DATABASE                     │
│                   (price_cache table)                       │
│                                                             │
│  Columns:                                                   │
│  ├─ id (UUID, primary key)                                 │
│  ├─ symbol (VARCHAR, unique)                               │
│  ├─ bid_price (NUMERIC)                                    │
│  ├─ ask_price (NUMERIC)                                    │
│  ├─ mid_price (NUMERIC)                                    │
│  ├─ timestamp (BIGINT)                                     │
│  ├─ updated_at (TIMESTAMPTZ)                               │
│  └─ created_at (TIMESTAMPTZ)                               │
│                                                             │
│  Rows: EUR/USD, GBP/USD, USD/JPY, AUD/USD, etc.           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Realtime: INSERT/UPDATE detected
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                   SUPABASE REALTIME                         │
│           (Broadcasting database changes)                   │
│                                                             │
│  Channel: price_cache                                       │
│  Event: INSERT / UPDATE / DELETE                           │
│  Listeners: All connected frontend clients                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ↓                  ↓                  ↓
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Browser Tab 1  │ │ Browser Tab 2  │ │ Mobile App     │
│                │ │                │ │                │
│ Signals page   │ │ Calculator     │ │ Calculator     │
│ useRealtimePrice │ │ useRealtimePrice │ │ useRealtimePrice │
│                │ │                │ │                │
│ Real-time      │ │ Real-time      │ │ Real-time      │
│ updates ✅      │ │ updates ✅      │ │ updates ✅      │
└────────────────┘ └────────────────┘ └────────────────┘
```

## Detailed Flow: Price Update Journey

### 1. Backend WebSocket Connection (DigitalOcean)

**File:** `push-sender/index.ts`

```typescript
import WebSocket from 'ws';

async function connectPriceWebSocket() {
  const ws = new WebSocket('wss://ws.finnhub.io');

  ws.on('open', () => {
    console.log('✅ Connected to Finnhub WebSocket');
    
    // Subscribe to currency pairs
    const symbols = ['OANDA:EUR_USD', 'OANDA:GBP_USD', 'OANDA:USD_JPY', ...];
    
    symbols.forEach(symbol => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        symbol: symbol,
      }));
      console.log(`📡 Subscribed to ${symbol}`);
    });
  });

  ws.on('message', async (data: string) => {
    try {
      const message = JSON.parse(data);

      // Finnhub sends trade data
      if (message.type === 'trade' && message.data) {
        message.data.forEach(async (trade: any) => {
          const symbol = trade.s;  // Symbol: OANDA:EUR_USD
          const price = trade.p;   // Price: 1.08920
          const bid = trade.b;     // Bid (if available)
          const ask = trade.a;     // Ask (if available)

          // Calculate mid price
          const midPrice = bid && ask ? (bid + ask) / 2 : price;

          // Upsert to database
          const { error } = await supabase
            .from('price_cache')
            .upsert({
              symbol: symbolToDisplayFormat(symbol),  // OANDA:EUR_USD → EUR/USD
              bid_price: bid || price,
              ask_price: ask || price,
              mid_price: midPrice,
              timestamp: trade.t * 1000,  // Convert to milliseconds
              updated_at: new Date().toISOString(),
            }, { onConflict: 'symbol' });

          if (error) {
            console.error(`❌ Error upserting ${symbol}:`, error);
            return;
          }

          console.log(`✅ Updated ${symbol}: ${midPrice}`);
        });
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('❌ WebSocket disconnected');
    // Attempt reconnection...
  });
}
```

### 2. Price Data Insert/Update

**Finnhub Trade Message Example:**
```json
{
  "type": "trade",
  "data": [
    {
      "s": "OANDA:EUR_USD",    // Symbol
      "p": 1.08920,              // Price
      "b": 1.08919,              // Bid
      "a": 1.08921,              // Ask
      "t": 1705083600,            // Timestamp (Unix seconds)
      "v": 1000000                // Volume
    }
  ]
}
```

**Upsert to Database:**
```sql
INSERT INTO price_cache (
  symbol,
  bid_price,
  ask_price,
  mid_price,
  timestamp,
  updated_at,
  created_at
) VALUES (
  'EUR/USD',
  1.08919,
  1.08921,
  1.08920,
  1705083600000,
  NOW(),
  NOW()
)
ON CONFLICT (symbol) DO UPDATE SET
  bid_price = 1.08919,
  ask_price = 1.08921,
  mid_price = 1.08920,
  timestamp = 1705083600000,
  updated_at = NOW();
```

**Result:**
- If new symbol: INSERT new row
- If symbol exists: UPDATE existing row
- Timestamp: When price was received
- All atomically in one operation

### 3. Supabase Realtime Broadcasts

**Realtime Channel:** `price_cache`

When price_cache is updated:
```typescript
// Supabase detects INSERT/UPDATE
// Broadcasts to all subscribed clients

// Event structure:
{
  type: 'UPDATE',  // or INSERT, DELETE
  schema: 'public',
  table: 'price_cache',
  commit_timestamp: '2025-01-13T14:30:00Z',
  new: {
    id: 'uuid',
    symbol: 'EUR/USD',
    bid_price: 1.08919,
    ask_price: 1.08921,
    mid_price: 1.08920,
    timestamp: 1705083600000,
    updated_at: '2025-01-13T14:30:00Z'
  },
  old: {
    // Previous values (for UPDATE)
  }
}
```

### 4. Frontend Hook: useRealtimePrices

**File:** `src/hooks/use-realtime-prices.ts`

```typescript
export const useRealtimePrices = (options?: { symbols?: string[] }) => {
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let subscription: any;

    const setupRealtimeListener = async () => {
      // 1. Fetch initial prices
      const { data, error } = await supabase
        .from('price_cache')
        .select('*');

      if (error) {
        console.error('Error fetching prices:', error);
        setLoading(false);
        return;
      }

      // Store initial prices
      const priceMap: PriceMap = {};
      data?.forEach(row => {
        priceMap[row.symbol] = {
          bid: row.bid_price,
          ask: row.ask_price,
          mid: row.mid_price,
          timestamp: row.timestamp,
        };
      });
      setPrices(priceMap);
      setLastUpdated(new Date());
      setLoading(false);

      // 2. Subscribe to real-time updates
      subscription = supabase
        .channel('price_cache')
        .on(
          'postgres_changes',
          {
            event: '*',  // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'price_cache',
          },
          (payload) => {
            // When price_cache changes in database
            const { new: newData, eventType } = payload;

            if (eventType === 'INSERT' || eventType === 'UPDATE') {
              // Update local state with new price
              setPrices(prev => ({
                ...prev,
                [newData.symbol]: {
                  bid: newData.bid_price,
                  ask: newData.ask_price,
                  mid: newData.mid_price,
                  timestamp: newData.timestamp,
                },
              }));
              setLastUpdated(new Date());
              console.log(`💱 ${newData.symbol} updated: ${newData.mid_price}`);
            }

            if (eventType === 'DELETE') {
              setPrices(prev => {
                const updated = { ...prev };
                delete updated[newData.symbol];
                return updated;
              });
            }
          }
        )
        .subscribe((status) => {
          console.log(`Realtime subscription status: ${status}`);
        });
    };

    setupRealtimeListener();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  // Allow manual refresh
  const refreshPrices = async () => {
    const { data, error } = await supabase
      .from('price_cache')
      .select('*');

    if (!error && data) {
      const priceMap: PriceMap = {};
      data.forEach(row => {
        priceMap[row.symbol] = {
          bid: row.bid_price,
          ask: row.ask_price,
          mid: row.mid_price,
          timestamp: row.timestamp,
        };
      });
      setPrices(priceMap);
      setLastUpdated(new Date());
    }
  };

  return { prices, loading, lastUpdated, refreshPrices };
};
```

### 5. Component Receives Prices

**File:** `src/pages/Signals.tsx`

```typescript
const Signals = () => {
  // Hook provides real-time prices
  const { prices, lastUpdated, refreshPrices } = useRealtimePrices();

  // Component re-renders when prices update
  return (
    <div>
      {/* Refresh button */}
      <button onClick={refreshPrices}>
        🔄 Refresh Prices
      </button>

      {/* Display EUR/USD price */}
      <div className="price-display">
        <span className="symbol">EUR/USD</span>
        <span className="price">{prices['EUR/USD']?.mid.toFixed(5)}</span>
        {lastUpdated && (
          <span className="timestamp">
            {format(lastUpdated, 'HH:mm:ss')}
          </span>
        )}
      </div>

      {/* Position calculator uses live prices */}
      <PositionCalculator currentPrice={prices['EUR/USD']?.mid} />
    </div>
  );
};
```

## Symbol Mapping

Finnhub and display formats differ:

| Finnhub Format | Display Format | Trading Pair |
|----------------|----------------|--------------|
| OANDA:EUR_USD | EUR/USD | Euro/US Dollar |
| OANDA:GBP_USD | GBP/USD | British Pound/US Dollar |
| OANDA:USD_JPY | USD/JPY | US Dollar/Japanese Yen |
| OANDA:USD_CHF | USD/CHF | US Dollar/Swiss Franc |
| OANDA:AUD_USD | AUD/USD | Australian Dollar/US Dollar |
| OANDA:USD_CAD | USD/CAD | US Dollar/Canadian Dollar |
| OANDA:NZD_USD | NZD/USD | New Zealand Dollar/US Dollar |
| OANDA:EUR_GBP | EUR/GBP | Euro/British Pound |
| OANDA:EUR_JPY | EUR/JPY | Euro/Japanese Yen |

**Conversion Function:**
```typescript
function symbolToDisplayFormat(finnhubSymbol: string): string {
  // OANDA:EUR_USD → EUR/USD
  if (finnhubSymbol.startsWith('OANDA:')) {
    return finnhubSymbol.replace('OANDA:', '').replace('_', '/');
  }
  return finnhubSymbol;
}

function symbolToFinnhubFormat(displaySymbol: string): string {
  // EUR/USD → OANDA:EUR_USD
  return 'OANDA:' + displaySymbol.replace('/', '_');
}
```

## Real-Time Performance Metrics

### Latency (how long from Finnhub to user's screen)

```
Finnhub trade tick
  │
  ├─ Network: 10-50ms (to your droplet)
  │
  ├─ Processing: 5-20ms (parse + upsert)
  │
  ├─ Database: 20-50ms (INSERT/UPDATE)
  │
  ├─ Realtime broadcast: 10-30ms (Supabase)
  │
  ├─ Network: 10-50ms (to your browser)
  │
  └─ React re-render: 10-30ms (UI update)
  
  TOTAL: 75-230ms (typical: ~150ms)
```

### Comparison: Twelve Data REST vs Finnhub WebSocket

| Aspect | REST (Old) | WebSocket (New) |
|--------|------------|-----------------|
| **Update Interval** | Every 10 seconds | Every tick (~50-100ms) |
| **Latency** | 10+ seconds | <200ms typical |
| **API Calls/Day** | 129,600 (exceeds limit) | Unlimited |
| **Rate Limit** | 800/day (exceeded) | No limit |
| **Cost** | Free tier exhausted | Free tier unlimited |
| **Connection** | Polling (wasteful) | Persistent (efficient) |
| **Data Freshness** | Very stale | Real-time |

## Error Handling

### WebSocket Connection Lost
```
push-sender detects disconnection
    ↓
Attempts reconnection (up to 10 times)
Exponential backoff: 5s, 10s, 20s, 40s, etc.
    ↓
Connection restored?
├─ YES → Resume price updates
└─ NO → Alert monitoring system
```

### Database Insert Fails
```
Upsert to price_cache fails
    ↓
Log error with symbol and reason
    ↓
Alert monitoring
    ↓
Prices may be stale in frontend
    ↓
Manual refresh button available
```

### Realtime Subscription Fails
```
Frontend loses Realtime connection
    ↓
Prices in component become stale
    ↓
lastUpdated timestamp doesn't change
    ↓
User can click "Refresh Prices" button
    ↓
Manually fetch latest prices
```

### Symbol Not Supported
```
Try to subscribe to unsupported symbol
    ↓
Finnhub sends error
    ↓
Log and skip subscription
    ↓
Symbol won't have price updates
    ↓
Component shows N/A or --
```

## Monitoring & Logging

### Backend Logs (push-sender)
```
[2025-01-13 14:30:00] ✅ Connected to Finnhub WebSocket
[2025-01-13 14:30:01] 📡 Subscribed to OANDA:EUR_USD
[2025-01-13 14:30:01] 📡 Subscribed to OANDA:GBP_USD
[2025-01-13 14:30:05] ✅ Updated EUR/USD: 1.08920
[2025-01-13 14:30:05] ✅ Updated GBP/USD: 1.27450
[2025-01-13 14:30:10] ✅ Updated EUR/USD: 1.08921
[2025-01-13 14:30:10] ✅ Updated GBP/USD: 1.27451
```

### Frontend Logs (browser console)
```
[auth] Token refreshed successfully
[realtime] Subscribed to price_cache
💱 EUR/USD updated: 1.08920 at 14:30:05
💱 GBP/USD updated: 1.27450 at 14:30:05
💱 EUR/USD updated: 1.08921 at 14:30:10
```

## Supported Currencies

Currently tracking (Finnhub OANDA rates):
- EUR/USD (Euro/US Dollar)
- GBP/USD (British Pound/US Dollar)
- USD/JPY (US Dollar/Japanese Yen)
- USD/CHF (US Dollar/Swiss Franc)
- AUD/USD (Australian Dollar/US Dollar)
- USD/CAD (US Dollar/Canadian Dollar)
- NZD/USD (New Zealand Dollar/US Dollar)
- EUR/GBP (Euro/British Pound)
- EUR/JPY (Euro/Japanese Yen)
- GBP/JPY (British Pound/Japanese Yen)
- XAU/USD (Gold/US Dollar)
- BTC/USD (Bitcoin/US Dollar)

Can be extended by adding more symbols to subscription list.

## Related Files

- [push-sender/index.ts](../../push-sender/index.ts) - WebSocket implementation
- [src/hooks/use-realtime-prices.ts](../../src/hooks/use-realtime-prices.ts) - Frontend hook
- [src/pages/Signals.tsx](../../src/pages/Signals.tsx) - Signals using prices
- [src/components/Calculator.tsx](../../src/components/Calculator.tsx) - Calculator using prices
- [docs/WEBSOCKET_MIGRATION.md](../WEBSOCKET_MIGRATION.md) - Detailed migration guide

## Next: Trading Signals

Use real-time prices for signals → [Signals Flow](./06_TRADING_SIGNALS_FLOW.md)
