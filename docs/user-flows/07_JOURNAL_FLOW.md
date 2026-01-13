# Trading Journal Flow

## Overview
User logs, tracks, and analyzes individual trades in a trading journal with performance metrics.

## Flow Diagram

```
User navigates to /journal
    ↓
Page loads: Journal.tsx
    ├─ Fetch user's trades from database
    ├─ Load trading accounts (for filtering)
    ├─ Initialize real-time subscriptions
    └─ Render UI
    ↓
User sees:
├─ List of trades (paginated)
├─ Filters:
│  ├─ By account
│  ├─ By status (open/closed)
│  └─ By date range
├─ Trade details for each:
│  ├─ Currency pair
│  ├─ Buy/Sell direction
│  ├─ Entry price & date
│  ├─ Exit price & date (if closed)
│  ├─ Position size
│  ├─ Profit/Loss ($ amount)
│  ├─ P&L percentage
│  └─ Status (open/closed)
├─ Trade statistics:
│  ├─ Total trades
│  ├─ Win rate
│  ├─ Average win/loss
│  ├─ Profit factor
│  └─ Account balance progression
└─ "Add Trade" button
    ↓
OPTION 1: ADD NEW TRADE MANUALLY
    ↓
    User clicks "Add Trade"
        ↓
    PnLInputModal opens (or full form)
        ├─ Select trading account
        ├─ Select currency pair
        ├─ Direction (buy/sell)
        ├─ Entry price
        ├─ Entry date/time
        ├─ Position size
        ├─ Stop loss (for risk calculation)
        ├─ Take profit (if closed)
        ├─ Exit price (if closed)
        ├─ Exit date/time (if closed)
        ├─ Commission/fees
        ├─ Notes
        └─ Save button
        ↓
    User fills form
        ↓
    Frontend validation:
    ├─ Account selected
    ├─ Pair selected
    ├─ Prices > 0
    ├─ Position size > 0
    ├─ Entry date <= today
    └─ If closed: Exit date >= Entry date
        ↓
    Calculate P&L:
    ├─ For BUY: PL = (exit - entry) * position
    ├─ For SELL: PL = (entry - exit) * position
    ├─ Apply fees/commission
    └─ Calculate % return
        ↓
    INSERT into trades table
    Columns:
    ├─ user_id
    ├─ account_id
    ├─ currency_pair
    ├─ direction (buy/sell)
    ├─ entry_price
    ├─ entry_date
    ├─ position_size
    ├─ stop_loss
    ├─ take_profit (or exit_price if closed)
    ├─ exit_price
    ├─ exit_date
    ├─ profit_loss (calculated)
    ├─ profit_loss_percentage
    ├─ commission_fees
    ├─ status (open/closed)
    ├─ notes
    └─ created_at/updated_at
        ↓
    Trade saved
        ↓
    Modal closes
        ↓
    Trade appears in list
        ↓
OPTION 2: ADD TRADE FROM SIGNAL
    ↓
    User on /signals page
        ↓
    Takes a signal (see Trading Signals Flow)
        ↓
    Signal creates entry in taken_trades
        ↓
    taken_trades syncs to trades (or viewed from signals)
        ↓
    User can see taken trades in /journal
        ↓
OPTION 3: CLOSE OPEN TRADE
    ↓
    User finds open trade in list
        ↓
    Clicks "Close Trade" button
        ↓
    CloseTradeModal opens
        ├─ Show entry details
        ├─ Show current market price
        ├─ Allow exit price adjustment
        ├─ Calculate current P&L
        ├─ Show risk/reward ratio achieved
        └─ Close button
        ↓
    User confirms
        ↓
    UPDATE trades table
    SET exit_price = ...,
        exit_date = NOW(),
        status = 'closed',
        profit_loss = calculated,
        profit_loss_percentage = calculated
    WHERE id = trade.id
        ↓
    Trade updates in database
        ↓
    Realtime updates UI
        ↓
    Trade moves from "open" to "closed"
        ↓
OPTION 4: TAKE SCREENSHOT
    ↓
    User clicks camera icon on trade
        ↓
    TradeScreenshot component opens
        ├─ Shows trade details
        ├─ Shows chart (optional)
        └─ "Upload Screenshot" button
        ↓
    User uploads image
        ↓
    Image stored in Supabase Storage
        ↓
    URL saved to trade record
        ↓
    Screenshot appears in trade details
        ↓
OPTION 5: VIEW JOURNAL ANALYTICS
    ↓
    User views /journal page analytics section
        ↓
    Displays calculated metrics:
    ├─ Total trades (lifetime)
    ├─ Open trades (current)
    ├─ Closed trades (completed)
    ├─ Win rate (%)
    ├─ Average winning trade ($)
    ├─ Average losing trade ($)
    ├─ Largest win ($)
    ├─ Largest loss ($)
    ├─ Profit factor (wins / losses)
    ├─ Expectancy (average pnl per trade)
    ├─ Account balance over time (chart)
    └─ Monthly statistics breakdown
        ↓
    Calculated from all trades:
    └─ SELECT * FROM trades
       WHERE user_id = current_user
       AND status = 'closed'
       THEN: Calculate metrics
```

## Step-by-Step Process

### 1. Open Journal Page

**File:** `src/pages/Journal.tsx`

```typescript
const Journal = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    accountId: null,
    status: 'all',  // all, open, closed
    startDate: null,
    endDate: null,
  });

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      // Load accounts
      const { data: accountsData } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('user_id', user.id);

      setAccounts(accountsData || []);

      // Load trades
      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id);

      // Apply filters
      if (filters.accountId) {
        query = query.eq('account_id', filters.accountId);
      }
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data: tradesData } = await query
        .order('entry_date', { ascending: false });

      setTrades(tradesData || []);
      setLoading(false);
    };

    loadData();
  }, [user, filters]);

  return (
    <div className="pb-24">
      {/* Filters */}
      <JournalFilters onFiltersChange={setFilters} />

      {/* Analytics Dashboard */}
      <JournalAnalytics trades={trades} />

      {/* Trades List */}
      <div className="space-y-3 px-4">
        {trades.map(trade => (
          <TradeRow key={trade.id} trade={trade} />
        ))}
      </div>
    </div>
  );
};
```

### 2. Add New Trade

**File:** `src/components/PnLInputModal.tsx`

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Validation
  if (!formData.accountId || !formData.currencyPair) {
    toast.error("Please select account and currency pair");
    return;
  }

  if (formData.entryPrice <= 0 || formData.positionSize <= 0) {
    toast.error("Entry price and position size must be greater than 0");
    return;
  }

  // Calculate P&L if trade is closed
  let profitLoss = 0;
  let profitLossPercent = 0;

  if (formData.isClosed && formData.exitPrice) {
    if (formData.direction === 'buy') {
      profitLoss = (formData.exitPrice - formData.entryPrice) * formData.positionSize;
    } else {
      profitLoss = (formData.entryPrice - formData.exitPrice) * formData.positionSize;
    }

    // Apply fees
    profitLoss -= (formData.fees || 0);

    // Calculate percentage
    const riskAmount = Math.abs(formData.entryPrice - formData.stopLoss) * formData.positionSize;
    if (riskAmount > 0) {
      profitLossPercent = (profitLoss / riskAmount) * 100;
    }
  }

  // Insert trade
  const { error } = await supabase
    .from('trades')
    .insert({
      user_id: user.id,
      account_id: formData.accountId,
      currency_pair: formData.currencyPair,
      direction: formData.direction,
      entry_price: formData.entryPrice,
      entry_date: formData.entryDate,
      position_size: formData.positionSize,
      stop_loss: formData.stopLoss,
      take_profit: formData.takeProfit || null,
      exit_price: formData.exitPrice || null,
      exit_date: formData.exitDate || null,
      profit_loss: profitLoss,
      profit_loss_percentage: profitLossPercent,
      commission_fees: formData.fees || 0,
      status: formData.isClosed ? 'closed' : 'open',
      notes: formData.notes || null,
    });

  if (error) {
    toast.error("Failed to create trade");
    console.error(error);
    return;
  }

  toast.success("Trade logged!");
  onClose();
};
```

### 3. Close Open Trade

```typescript
const handleCloseTrade = async () => {
  if (!exitPrice) {
    toast.error("Please enter exit price");
    return;
  }

  // Calculate P&L
  let profitLoss = 0;
  if (trade.direction === 'buy') {
    profitLoss = (exitPrice - trade.entry_price) * trade.position_size;
  } else {
    profitLoss = (trade.entry_price - exitPrice) * trade.position_size;
  }

  // Apply fees
  profitLoss -= (trade.commission_fees || 0);

  // Calculate percentage
  const riskAmount = Math.abs(trade.entry_price - trade.stop_loss) * trade.position_size;
  const profitLossPercent = (profitLoss / riskAmount) * 100;

  // Update trade
  const { error } = await supabase
    .from('trades')
    .update({
      exit_price: exitPrice,
      exit_date: new Date().toISOString(),
      status: 'closed',
      profit_loss: profitLoss,
      profit_loss_percentage: profitLossPercent,
    })
    .eq('id', trade.id);

  if (error) {
    toast.error("Failed to close trade");
    return;
  }

  toast.success(`Trade closed with ${profitLoss > 0 ? 'profit' : 'loss'}!`);
  onClose();
};
```

### 4. View Trade Details

**File:** `src/components/TradeRow.tsx`

Displays each trade with:
```
Currency Pair: EUR/USD
Buy | Position: 1.0 lot | Entry: 1.08920 | Exit: 1.09000
P&L: +$80.00 (+10.2%)
Date: Jan 13, 2025 10:00 → Jan 13, 2025 14:30
Account: Live Account 1
```

### 5. Calculate Analytics

**File:** `src/components/JournalAnalytics.tsx`

```typescript
const calculateMetrics = (trades: Trade[]) => {
  const closedTrades = trades.filter(t => t.status === 'closed');
  const openTrades = trades.filter(t => t.status === 'open');

  const wins = closedTrades.filter(t => t.profit_loss > 0);
  const losses = closedTrades.filter(t => t.profit_loss < 0);
  const breakeven = closedTrades.filter(t => t.profit_loss === 0);

  const totalWins = wins.reduce((sum, t) => sum + t.profit_loss, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.profit_loss, 0));

  return {
    totalTrades: trades.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    winRate: closedTrades.length > 0 
      ? ((wins.length / closedTrades.length) * 100).toFixed(2)
      : '0.00',
    averageWin: wins.length > 0
      ? (totalWins / wins.length).toFixed(2)
      : '0.00',
    averageLoss: losses.length > 0
      ? (totalLosses / losses.length).toFixed(2)
      : '0.00',
    largestWin: wins.length > 0
      ? Math.max(...wins.map(t => t.profit_loss)).toFixed(2)
      : '0.00',
    largestLoss: losses.length > 0
      ? Math.min(...losses.map(t => t.profit_loss)).toFixed(2)
      : '0.00',
    profitFactor: totalLosses > 0
      ? (totalWins / totalLosses).toFixed(2)
      : totalWins > 0 ? '∞' : '0.00',
    totalProfit: (totalWins - totalLosses).toFixed(2),
    expectancy: closedTrades.length > 0
      ? (((totalWins - totalLosses) / closedTrades.length)).toFixed(2)
      : '0.00',
  };
};
```

## Trade Fields

| Field | Type | Required | Example |
|-------|------|----------|---------|
| currency_pair | text | ✅ | EUR/USD |
| direction | enum | ✅ | buy, sell |
| entry_price | numeric | ✅ | 1.08920 |
| entry_date | timestamp | ✅ | 2025-01-13T10:00:00Z |
| position_size | numeric | ✅ | 1.0 |
| stop_loss | numeric | ✅ | 1.08800 |
| take_profit | numeric | ❌ | 1.09100 |
| exit_price | numeric | ❌ | 1.09000 |
| exit_date | timestamp | ❌ | 2025-01-13T14:30:00Z |
| profit_loss | numeric | ❌ | 80.00 |
| profit_loss_percentage | numeric | ❌ | 10.2 |
| commission_fees | numeric | ❌ | 5.00 |
| notes | text | ❌ | Strong trend |
| status | enum | ✅ | open, closed |

## Key Metrics Explained

### Win Rate
```
Win Rate (%) = Wins / (Wins + Losses) × 100

Example:
10 wins, 15 losses
Win Rate = 10 / 25 × 100 = 40%
```

### Profit Factor
```
Profit Factor = Total Wins / Total Losses

Example:
Wins: $1,000
Losses: $500
Profit Factor = 1,000 / 500 = 2.0
(For every $1 lost, you made $2)
```

### Expectancy
```
Expectancy = Total Profit / Number of Trades

Example:
Total Profit: $500
Number of Trades: 20
Expectancy = $500 / 20 = $25 per trade (average)
```

### Risk/Reward Ratio (per trade)
```
RR Ratio = (Exit - Entry) / (Entry - SL)

BUY Example:
Entry: 1.08920
SL: 1.08800 (120 pips risk)
Exit: 1.09000 (80 pips gain)
RR = 80/120 = 0.67:1 (actually a loss, but less than risk)
```

## Realtime Updates

```typescript
// Subscribe to trades changes
const tradesChannel = supabase
  .channel('trades')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'trades',
      filter: `user_id=eq.${user.id}`,
    },
    (payload) => {
      const { eventType, new: newTrade } = payload;

      if (eventType === 'INSERT') {
        setTrades(prev => [newTrade, ...prev]);
      } else if (eventType === 'UPDATE') {
        setTrades(prev =>
          prev.map(t => t.id === newTrade.id ? newTrade : t)
        );
      }
    }
  )
  .subscribe();
```

## Error Handling

### Missing Required Fields
```
Toast: "Please fill in all required fields"
Form not submitted
```

### Invalid Price
```
Toast: "Entry price must be greater than 0"
Field highlighted
```

### Exit before Entry
```
Toast: "Exit date cannot be before entry date"
Date picker highlighted
```

### Database Error
```
Toast: "Failed to create trade"
Modal stays open for retry
```

## Related Files

- [src/pages/Journal.tsx](../../src/pages/Journal.tsx) - Journal page
- [src/components/PnLInputModal.tsx](../../src/components/PnLInputModal.tsx) - Add trade form
- [src/components/CloseTradeModal.tsx](../../src/components/CloseTradeModal.tsx) - Close trade form
- [src/components/JournalAnalytics.tsx](../../src/components/JournalAnalytics.tsx) - Analytics dashboard
- [src/components/TradeScreenshot.tsx](../../src/components/TradeScreenshot.tsx) - Screenshot upload

## Next: Account Performance

View account performance → [Account Performance Dashboard](./08_PERFORMANCE_DASHBOARD_FLOW.md)
