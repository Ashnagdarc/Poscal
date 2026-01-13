# Secure MT5 Integration with Advanced Metrics & Testing (No Edge Functions)

This document outlines a production-standard plan to integrate real MT5 accounts into PosCal with strong security, comprehensive metrics, and a safe demo-to-live progression. Architecture avoids Supabase Edge Functions; use a dedicated backend service (e.g., Node/Express or Go) running in your infrastructure.

## 1) Objectives
- Let users connect real MT5 accounts (plus demo) and sync trades automatically.
- Preserve data isolation, integrity, and credential security.
- Provide richer analytics (streaks, drawdown, Sharpe, calendar breakdowns).
- Enable demo validation before live sync; prevent duplicate trades.

## 2) High-Level Architecture (No Edge Functions)
```
MT5 Broker API/Webhooks (per broker)
        ↓
Broker Adapter Service (Node/Go, runs in your infra)
  - Authenticates to broker APIs
  - Pulls trades & balances on schedule or via webhooks
  - Normalizes payloads → PosCal format
  - Writes directly to Supabase Postgres via service key
        ↓
Supabase Postgres
  - Tables: mt5_connections, mt5_credentials, mt5_security_audit
  - Existing: trading_accounts, trading_journal, taken_trades
        ↓
PosCal Frontend (React/TS)
  - Connection wizard (demo/live)
  - Sync controls & status
  - Metrics dashboards
```

## 3) Security Measures (Credentials & Transport)
- **Encryption at rest:** Use `pgcrypto` AES-256; store only encrypted blobs.
- **Key handling:** Derive per-user data keys; wrap with a service-level KMS key (or env-managed key). Never store raw broker creds unencrypted.
- **Transport:** All broker calls and frontend/backend calls over TLS 1.2+; enable HSTS.
- **RLS:** Enforce owner-only access on mt5 tables; block cross-user visibility.
- **Audit:** Log every sync attempt, success/failure, IP, and user agent; rate-limit sync per user.
- **Secrets posture:** Service key stays only in backend service; frontend uses anon key.
- **Rotation:** Prompt users every 60–90 days; force rotation on suspicious activity.

## 4) Database Additions (SQL Sketch)
```sql
-- Enable pgcrypto if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE mt5_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  broker TEXT NOT NULL,                -- e.g., oanda, ibkr, other
  connection_type TEXT NOT NULL,       -- demo | live
  account_number TEXT NOT NULL,
  account_label TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'idle', -- idle | syncing | error
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, broker, account_number, connection_type)
);

CREATE TABLE mt5_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES mt5_connections ON DELETE CASCADE,
  enc_credentials BYTEA NOT NULL,      -- AES-256 ciphertext
  nonce BYTEA NOT NULL,                -- for AES-GCM
  created_at TIMESTAMPTZ DEFAULT now(),
  last_rotated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mt5_security_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES mt5_connections ON DELETE CASCADE,
  last_ip INET,
  last_user_agent TEXT,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  monthly_sync_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Idempotency on journal entries
ALTER TABLE trading_journal ADD COLUMN IF NOT EXISTS mt5_trade_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_trading_journal_mt5_trade_id ON trading_journal(mt5_trade_id) WHERE mt5_trade_id IS NOT NULL;
```

### RLS (conceptual)
- `mt5_connections`: `user_id = auth.uid()` for SELECT/UPDATE/DELETE/INSERT.
- `mt5_credentials` and `mt5_security_audit`: access only via FK to connections owned by `auth.uid()`.

## 5) Broker Adapter System
- Location: `src/integrations/brokers/`.
- Interface shape:
```ts
export interface BrokerAdapter {
  name: string; // 'oanda' | 'ibkr' | 'other'
  authenticate(creds: BrokerCredentials): Promise<AuthSession>;
  fetchAccount(session: AuthSession): Promise<AccountSnapshot>;
  fetchClosedTrades(session: AuthSession, since?: string): Promise<Trade[]>;
  fetchOpenTrades(session: AuthSession): Promise<Trade[]>;
}
```
- Implement per broker (start with one: OANDA or IBKR) to keep scope tight.

## 6) Sync Service (Backend, Not Edge Functions)
- **Mode:** Scheduled pulls (cron/queue) plus optional broker webhooks where available.
- **Flow:**
  1) Load connections due for sync; decrypt creds.
  2) Authenticate via adapter; fetch balances, open/closed trades.
  3) Normalize to PosCal trade shape; compute idempotency key `mt5_trade_id`.
  4) Upsert trading_journal; update trading_accounts current_balance.
  5) Record audit row; backoff on failures; alert on repeated failures.
- **Duplicate protection:** `ON CONFLICT (mt5_trade_id) DO NOTHING` for journal inserts.
- **Timezone handling:** Convert broker timestamps → UTC on ingest; frontend renders in user TZ.

## 7) Metrics Enhancements (Frontend)
- **Add:**
  - Win/loss streaks.
  - Max drawdown and recovery time.
  - Sharpe ratio (daily returns, risk-free ~0 for FX short horizon).
  - Trade duration distribution.
  - Daily/weekly PnL calendar heatmap.
  - Per-broker and per-account breakdowns.
- **Data source:** Derived client-side from journal data; consider precomputing heavy stats server-side if volume grows.

## 8) MT5 Connection UI (No Edge Functions)
- **Wizard steps:**
  1) Select broker.
  2) Choose demo or live.
  3) Enter credentials (API key/login + server as required); never log these.
  4) Verify connection (backend attempts lightweight auth).
  5) Show preview of accounts found; user picks one.
  6) Confirm and trigger initial sync.
- **UX safeguards:**
  - Redact secrets in UI and logs.
  - Explicit toggle to enable live sync after a successful demo run.
  - Display last sync time, status, and recent errors.

## 9) Demo-to-Live Testing Flow
- Demo connections are stored with `connection_type = 'demo'` and tagged in UI.
- Sync demo first; compare imported trades to expected results.
- Require a successful demo sync before enabling a live connection for the same broker/account.
- Keep demo data segregated (filter by connection_type in queries and charts).

## 10) Testing Strategy
- **Unit:** Adapter auth/parsing; encryption/decryption helpers; timezone normalization.
- **Integration:** Full sync against a demo MT5 account per broker; assert journal upserts and balance updates; idempotency on replays.
- **Load:** Simulate high trade counts to validate batching and backoff.
- **Security:** Attempt invalid creds, replayed requests, and rate-limit breaches; verify audit logging and lockouts.
- **UAT:** Run end-to-end with demo, then a small live account before broad release.

## 11) Rollout & Ops
- Start with one broker; add others behind feature flags.
- Observability: structured logs, metrics (sync durations, failures), alerts on >3 consecutive failures per connection.
- Key rotation reminders every 60–90 days; force rotation on risk signals.
- Backups: ensure WAL archiving and tested restores; encrypt backups.

## 12) Risk & Mitigations
- **Credential compromise:** Strong encryption, minimal blast radius, rotation.
- **Duplicate trades:** Idempotency key on `mt5_trade_id`.
- **Clock skew:** Normalize to UTC; store broker server time for audits.
- **API limits:** Per-adapter rate limiting and batching; staggered cron windows.
- **Broker heterogeneity:** Adapter pattern with contract tests; schema mapped per broker.

## 13) Immediate Next Steps
1) Enable `pgcrypto`; create the three new tables and RLS policies.
2) Implement one broker adapter (recommend OANDA or IBKR) and the sync service job (cron/queue) running off-infra, not Edge.
3) Build the frontend connection wizard with demo/live gating and status views.
4) Add idempotent upsert for journal entries with `mt5_trade_id`; expose new metrics in dashboards.
