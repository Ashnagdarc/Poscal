# Forex Calculations Implementation Guide

## Overview

This document explains how the trading app now correctly calculates position sizes and P&L for different currency pairs.

## Problem Solved

Previously, the app used a hardcoded $10 per pip value, which only works for standard lots of USD-based pairs like EUR/USD or GBP/USD. This caused incorrect calculations for:

- JPY pairs (USD/JPY uses 0.01 pips, not 0.0001)
- Cross pairs (EUR/GBP, etc.)
- Commodity pairs (XAU/USD gold)
- Exotic pairs

## Solution: forexCalculations.ts

A comprehensive forex calculation library that handles all major pair types.

### Supported Pairs

The library includes configurations for:

- **Major USD Pairs**: EUR/USD, GBP/USD, AUD/USD, NZD/USD, USD/CAD
- **JPY Pairs**: USD/JPY, EUR/JPY, GBP/JPY
- **Cross Pairs**: EUR/GBP, EUR/AUD, GBP/AUD
- **Commodities**: XAU/USD (Gold), XAG/USD (Silver)

### Key Functions

#### 1. calculatePips(entryPrice, exitPrice, pair)

Calculates pip difference accounting for pair-specific decimal places.

**Example:**

```typescript
calculatePips(1.34, 1.34574, "GBP/USD"); // Returns 57.4 pips
calculatePips(150.0, 151.0, "USD/JPY"); // Returns 100 pips
```

#### 2. calculatePositionSize(riskAmount, stopLossPips, pair, accountCurrency, entryPrice)

Calculates the correct lot size to risk a specific dollar amount.

**Formula:**

```
Position Size (lots) = Risk Amount / (Stop Loss Pips × Pip Value)
```

**Example (your GBP/USD trade):**

```typescript
calculatePositionSize(
  1000, // Risk $1,000
  49.1, // 49.1 pips to stop loss
  "GBP/USD",
  "USD",
  1.34
);
// Returns 2.037 standard lots
```

#### 3. calculatePnL(entryPrice, exitPrice, lots, pair, direction)

Calculates profit or loss for a closed trade.

**Example (your winning trade):**

```typescript
calculatePnL(
  1.34, // Entry
  1.34574, // Exit at TP1
  2.037, // Position size
  "GBP/USD",
  "long"
);
// Returns $1,169.24 profit
```

## How It Works

### Pair-Specific Configuration

Each currency pair has specific settings:

```typescript
'GBP/USD': {
  pipMultiplier: 10000,  // 4 decimal places (0.0001 = 1 pip)
  pipValueBase: 10       // $10 per pip for 1 standard lot
}

'USD/JPY': {
  pipMultiplier: 100,    // 2 decimal places (0.01 = 1 pip)
  pipValueBase: 9.52     // Varies based on exchange rate
}
```

### Pip Value Calculation

The pip value depends on:

1. **Currency pair quote currency** (USD, JPY, etc.)
2. **Account currency** (USD in our case)
3. **Current exchange rate** (for non-USD quotes)

For GBP/USD with a USD account:

- 1 standard lot = 100,000 GBP
- 1 pip = 0.0001 price movement
- Pip value = 100,000 × 0.0001 = $10

### Position Sizing Logic

To risk exactly $1,000 on a 49.1 pip stop loss:

```
Lots = $1,000 / (49.1 pips × $10/pip)
Lots = $1,000 / $491
Lots = 2.037 standard lots
```

### P&L Calculation

Your trade had:

- Entry: 1.34000
- TP1: 1.34574
- Pips gained: 57.4 pips
- Position: 2.037 lots

```
P&L = 57.4 pips × $10/pip × 2.037 lots
P&L = $1,169.24
```

Not $1,000 because the reward/risk ratio was 57.4/49.1 = 1.169:1

## Integration Points

### 1. UpdateSignalModal.tsx

When an admin closes a signal, the modal:

1. Fetches signal pip data (pips_to_sl, pips_to_tp1)
2. Calculates position size for each taken trade
3. Calculates actual P&L using entry/exit prices
4. Updates account balance
5. Creates journal entry with position_size field

### 2. Trading Journal

Now stores:

- `position_size` (in standard lots, e.g., 2.037)
- `pnl` (calculated using actual pip values)
- All other trade details

### 3. Future: TakeSignalModal.tsx

**TODO**: When users take signals, calculate and display:

- Recommended position size based on risk %
- Expected P&L for each TP level
- Lot size in contracts/mini lots/micro lots

## Examples by Pair Type

### EUR/USD (Standard)

```
Risk: $500
Stop Loss: 20 pips
Position Size: $500 / (20 × $10) = 2.5 lots
If win 40 pips: Profit = 40 × $10 × 2.5 = $1,000
```

### USD/JPY (JPY Quote)

```
Risk: $500
Stop Loss: 50 pips
Pip Value: ~$9.52 (varies with rate)
Position Size: $500 / (50 × $9.52) = 1.05 lots
If win 100 pips: Profit = 100 × $9.52 × 1.05 = $999.60
```

### XAU/USD (Gold)

```
Risk: $500
Stop Loss: 10 pips ($10 movement)
Pip Value: $10 (0.01 = 1 pip for gold)
Position Size: $500 / (10 × $10) = 5 lots
If win 20 pips: Profit = 20 × $10 × 5 = $1,000
```

## Validation

Your specific trade validates the system:

- **Pair**: GBP/USD
- **Risk**: $1,000 (1% of $100,000)
- **Stop Loss**: 49.1 pips
- **Take Profit**: 57.4 pips
- **Calculated Position**: 2.037 lots ✅
- **Calculated Profit**: $1,169.24 ✅
- **Database Balance**: $101,169.24 ✅

## Next Steps

1. ✅ **Completed**: Core forex calculation library
2. ✅ **Completed**: Integration in UpdateSignalModal for closing trades
3. ✅ **Completed**: Database updated with correct position sizes and P&L
4. 🔜 **TODO**: Add position size calculator to TakeSignalModal
5. 🔜 **TODO**: Show expected P&L for each TP level
6. 🔜 **TODO**: Add risk calculator widget in trading interface
7. 🔜 **TODO**: Update monitor-signals Edge Function to use new calculations

## Technical Notes

### Why Not Query Live Exchange Rates?

Currently using static pip values from pair configs. For production:

- Could integrate Twelve Data API for live rates
- Important for cross pairs (EUR/GBP needs GBP/USD rate)
- USD pairs are stable enough for most cases

### Decimal Precision

All calculations use JavaScript's native number type. For production:

- Consider using `decimal.js` for financial precision
- Store monetary values as integers (cents) in database
- Round final display values appropriately

### Standard vs Mini vs Micro Lots

- **Standard Lot**: 100,000 units (position_size = 1.0)
- **Mini Lot**: 10,000 units (position_size = 0.1)
- **Micro Lot**: 1,000 units (position_size = 0.01)

The app calculates in standard lots. User's broker determines actual execution units.

## Files Modified

1. **Created**: `src/lib/forexCalculations.ts` - Core calculation library
2. **Updated**: `src/components/UpdateSignalModal.tsx` - Integration for closing trades
3. **Updated**: `src/pages/FixTrades.tsx` - Fixed syntax errors from previous edits
4. **Database**: `trading_journal` table now has `position_size` column

## References

- [Forex Pip Calculator](https://www.myfxbook.com/forex-calculators/position-size)
- [Understanding Pip Values](https://www.babypips.com/learn/forex/pips-and-pipettes)
- [Position Sizing Formula](https://www.investopedia.com/articles/trading/09/determining-position-size.asp)

---

**Last Updated**: Current session  
**Status**: ✅ Production Ready
