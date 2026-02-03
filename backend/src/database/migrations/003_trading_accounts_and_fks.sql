-- Create trading_accounts and add missing FK for trading_journal.account_id

CREATE TABLE IF NOT EXISTS trading_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    platform VARCHAR(100) NOT NULL,
    initial_balance DECIMAL(15, 2) NOT NULL,
    current_balance DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON trading_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_is_active ON trading_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_created_at ON trading_accounts(created_at);

DROP TRIGGER IF EXISTS update_trading_accounts_updated_at ON trading_accounts;
CREATE TRIGGER update_trading_accounts_updated_at BEFORE UPDATE ON trading_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE trading_accounts IS 'User trading accounts with balance tracking';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'trading_accounts_user_id_fkey'
    ) THEN
        ALTER TABLE trading_accounts
            ADD CONSTRAINT trading_accounts_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'trading_journal_account_id_fkey'
    ) THEN
        ALTER TABLE trading_journal
            ADD CONSTRAINT trading_journal_account_id_fkey
            FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE SET NULL;
    END IF;
END$$;
