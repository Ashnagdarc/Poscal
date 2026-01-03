-- Add account_id column to trading_journal table
-- This links trades to specific trading accounts

ALTER TABLE trading_journal 
ADD COLUMN account_id UUID REFERENCES trading_accounts(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_trading_journal_account_id ON trading_journal(account_id);

-- Add index for date-based filtering
CREATE INDEX IF NOT EXISTS idx_trading_journal_entry_date ON trading_journal(entry_date);
CREATE INDEX IF NOT EXISTS idx_trading_journal_created_at ON trading_journal(created_at);

-- Note: Existing trades will have NULL account_id
-- You may want to set a default account for existing trades:
-- UPDATE trading_journal 
-- SET account_id = (
--   SELECT id FROM trading_accounts 
--   WHERE user_id = trading_journal.user_id 
--   ORDER BY created_at ASC 
--   LIMIT 1
-- )
-- WHERE account_id IS NULL;
