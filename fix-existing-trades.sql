-- Script to retroactively fix any existing closed signals that haven't updated taken_trades
-- This handles the scenario where a signal was closed but taken_trades weren't processed

-- First, let's see what we're dealing with
SELECT 
  ts.id as signal_id,
  ts.currency_pair,
  ts.status as signal_status,
  ts.result as signal_result,
  ts.closed_at,
  tt.id as taken_trade_id,
  tt.status as trade_status,
  tt.risk_amount,
  tt.user_id,
  tt.account_id,
  tt.journaled
FROM trading_signals ts
JOIN taken_trades tt ON tt.signal_id = ts.id
WHERE ts.status = 'closed' 
  AND tt.status = 'open'
  AND tt.journaled = false;

-- To manually fix a specific trade, you would run something like:
-- (Replace the IDs with actual values from above query)
/*
BEGIN;

-- 1. Update the taken_trade
UPDATE taken_trades 
SET 
  status = 'closed',
  result = 'loss',  -- or 'win' or 'breakeven' based on signal result
  pnl = -124.74,    -- negative of risk_amount for loss
  pnl_percent = -1.0,
  closed_at = NOW(),
  journaled = true
WHERE id = 'YOUR_TAKEN_TRADE_ID';

-- 2. Update account balance (for loss: don't add anything back, risk was already deducted)
-- For win: add back 2x risk, for breakeven: add back 1x risk
UPDATE trading_accounts
SET 
  current_balance = current_balance + 0,  -- 0 for loss, 2*risk_amount for win, risk_amount for BE
  updated_at = NOW()
WHERE id = 'YOUR_ACCOUNT_ID';

-- 3. Create journal entry
INSERT INTO trading_journal (
  user_id,
  pair,
  direction,
  entry_price,
  exit_price,
  stop_loss,
  take_profit,
  risk_percent,
  pnl,
  pnl_percent,
  status,
  notes,
  entry_date
)
SELECT 
  tt.user_id,
  ts.currency_pair,
  CASE WHEN ts.direction = 'buy' THEN 'long' ELSE 'short' END,
  ts.entry_price,
  CASE 
    WHEN ts.result = 'win' THEN ts.take_profit_1
    WHEN ts.result = 'loss' THEN ts.stop_loss
    ELSE ts.entry_price
  END,
  ts.stop_loss,
  ts.take_profit_1,
  tt.risk_percent,
  tt.pnl,
  tt.pnl_percent,
  'closed',
  'Retroactively journaled: ' || ts.currency_pair || ' ' || UPPER(ts.direction) || ' - ' || UPPER(ts.result),
  tt.created_at
FROM taken_trades tt
JOIN trading_signals ts ON ts.id = tt.signal_id
WHERE tt.id = 'YOUR_TAKEN_TRADE_ID';

COMMIT;
*/
