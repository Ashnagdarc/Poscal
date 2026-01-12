-- Enable RLS on trading_accounts table
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own trading accounts
CREATE POLICY "Users can view own trading accounts"
ON trading_accounts
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can create their own trading accounts
CREATE POLICY "Users can create own trading accounts"
ON trading_accounts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own trading accounts
CREATE POLICY "Users can update own trading accounts"
ON trading_accounts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own trading accounts if they have no active trades
CREATE POLICY "Users can delete own trading accounts without active trades"
ON trading_accounts
FOR DELETE
USING (
  auth.uid() = user_id 
  AND NOT EXISTS (
    SELECT 1 
    FROM taken_trades 
    WHERE taken_trades.account_id = trading_accounts.id 
    AND taken_trades.status = 'open'
  )
);

-- Add index for performance on account queries
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON trading_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_is_active ON trading_accounts(is_active);

-- Add index for taken_trades to speed up the delete policy check
CREATE INDEX IF NOT EXISTS idx_taken_trades_account_status ON taken_trades(account_id, status);
