-- Enable and enforce row-level security for trading_journal and taken_trades

-- trading_journal RLS
ALTER TABLE trading_journal ENABLE ROW LEVEL SECURITY;

-- Select: only owner can read
CREATE POLICY "Users can view own journal entries"
ON trading_journal
FOR SELECT
USING (auth.uid() = user_id);

-- Insert: enforce ownership and account ownership
CREATE POLICY "Users can insert own journal entries"
ON trading_journal
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM trading_accounts ta
      WHERE ta.id = account_id AND ta.user_id = auth.uid()
    )
  )
);

-- Update: enforce ownership and account ownership
CREATE POLICY "Users can update own journal entries"
ON trading_journal
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM trading_accounts ta
      WHERE ta.id = account_id AND ta.user_id = auth.uid()
    )
  )
);

-- Delete: only owner
CREATE POLICY "Users can delete own journal entries"
ON trading_journal
FOR DELETE
USING (auth.uid() = user_id);

-- taken_trades RLS
ALTER TABLE taken_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own taken trades"
ON taken_trades
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own taken trades"
ON taken_trades
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM trading_accounts ta
      WHERE ta.id = account_id AND ta.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update own taken trades"
ON taken_trades
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM trading_accounts ta
      WHERE ta.id = account_id AND ta.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete own taken trades"
ON taken_trades
FOR DELETE
USING (auth.uid() = user_id);

-- Supporting indexes for common filters
CREATE INDEX IF NOT EXISTS idx_trading_journal_user_created_at
  ON trading_journal(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trading_journal_user_account
  ON trading_journal(user_id, account_id);

CREATE INDEX IF NOT EXISTS idx_taken_trades_user_created_at
  ON taken_trades(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_taken_trades_user_account_status
  ON taken_trades(user_id, account_id, status);