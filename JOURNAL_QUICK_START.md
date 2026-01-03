# Quick Start Guide - New Journal Features

## 🎯 What's New?

### 1. Filter Button (Top Right)

- **Location:** Next to the All/Open/Closed buttons
- **Badge:** Red dot appears when filters are active
- **Action:** Tap to open advanced filters panel

### 2. Advanced Filters Panel

When opened, you'll see three dropdowns:

```
┌─────────────────────────────────┐
│ Filters              Clear All  │
├─────────────────────────────────┤
│ Trading Account                 │
│ [All Accounts ▼]                │
├─────────────────────────────────┤
│ Month                           │
│ [All Months ▼]                  │
├─────────────────────────────────┤
│ Year                            │
│ [All Years ▼]                   │
└─────────────────────────────────┘
```

### 3. Account Selection in Trade Form

When adding/editing a trade:

```
┌─────────────────────────────────┐
│ 💼 Trading Account (Optional)   │
│ [No Account ▼]                  │
│  - My MT5 Account               │
│  - Demo Account                 │
└─────────────────────────────────┘
```

### 4. Trade Cards Show Account

Each trade now displays its linked account:

```
┌─────────────────────────────────┐
│ 📈 EUR/USD          🗓️ Dec 3    │
│ Entry: 1.0850  SL: 1.0800      │
│ TP: 1.0950                      │
│ 💼 My MT5 Account               │ ← NEW!
│ Notes: Good setup...            │
└─────────────────────────────────┘
```

## 🚀 Common Use Cases

### See Performance for One Account

1. Tap Filter button
2. Select the account from dropdown
3. View trades and tap Analytics

### Check December Results

1. Tap Filter button
2. Select "Dec" from Month dropdown
3. View filtered stats

### Compare 2025 vs 2026

1. Select Year: 2025 → Check Analytics
2. Clear filters, select Year: 2026 → Check Analytics

### Find Trades Without Accounts

1. Tap Filter button
2. Keep "All Accounts" selected
3. Look for trades showing "No Account"
4. Edit them to assign an account

## 📊 How Stats Work Now

### Before (Old Behavior)

- All trades counted in P&L
- Deleted account trades still included
- No way to filter by account

### After (New Behavior)

- Filters apply to stats and analytics
- "No Account" trades visible but can be filtered
- P&L accurate for selected filters

## ⚠️ Important Notes

### Existing Trades

- Will show as "No Account" until you edit them
- Still counted in "All Accounts" view
- Not deleted when account is removed

### Deleted Accounts

- Trades remain in journal
- Show as "No Account"
- Can be:
  - Kept for history
  - Reassigned to another account
  - Manually deleted

## 🔧 Setup Required

### 1. Run Database Migration

In Supabase SQL Editor, run:

```sql
-- Content from add_account_to_journal.sql
ALTER TABLE trading_journal
ADD COLUMN account_id UUID REFERENCES trading_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trading_journal_account_id ON trading_journal(account_id);
CREATE INDEX IF NOT EXISTS idx_trading_journal_entry_date ON trading_journal(entry_date);
```

### 2. (Optional) Link Old Trades

If you want to assign existing trades to your main account:

```sql
UPDATE trading_journal
SET account_id = '<your-account-id>'
WHERE account_id IS NULL AND user_id = '<your-user-id>';
```

Replace `<your-account-id>` and `<your-user-id>` with actual IDs from your database.

## 💡 Tips

1. **Monthly Reviews:** Use month filter to review each month's performance
2. **Account Comparison:** Filter by each account to compare strategies
3. **Clean Data:** Assign accounts to "No Account" trades for better tracking
4. **Yearly Reports:** Use year filter for tax season reporting

## 🎨 UI Elements

### Filter Active Indicator

```
┌───┐
│ 🔍 │ ← No active filters
└───┘

┌───┐
│ 🔍●│ ← Red dot = filters active
└───┘
```

### Account Display

```
💼 Account Name  ← Trade is linked to account
                 ← No icon = No account assigned
```

## 📱 Mobile-Friendly

- All dropdowns work on mobile
- Filter panel slides up smoothly
- Touch-friendly interface
- Filters persist until cleared

---

**Need Help?** Check JOURNAL_IMPROVEMENTS.md for detailed technical information.
