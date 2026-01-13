# Trading Signals Flow

## Overview
User creates, monitors, and manages trading signals with real-time price tracking and take/close functionality.

## Flow Diagram

```
User navigates to /signals
    ↓
<ProtectedRoute> checks authentication
├─ Not logged in? → Redirect to /signin
└─ Logged in ✅ → Show Signals page
    ↓
Signals.tsx component loads
    ├─ Fetch user's signals from database
    ├─ Initialize useRealtimePrices hook
    ├─ Subscribe to Supabase Realtime (price_cache)
    ├─ Subscribe to Supabase Realtime (signals updates)
    └─ Render UI
    ↓
User sees:
├─ List of active signals (first 5)
├─ Signal details:
│  ├─ Currency pair
│  ├─ Buy/Sell direction
│  ├─ Entry price
│  ├─ Stop loss & pips to SL
│  ├─ Take profit levels (TP1, TP2, TP3) & pips to each
│  ├─ Chart image
│  ├─ Status (active/closed)
│  ├─ Result (win/loss/breakeven)
│  └─ Actions: Take Signal, Edit, Close, Delete
├─ Filters:
│  ├─ By status (active/closed/cancelled)
│  ├─ By currency pair
│  └─ Pagination
└─ "Create New Signal" button
    ↓
OPTION 1: CREATE NEW SIGNAL
    ↓
    User clicks "Create New Signal"
        ↓
    CreateSignalModal opens
        ├─ Currency pair selection
        ├─ Buy/Sell direction
        ├─ Entry price input
        ├─ Stop loss price
        ├─ Take profit 1 (TP1)
        ├─ Take profit 2 (optional)
        ├─ Take profit 3 (optional)
        ├─ Chart image upload
        ├─ Notes textarea
        └─ Create button
        ↓
    User fills form
        ↓
    Click "Create Signal"
        ↓
    Frontend validation:
    ├─ Currency pair selected
    ├─ Direction selected
    ├─ Entry price > 0
    ├─ SL < Entry (if sell) or SL > Entry (if buy)
    ├─ TP1, TP2, TP3 properly ordered
    └─ All numeric values valid
        ↓
    Calculate pips:
    ├─ pips_to_sl = ABS(entry - sl) * 10000
    ├─ pips_to_tp1 = ABS(tp1 - entry) * 10000
    ├─ pips_to_tp2 = ABS(tp2 - entry) * 10000 (if set)
    ├─ pips_to_tp3 = ABS(tp3 - entry) * 10000 (if set)
    └─ Risk/Reward ratio = pips_to_tp1 / pips_to_sl
        ↓
    INSERT into signals table
        ↓
    Signal created (status = 'active')
        ↓
    Modal closes
        ↓
    Signal appears in list
        ↓
    Real-time price updates begin
        ↓
OPTION 2: TAKE SIGNAL
    ↓
    User clicks "Take Signal" on active signal
        ↓
    TakeSignalModal opens
        ├─ Show signal details
        ├─ Show current market price
        ├─ Select trading account
        ├─ Confirm entry price (match or current)
        ├─ Position size calculation:
        │  ├─ Risk amount (e.g., $100)
        │  ├─ Stop loss distance (pips)
        │  └─ Auto-calculate position size
        ├─ Execution type: Market/Pending
        └─ Take button
        ↓
    User confirms
        ↓
    INSERT into taken_trades table
    Columns:
    ├─ id
    ├─ user_id
    ├─ signal_id (links to signals)
    ├─ account_id (links to trading_accounts)
    ├─ entry_price
    ├─ position_size
    ├─ entry_date
    ├─ status (open/closed)
    └─ profit_loss (NULL initially)
        ↓
    taken_trades entry created
        ↓
    Real-time monitoring begins
        ↓
OPTION 3: MONITOR SIGNAL
    ↓
    Component renders signal row
        ↓
    useRealtimePrices provides current price
        ↓
    For each take profit level:
    ├─ Check if current price >= TP1
    │  └─ If YES: Mark tp1_hit = true
    ├─ Check if current price >= TP2
    │  └─ If YES: Mark tp2_hit = true
    ├─ Check if current price >= TP3
    │  └─ If YES: Mark tp3_hit = true
    └─ Check if current price <= SL
       └─ If YES: Auto-close signal with loss
        ↓
    Display current P&L:
    ├─ Current price
    ├─ Unrealized P&L
    ├─ P&L percentage
    └─ Distance to TP1, TP2, SL (pips)
        ↓
OPTION 4: CLOSE SIGNAL
    ↓
    Signal hits take profit or stop loss automatically
    OR user manually closes signal
        ↓
    If automatic (TP hit):
    ├─ Detect tp1_hit / tp2_hit / tp3_hit
    ├─ Calculate final P&L
    ├─ Set status = 'closed'
    ├─ Set result = 'win' / 'loss' / 'breakeven'
    └─ Update UI
        ↓
    If manual close (CloseTradeModal):
    ├─ User enters closing price
    ├─ Calculate final P&L
    ├─ Confirm action
    ├─ UPDATE signals
    │  ├─ status = 'closed'
    │  ├─ result = 'win'/'loss'/'breakeven'
    │  ├─ closed_at = NOW()
    │  └─ profit_loss = calculated
    └─ Modal closes
        ↓
    Signal appears in history with result
        ↓
OPTION 5: VIEW STATISTICS
    ↓
    User can see signal performance:
    ├─ Total signals
    ├─ Active signals
    ├─ Closed signals
    ├─ Win rate
    ├─ Average win
    ├─ Average loss
    ├─ Profit factor
    ├─ Best signal
    └─ Worst signal
        ↓
    Calculated from:
    ├─ SELECT * FROM signals WHERE user_id = current_user
    ├─ Calculate:
    │  ├─ total = COUNT(*)
    │  ├─ wins = COUNT(result = 'win')
    │  ├─ losses = COUNT(result = 'loss')
    │  ├─ win_rate = wins / (wins + losses)
    │  └─ avg_win = AVG(profit_loss) WHERE result = 'win'
    └─ Display in dashboard
```

## Detailed Signal Lifecycle

### 1. Create Signal

**File:** `src/components/CreateSignalModal.tsx`

```typescript
const handleCreate = async () => {
  // Validation
  if (!formData.currencyPair) {
    toast.error("Please select a currency pair");
    return;
  }

  if (formData.entryPrice <= 0) {
    toast.error("Entry price must be greater than 0");
    return;
  }

  // Calculate pips (for forex, 1 pip = 0.0001)
  const pipsToSL = Math.abs(formData.entryPrice - formData.stopLoss) * 10000;
  const pipsToTP1 = Math.abs(formData.takeProfitOne - formData.entryPrice) * 10000;

  // INSERT into database
  const { data, error } = await supabase
    .from('signals')
    .insert({
      user_id: user.id,
      currency_pair: formData.currencyPair,
      direction: formData.direction,  // 'buy' or 'sell'
      entry_price: formData.entryPrice,
      stop_loss: formData.stopLoss,
      take_profit_1: formData.takeProfitOne,
      take_profit_2: formData.takeProfitTwo || null,
      take_profit_3: formData.takeProfitThree || null,
      pips_to_sl: pipsToSL,
      pips_to_tp1: pipsToTP1,
      status: 'active',
      chart_image_url: chartImageUrl || null,
      notes: formData.notes || null,
    });

  if (error) {
    toast.error("Failed to create signal");
    return;
  }

  toast.success("Signal created!");
  onClose();
};
```

**Database Insert:**
```sql
INSERT INTO signals (
  id,
  user_id,
  currency_pair,
  direction,
  entry_price,
  stop_loss,
  take_profit_1,
  take_profit_2,
  take_profit_3,
  pips_to_sl,
  pips_to_tp1,
  pips_to_tp2,
  pips_to_tp3,
  status,
  result,
  chart_image_url,
  notes,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'user-id',
  'EUR/USD',
  'buy',
  1.08920,
  1.08800,
  1.09100,
  NULL,
  NULL,
  120,  -- pips
  180,  -- pips
  NULL,
  NULL,
  'active',
  NULL,
  'https://storage.url/signal-123.png',
  'Strong uptrend',
  NOW(),
  NOW()
);
```

### 2. Real-Time Monitoring

```typescript
// In Signals.tsx component
const { prices, lastUpdated } = useRealtimePrices();

// For each signal, calculate live P&L
const calculateLiveStats = (signal: TradingSignal) => {
  const currentPrice = prices[signal.currency_pair]?.mid;
  
  if (!currentPrice) return null;

  // Calculate pips moved
  const pipsMoved = (currentPrice - signal.entry_price) * 10000;
  
  // Determine distance to TP levels
  const distanceToTP1 = (signal.take_profit_1 - currentPrice) * 10000;
  const distanceToSL = (signal.stop_loss - currentPrice) * 10000;

  // Check if TP or SL hit
  const tp1Hit = signal.direction === 'buy' 
    ? currentPrice >= signal.take_profit_1
    : currentPrice <= signal.take_profit_1;

  const slHit = signal.direction === 'buy'
    ? currentPrice <= signal.stop_loss
    : currentPrice >= signal.stop_loss;

  return {
    currentPrice,
    pipsMoved,
    distanceToTP1,
    distanceToSL,
    tp1Hit,
    slHit,
    unrealizedPL: pipsMoved,  // In pips (convert to $ based on position size)
  };
};
```

### 3. Take Signal

**File:** `src/components/TakeSignalModal.tsx`

```typescript
const handleTakeSignal = async () => {
  if (!selectedAccount) {
    toast.error("Please select a trading account");
    return;
  }

  // Insert into taken_trades
  const { error } = await supabase
    .from('taken_trades')
    .insert({
      user_id: user.id,
      signal_id: signal.id,
      account_id: selectedAccount.id,
      entry_price: confirmEntry || signal.entry_price,
      position_size: calculatePositionSize(),
      entry_date: new Date().toISOString(),
      status: 'open',
      profit_loss: 0,  // Not realized yet
    });

  if (error) {
    toast.error("Failed to take signal");
    return;
  }

  toast.success("Signal taken!");
  
  // Update signal status (optional)
  await supabase
    .from('signals')
    .update({ status: 'taken' })
    .eq('id', signal.id);

  onClose();
};
```

### 4. Auto-Close on TP Hit

```typescript
// In Signals.tsx, check each signal
useEffect(() => {
  signals.forEach(async (signal) => {
    const stats = calculateLiveStats(signal);
    
    if (!stats) return;

    // Check if TP1 hit
    if (stats.tp1Hit && !signal.tp1_hit) {
      // Close signal with win
      const { error } = await supabase
        .from('signals')
        .update({
          status: 'closed',
          result: 'win',
          tp1_hit: true,
          closed_at: new Date().toISOString(),
        })
        .eq('id', signal.id);

      if (!error) {
        // Trigger notification
        sendNotification({
          title: `${signal.currency_pair} - PROFIT! 🎉`,
          body: `Take Profit 1 hit at ${stats.currentPrice}`,
        });
      }
    }

    // Check if SL hit
    if (stats.slHit && !signal.closed_at) {
      // Close signal with loss
      await supabase
        .from('signals')
        .update({
          status: 'closed',
          result: 'loss',
          closed_at: new Date().toISOString(),
        })
        .eq('id', signal.id);

      // Trigger alert notification
      sendNotification({
        title: `${signal.currency_pair} - LOSS`,
        body: `Stop Loss hit at ${stats.currentPrice}`,
      });
    }
  });
}, [prices, signals]);
```

### 5. Close Signal Manually

**File:** `src/components/CloseTradeModal.tsx`

```typescript
const handleCloseSignal = async () => {
  if (!closingPrice) {
    toast.error("Please enter closing price");
    return;
  }

  // Calculate P&L
  let pnl: number;
  if (signal.direction === 'buy') {
    pnl = (closingPrice - signal.entry_price) * 10000;  // In pips
  } else {
    pnl = (signal.entry_price - closingPrice) * 10000;
  }

  // Determine result
  let result: 'win' | 'loss' | 'breakeven';
  if (pnl > 0) result = 'win';
  else if (pnl < 0) result = 'loss';
  else result = 'breakeven';

  // Update signal
  const { error } = await supabase
    .from('signals')
    .update({
      status: 'closed',
      result: result,
      profit_loss: pnl,
      closed_at: new Date().toISOString(),
    })
    .eq('id', signal.id);

  if (error) {
    toast.error("Failed to close signal");
    return;
  }

  toast.success(`Signal closed with ${result}!`);
  onClose();
};
```

## Real-Time Realtime Subscriptions

```typescript
// Subscribe to signals changes
const signalsChannel = supabase
  .channel('signals')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'signals',
      filter: `user_id=eq.${user.id}`,
    },
    (payload) => {
      const { eventType, new: newSignal } = payload;

      if (eventType === 'INSERT') {
        // New signal created
        setSignals(prev => [newSignal, ...prev]);
      } else if (eventType === 'UPDATE') {
        // Signal updated (closed, etc.)
        setSignals(prev => 
          prev.map(s => s.id === newSignal.id ? newSignal : s)
        );
      } else if (eventType === 'DELETE') {
        // Signal deleted
        setSignals(prev => prev.filter(s => s.id !== newSignal.id));
      }
    }
  )
  .subscribe();
```

## Signal Fields

| Field | Type | Required | Example |
|-------|------|----------|---------|
| currency_pair | text | ✅ | EUR/USD |
| direction | enum | ✅ | buy, sell |
| entry_price | numeric | ✅ | 1.08920 |
| stop_loss | numeric | ✅ | 1.08800 |
| take_profit_1 | numeric | ✅ | 1.09100 |
| take_profit_2 | numeric | ❌ | 1.09300 |
| take_profit_3 | numeric | ❌ | 1.09500 |
| pips_to_sl | numeric | ✅ | 120 |
| pips_to_tp1 | numeric | ✅ | 180 |
| pips_to_tp2 | numeric | ❌ | 380 |
| pips_to_tp3 | numeric | ❌ | 580 |
| chart_image_url | text | ❌ | https://... |
| notes | text | ❌ | Strong uptrend |
| status | enum | ✅ | active, closed, cancelled |
| result | enum | ❌ | win, loss, breakeven |
| created_at | timestamp | ✅ | 2025-01-13T14:00:00Z |
| closed_at | timestamp | ❌ | 2025-01-13T15:30:00Z |

## Performance Calculation

### Pip Calculation
```
For EUR/USD (most majors):
- 1 pip = 0.0001
- Pips moved = ABS(current - entry) * 10000

Example:
Entry: 1.08920
Current: 1.09000
Pips: (1.09000 - 1.08920) * 10000 = 80 pips
```

### P&L Calculation
```
BUY Signal:
- Profit if: current price > entry price
- Loss if: current price < entry price

SELL Signal:
- Profit if: current price < entry price
- Loss if: current price > entry price

Money P&L = pips * contract size * pip value
(pip value = 10 USD for standard lot on most majors)
```

### Risk/Reward Ratio
```
RR Ratio = TP distance / SL distance

Example:
Entry: 1.08920
SL: 1.08800 (120 pips risk)
TP1: 1.09100 (180 pips reward)
RR Ratio = 180/120 = 1.5:1

Good ratio: > 1.5:1
```

## Related Files

- [src/pages/Signals.tsx](../../src/pages/Signals.tsx) - Main signals page
- [src/components/CreateSignalModal.tsx](../../src/components/CreateSignalModal.tsx) - Create form
- [src/components/UpdateSignalModal.tsx](../../src/components/UpdateSignalModal.tsx) - Edit form
- [src/components/TakeSignalModal.tsx](../../src/components/TakeSignalModal.tsx) - Take signal form
- [src/components/CloseTradeModal.tsx](../../src/components/CloseTradeModal.tsx) - Close form
- [src/hooks/use-realtime-prices.ts](../../src/hooks/use-realtime-prices.ts) - Price hook
- [05_REALTIME_PRICES_FLOW.md](./05_REALTIME_PRICES_FLOW.md) - Price flow documentation

## Next: Trading Journal

Record trades in journal → [Journal Flow](./07_JOURNAL_FLOW.md)
