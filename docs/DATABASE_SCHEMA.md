# Database Schema Documentation

**Project**: Poscal Trading Platform  
**Database**: PostgreSQL 15+  
**Generated**: January 23, 2026  
**Schema Version**: 1.0

---

## Overview

The Poscal database consists of 14 tables organized into several functional areas:
- **User Management**: profiles, user_roles
- **Trading**: trading_accounts, trading_signals, taken_trades, trading_journal
- **Payments**: payments, paystack_webhook_logs
- **Notifications**: push_subscriptions, push_notification_queue, email_queue
- **System**: price_cache, app_settings, app_updates

---

## Tables

### 1. profiles
User profile information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | User ID (matches auth system) |
| email | VARCHAR(255) | | User email address |
| full_name | VARCHAR(255) | | User's full name |
| avatar_url | TEXT | | Profile picture URL |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Account creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_profiles_email` on email
- `idx_profiles_created_at` on created_at

---

### 2. user_roles
Role-based access control.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Role assignment ID |
| user_id | UUID | NOT NULL | User ID |
| role | app_role | NOT NULL | Role (admin, moderator, user) |

**Enums:**
- `app_role`: 'admin', 'moderator', 'user'

**Indexes:**
- `idx_user_roles_user_id` on user_id
- `idx_user_roles_role` on role
- UNIQUE constraint on (user_id, role)

---

### 3. trading_accounts
User trading accounts with balance tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Account ID |
| user_id | UUID | NOT NULL | Owner user ID |
| account_name | VARCHAR(255) | NOT NULL | Account display name |
| platform | VARCHAR(100) | NOT NULL | Trading platform (e.g., MT4, MT5) |
| initial_balance | DECIMAL(15,2) | NOT NULL | Starting balance |
| current_balance | DECIMAL(15,2) | NOT NULL | Current balance |
| currency | VARCHAR(10) | DEFAULT 'USD' | Account currency |
| is_active | BOOLEAN | DEFAULT true | Account status |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_trading_accounts_user_id` on user_id
- `idx_trading_accounts_is_active` on is_active
- `idx_trading_accounts_created_at` on created_at

**Business Rules:**
- Free tier: Max 1 account
- Pro tier: Max 5 accounts
- Premium tier: Unlimited accounts

---

### 4. trading_signals
Admin-created trading signals for subscribers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Signal ID |
| currency_pair | VARCHAR(20) | NOT NULL | Trading pair (e.g., EUR/USD) |
| direction | VARCHAR(10) | NOT NULL, CHECK | Trade direction (buy/sell) |
| entry_price | DECIMAL(10,5) | NOT NULL | Entry price level |
| stop_loss | DECIMAL(10,5) | NOT NULL | Stop loss price |
| take_profit_1 | DECIMAL(10,5) | NOT NULL | First take profit target |
| take_profit_2 | DECIMAL(10,5) | | Second take profit target |
| take_profit_3 | DECIMAL(10,5) | | Third take profit target |
| pips_to_sl | DECIMAL(10,2) | NOT NULL | Pips to stop loss |
| pips_to_tp1 | DECIMAL(10,2) | NOT NULL | Pips to TP1 |
| pips_to_tp2 | DECIMAL(10,2) | | Pips to TP2 |
| pips_to_tp3 | DECIMAL(10,2) | | Pips to TP3 |
| status | VARCHAR(20) | DEFAULT 'active' | Signal status |
| result | VARCHAR(20) | | Final outcome (win/loss/breakeven) |
| tp1_hit | BOOLEAN | DEFAULT false | TP1 reached flag |
| tp2_hit | BOOLEAN | DEFAULT false | TP2 reached flag |
| tp3_hit | BOOLEAN | DEFAULT false | TP3 reached flag |
| notes | TEXT | | Signal analysis notes |
| chart_image_url | TEXT | | Chart screenshot URL |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Signal creation time |
| closed_at | TIMESTAMP WITH TIME ZONE | | Signal close time |

**Indexes:**
- `idx_trading_signals_status` on status
- `idx_trading_signals_currency_pair` on currency_pair
- `idx_trading_signals_created_at` on created_at DESC

**Valid Values:**
- direction: 'buy', 'sell'
- status: 'active', 'closed', 'cancelled'
- result: 'win', 'loss', 'breakeven', NULL

---

### 5. taken_trades
User trades based on signals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Taken trade ID |
| user_id | UUID | NOT NULL | User who took the signal |
| account_id | UUID | NOT NULL | Trading account used |
| signal_id | UUID | NOT NULL | Original signal ID |
| risk_percent | DECIMAL(5,2) | NOT NULL | Risk as % of balance |
| risk_amount | DECIMAL(15,2) | NOT NULL | Risk in currency |
| status | VARCHAR(20) | DEFAULT 'open' | Trade status |
| result | VARCHAR(20) | | Trade outcome |
| pnl | DECIMAL(15,2) | | Profit/loss amount |
| pnl_percent | DECIMAL(10,2) | | P&L as percentage |
| journaled | BOOLEAN | DEFAULT false | Added to journal flag |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Trade open time |
| closed_at | TIMESTAMP WITH TIME ZONE | | Trade close time |

**Indexes:**
- `idx_taken_trades_user_id` on user_id
- `idx_taken_trades_account_id` on account_id
- `idx_taken_trades_signal_id` on signal_id
- `idx_taken_trades_status` on status
- `idx_taken_trades_account_status` on (account_id, status)

---

### 6. trading_journal
User manual trading journal entries.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Journal entry ID |
| user_id | UUID | NOT NULL | Journal owner |
| account_id | UUID | | Associated account |
| pair | VARCHAR(20) | NOT NULL | Currency pair |
| direction | VARCHAR(10) | NOT NULL, CHECK | Trade direction |
| entry_price | DECIMAL(10,5) | | Entry price |
| exit_price | DECIMAL(10,5) | | Exit price |
| stop_loss | DECIMAL(10,5) | | Stop loss level |
| take_profit | DECIMAL(10,5) | | Take profit level |
| position_size | DECIMAL(15,4) | | Position size in lots |
| risk_percent | DECIMAL(5,2) | | Risk percentage |
| pnl | DECIMAL(15,2) | | Profit/loss |
| pnl_percent | DECIMAL(10,2) | | P&L percentage |
| status | VARCHAR(20) | DEFAULT 'open' | Trade status |
| notes | TEXT | | Trade notes/analysis |
| entry_date | TIMESTAMP WITH TIME ZONE | | Entry timestamp |
| exit_date | TIMESTAMP WITH TIME ZONE | | Exit timestamp |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_trading_journal_user_id` on user_id
- `idx_trading_journal_account_id` on account_id
- `idx_trading_journal_status` on status
- `idx_trading_journal_pair` on pair
- `idx_trading_journal_created_at` on created_at DESC
- `idx_trading_journal_entry_date` on entry_date DESC

---

### 7. payments
Payment and subscription records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Payment ID |
| user_id | UUID | NOT NULL | User ID |
| amount | DECIMAL(15,2) | | Payment amount |
| currency | VARCHAR(10) | DEFAULT 'NGN' | Payment currency |
| tier | VARCHAR(50) | | Legacy tier field |
| subscription_tier | VARCHAR(50) | | Subscription level |
| status | VARCHAR(20) | DEFAULT 'pending' | Payment status |
| payment_method | VARCHAR(50) | | Payment method used |
| paystack_reference | VARCHAR(255) | UNIQUE | Paystack reference |
| paystack_transaction_id | VARCHAR(255) | | Paystack transaction ID |
| paystack_access_code | VARCHAR(255) | | Paystack access code |
| paystack_customer_code | VARCHAR(255) | | Paystack customer code |
| subscription_start | TIMESTAMP WITH TIME ZONE | | Subscription start date |
| subscription_end | TIMESTAMP WITH TIME ZONE | | Subscription expiry date |
| subscription_duration | INTEGER | | Duration in days |
| metadata | JSONB | | Additional data |
| ip_address | VARCHAR(50) | | User IP address |
| user_agent | TEXT | | User agent string |
| paid_at | TIMESTAMP WITH TIME ZONE | | Payment completion time |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_payments_user_id` on user_id
- `idx_payments_status` on status
- `idx_payments_paystack_reference` on paystack_reference
- `idx_payments_subscription_tier` on subscription_tier
- `idx_payments_created_at` on created_at DESC
- `idx_payments_paystack_reference_unique` UNIQUE on paystack_reference

**Valid Status Values:**
- 'pending', 'success', 'failed', 'cancelled'

---

### 8. paystack_webhook_logs
Paystack webhook event logs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Log entry ID |
| event_type | VARCHAR(100) | | Webhook event type |
| paystack_reference | VARCHAR(255) | | Payment reference |
| payload | JSONB | | Full webhook payload |
| processed | BOOLEAN | DEFAULT false | Processing status |
| error_message | TEXT | | Error details if failed |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Webhook received time |

**Indexes:**
- `idx_paystack_webhook_logs_event_type` on event_type
- `idx_paystack_webhook_logs_reference` on paystack_reference
- `idx_paystack_webhook_logs_processed` on processed
- `idx_paystack_webhook_logs_created_at` on created_at DESC

---

### 9. price_cache
Cached forex price data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Cache entry ID |
| symbol | VARCHAR(20) | NOT NULL, UNIQUE | Currency pair symbol |
| bid_price | DECIMAL(10,5) | | Bid price |
| ask_price | DECIMAL(10,5) | | Ask price |
| mid_price | DECIMAL(10,5) | | Mid price |
| timestamp | BIGINT | | Unix timestamp |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_price_cache_symbol` on symbol
- `idx_price_cache_updated_at` on updated_at DESC

**Update Frequency:**
- Updated every 30 seconds by scheduled task

---

### 10. push_subscriptions
Push notification subscriptions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Subscription ID |
| user_id | UUID | | User ID |
| endpoint | TEXT | NOT NULL, UNIQUE | Push endpoint URL |
| p256dh | TEXT | NOT NULL | Public key |
| auth | TEXT | NOT NULL | Auth secret |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Subscription created |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update |

**Indexes:**
- `idx_push_subscriptions_user_id` on user_id
- `idx_push_subscriptions_endpoint` on endpoint

---

### 11. push_notification_queue
Queued push notifications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Notification ID |
| user_id | UUID | NOT NULL | Target user |
| title | VARCHAR(255) | NOT NULL | Notification title |
| body | TEXT | NOT NULL | Notification message |
| tag | VARCHAR(100) | | Notification tag |
| data | JSONB | | Additional data |
| status | VARCHAR(20) | DEFAULT 'pending' | Send status |
| processed_at | TIMESTAMP WITH TIME ZONE | | Processing timestamp |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_push_notification_queue_user_id` on user_id
- `idx_push_notification_queue_status` on status
- `idx_push_notification_queue_created_at` on created_at DESC

**Valid Status Values:**
- 'pending', 'sent', 'failed'

---

### 12. email_queue
Queued email notifications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Email ID |
| user_id | UUID | NOT NULL | Target user |
| email | VARCHAR(255) | NOT NULL | Email address |
| name | VARCHAR(255) | | Recipient name |
| email_type | VARCHAR(50) | NOT NULL | Email template type |
| status | VARCHAR(20) | DEFAULT 'pending' | Send status |
| attempts | INTEGER | DEFAULT 0 | Send attempts |
| max_attempts | INTEGER | DEFAULT 3 | Max retry attempts |
| error_message | TEXT | | Error details |
| sent_at | TIMESTAMP WITH TIME ZONE | | Send timestamp |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_email_queue_user_id` on user_id
- `idx_email_queue_email` on email
- `idx_email_queue_status` on status
- `idx_email_queue_created_at` on created_at DESC

**Email Types:**
- 'welcome', 'verification', 'payment_confirmation', 'signal_alert', 'reminder'

---

### 13. app_settings
Application configuration settings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| key | VARCHAR(100) | PRIMARY KEY | Setting key |
| value | JSONB | | Setting value |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update |

**Default Settings:**
```json
{
  "maintenance_mode": false,
  "max_free_accounts": 1,
  "max_pro_accounts": 5,
  "max_premium_accounts": 999
}
```

---

### 14. app_updates
App update announcements.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Update ID |
| title | VARCHAR(255) | NOT NULL | Update title |
| description | TEXT | NOT NULL | Update description |
| is_active | BOOLEAN | DEFAULT true | Visibility status |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_app_updates_is_active` on is_active
- `idx_app_updates_created_at` on created_at DESC

---

## Functions

### has_role(_user_id UUID, _role app_role) → BOOLEAN
Check if a user has a specific role.

### is_admin(_user_id UUID) → BOOLEAN
Check if a user is an administrator.

### get_all_users_admin() → TABLE
Get all users with their roles and status (admin only).

**Returns:**
- id, email, created_at, last_sign_in_at, is_admin, is_banned

### delete_user_admin(target_user_id UUID) → VOID
Delete a user and all associated data (admin only).

**Cascade Delete Order:**
1. push_notification_queue
2. email_queue
3. push_subscriptions
4. taken_trades
5. trading_journal
6. trading_accounts
7. payments
8. user_roles
9. profiles

### toggle_user_ban(target_user_id UUID, ban_status BOOLEAN) → VOID
Toggle user ban status (admin only).

---

## Triggers

### update_updated_at_column()
Automatically updates the `updated_at` column on row updates.

**Applied to:**
- profiles
- trading_accounts
- trading_journal
- payments
- price_cache
- push_subscriptions
- app_settings

---

## Relationships

While foreign key constraints are not explicitly defined (for flexibility with NestJS), the logical relationships are:

```
profiles (1) ─── (N) user_roles
profiles (1) ─── (N) trading_accounts
profiles (1) ─── (N) trading_journal
profiles (1) ─── (N) payments
profiles (1) ─── (N) taken_trades
profiles (1) ─── (N) push_subscriptions
profiles (1) ─── (N) push_notification_queue
profiles (1) ─── (N) email_queue

trading_accounts (1) ─── (N) trading_journal
trading_accounts (1) ─── (N) taken_trades

trading_signals (1) ─── (N) taken_trades
```

---

## Security Considerations

### NestJS Implementation
Since this schema is used with NestJS (not Supabase RLS):
- Authentication handled by JWT tokens
- Authorization implemented in NestJS Guards
- Row-level security enforced in service layer
- User ID extracted from JWT payload

### Data Access Rules
1. **Users**: Can only access their own data
2. **Admins**: Can access all data
3. **Public Data**: trading_signals (read-only for authenticated users)

---

## Migration Notes

### From Supabase
This schema was migrated from Supabase. Key differences:
- Removed `auth.uid()` references (replaced with NestJS auth)
- Removed RLS policies (handled by application layer)
- Kept all table structures and indexes
- Simplified functions to work without Supabase auth

### Running the Migration
```bash
# Connect to PostgreSQL
psql -U poscal_user -d poscal_db

# Run migration
\i backend/src/database/migrations/001_initial_schema.sql

# Verify tables
\dt
```

---

## Performance Optimization

### Indexes
All tables have appropriate indexes for:
- Primary keys (automatic)
- Foreign key lookups
- Common query patterns
- Sorting and filtering

### Partitioning Considerations
For high-volume tables in production:
- `trading_journal`: Partition by entry_date (yearly)
- `payments`: Partition by created_at (yearly)
- `paystack_webhook_logs`: Partition by created_at (monthly)

### Maintenance
```sql
-- Analyze tables for query optimization
ANALYZE;

-- Vacuum to reclaim space
VACUUM ANALYZE;

-- Reindex if needed
REINDEX DATABASE poscal_db;
```

---

## Backup Strategy

### Recommended Schedule
- **Daily**: Full database backup
- **Hourly**: Incremental backup (if using WAL archiving)
- **Retention**: 30 days

### Backup Command
```bash
pg_dump -U poscal_user -d poscal_db -F c -f poscal_backup_$(date +%Y%m%d_%H%M%S).dump
```

### Restore Command
```bash
pg_restore -U poscal_user -d poscal_db -c poscal_backup.dump
```

---

## Monitoring

### Key Metrics to Track
1. **Table sizes**: Monitor growth
2. **Index usage**: Identify unused indexes
3. **Slow queries**: Optimize with EXPLAIN ANALYZE
4. **Connection pool**: Monitor active connections
5. **Cache hit ratio**: Tune shared_buffers if needed

### Useful Queries
```sql
-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-01-23 | Initial schema migration from Supabase |

---

## Next Steps

1. ✅ Schema created
2. ⏳ Deploy to Contabo VPS (Phase 3.2)
3. ⏳ Create TypeORM entities (Phase 3.3)
4. ⏳ Test migrations
5. ⏳ Seed test data

---

## Support

For schema-related questions or issues:
1. Check this documentation
2. Review TypeORM entity definitions
3. Check migration logs
4. Consult development team
