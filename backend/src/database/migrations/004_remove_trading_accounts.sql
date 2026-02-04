-- Remove trading_accounts feature (placeholder/demo accounts)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'trading_journal_account_id_fkey'
    ) THEN
        ALTER TABLE trading_journal DROP CONSTRAINT trading_journal_account_id_fkey;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_trading_journal_account_id;

ALTER TABLE trading_journal
    DROP COLUMN IF EXISTS account_id;

DROP TRIGGER IF EXISTS update_trading_accounts_updated_at ON trading_accounts;
DROP TABLE IF EXISTS trading_accounts;
