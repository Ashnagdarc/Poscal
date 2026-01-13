# Trading Account Creation Flow

## Overview
User creates trading accounts (Forex brokers, futures, etc.) and manages multiple accounts for trading.

## Flow Diagram
```
User logged in on Dashboard
    ↓
Navigates to /manage-accounts
    ↓
Page loads: ManageAccounts component
    ↓
Query Supabase for user's accounts
├─ SELECT * FROM trading_accounts
│  WHERE user_id = current_user.id
│
└─ Display:
   ├─ List of existing accounts
   ├─ Balances, leverage, etc.
   └─ "Add New Account" button
        ↓
    User clicks "Add New Account"
        ↓
    Show TradingAccountModal component
        ├─ Account name (e.g., "Live Account 1")
        ├─ Broker selection (e.g., "MT4", "MT5", "cTrader")
        ├─ Account number
        ├─ Account type:
        │  ├─ Demo
        │  └─ Live
        ├─ Starting balance
        ├─ Currency (EUR, USD, GBP, etc.)
        ├─ Leverage (1:10, 1:50, 1:100, 1:500)
        └─ Submit button
        ↓
    Client-side validation:
    ├─ All required fields filled
    ├─ Account name not empty
    ├─ Starting balance > 0
    ├─ Account number valid format
    └─ Leverage valid
        ↓
    INSERT into trading_accounts table
    Columns:
    ├─ id (UUID)
    ├─ user_id (from AuthContext)
    ├─ account_name
    ├─ broker_name
    ├─ account_number
    ├─ account_type (demo/live)
    ├─ starting_balance
    ├─ current_balance
    ├─ currency
    ├─ leverage
    ├─ created_at
    └─ updated_at
        ↓
    Account created successfully
        ↓
    Modal closes
        ↓
    List refreshes - shows new account
        ↓
    User can now:
    ├─ Create trades under this account
    ├─ View account performance
    ├─ Update account settings
    ├─ View account history
    └─ Delete account (with confirmation)
```

## Step-by-Step Process

### 1. Navigate to Account Management
**File:** `src/pages/ManageAccounts.tsx`

User clicks "Manage Accounts" from settings or navigation:
```typescript
// src/pages/ManageAccounts.tsx
const ManageAccounts = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Load user's trading accounts
    const loadAccounts = async () => {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading accounts:', error);
        return;
      }

      setAccounts(data || []);
      setLoading(false);
    };

    loadAccounts();
  }, [user]);

  return (
    // Render accounts list and "Add Account" button
  );
};
```

### 2. Display Existing Accounts
User sees:
- Account name
- Broker name
- Account type (Demo/Live)
- Starting balance
- Current balance (calculated from trades)
- Total PnL
- Win rate
- Edit button
- Delete button

### 3. Open Add Account Modal
**File:** `src/components/TradingAccountModal.tsx`

```typescript
const [showModal, setShowModal] = useState(false);

// When user clicks "Add New Account"
<Button onClick={() => setShowModal(true)}>
  Add Account
</Button>

{showModal && (
  <TradingAccountModal
    onClose={() => setShowModal(false)}
    onSave={handleSaveAccount}
  />
)}
```

### 4. Form Submission
User fills in form fields:

```typescript
const [formData, setFormData] = useState({
  account_name: '',
  broker_name: '',
  account_number: '',
  account_type: 'live' as 'live' | 'demo',
  starting_balance: 0,
  currency: 'USD',
  leverage: '1:100',
});

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Validation
  if (!formData.account_name) {
    toast.error("Account name is required");
    return;
  }

  if (formData.starting_balance <= 0) {
    toast.error("Starting balance must be greater than 0");
    return;
  }

  if (!formData.account_number) {
    toast.error("Account number is required");
    return;
  }

  setIsLoading(true);

  try {
    // Insert into database
    const { error } = await supabase
      .from('trading_accounts')
      .insert({
        user_id: user.id,
        account_name: formData.account_name,
        broker_name: formData.broker_name,
        account_number: formData.account_number,
        account_type: formData.account_type,
        starting_balance: formData.starting_balance,
        current_balance: formData.starting_balance,
        currency: formData.currency,
        leverage: formData.leverage,
      });

    if (error) {
      toast.error("Failed to create account");
      console.error('Error:', error);
      return;
    }

    toast.success("Account created successfully!");
    onSave(); // Callback to refresh accounts list
  } finally {
    setIsLoading(false);
  }
};
```

### 5. Database Insert
**Table:** `trading_accounts`

```sql
INSERT INTO trading_accounts (
  user_id,
  account_name,
  broker_name,
  account_number,
  account_type,
  starting_balance,
  current_balance,
  currency,
  leverage,
  created_at,
  updated_at
) VALUES (
  'user-uuid',
  'Live Account 1',
  'MT4',
  '12345678',
  'live',
  10000,
  10000,
  'USD',
  '1:100',
  NOW(),
  NOW()
);
```

**Row-Level Security (RLS) enforces:**
```sql
-- Users can only see their own accounts
CREATE POLICY "Users see own accounts"
ON trading_accounts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can only create their own accounts
CREATE POLICY "Users create own accounts"
ON trading_accounts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own accounts
CREATE POLICY "Users update own accounts"
ON trading_accounts
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only delete their own accounts
CREATE POLICY "Users delete own accounts"
ON trading_accounts
FOR DELETE
USING (auth.uid() = user_id);
```

### 6. Account Created
Supabase returns:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-uuid",
  "account_name": "Live Account 1",
  "broker_name": "MT4",
  "account_number": "12345678",
  "account_type": "live",
  "starting_balance": 10000,
  "current_balance": 10000,
  "currency": "USD",
  "leverage": "1:100",
  "created_at": "2025-01-13T14:30:00Z",
  "updated_at": "2025-01-13T14:30:00Z"
}
```

### 7. Modal Closes & List Refreshes
```typescript
// After successful insert
setShowModal(false);

// Refresh accounts list
const updatedAccounts = [...accounts, newAccount];
setAccounts(updatedAccounts);

// Toast confirmation
toast.success("Account added successfully!");
```

### 8. User Can Now Use Account
Account is available in:
- Trade creation form (select account)
- Journal view (filter by account)
- Performance dashboard
- History view
- Account performance analytics

## Account Interaction: Create Trade

### Flow: User Creates Trade Under Account

```
User navigates to /journal
    ↓
Clicks "Add Trade"
    ↓
Form shows:
├─ Select Account (dropdown) ← Required
├─ Currency Pair
├─ Buy/Sell
├─ Entry Price
├─ Stop Loss
├─ Take Profit Levels
├─ Position Size
├─ Entry Date/Time
├─ Notes
└─ Submit button
        ↓
User selects account from dropdown
    ↓
Form pre-populates:
├─ Account currency (if relevant)
├─ Leverage (for display)
└─ Account balance (for position sizing)
        ↓
User enters trade details
        ↓
Click "Submit"
        ↓
INSERT into trades table
Columns:
├─ id
├─ user_id (from auth)
├─ account_id (from dropdown) ← Links to trading_accounts
├─ currency_pair
├─ direction (buy/sell)
├─ entry_price
├─ stop_loss
├─ take_profit_1
├─ take_profit_2
├─ take_profit_3
├─ position_size
├─ entry_date
├─ created_at
└─ updated_at
        ↓
Trade created
        ↓
Associated with account
        ↓
Can be viewed in account history
```

## Account Interaction: View Account Performance

### Flow: User Views Account Stats

```
User on ManageAccounts page
    ↓
Clicks on account row
    ↓
Shows account details:
├─ Account name
├─ Broker
├─ Account type
├─ Current balance
├─ Starting balance
├─ Total profit/loss
├─ Win rate
├─ Largest win
├─ Largest loss
├─ Total trades
├─ Open trades
├─ Closed trades
├─ Average win %
├─ Average loss %
├─ Profit factor
└─ Charts/Analytics
        ↓
Backend calculates from trades:
├─ SELECT * FROM trades
│  WHERE account_id = selected_account.id
│
├─ Calculate:
│  ├─ total_pl = SUM(profit_loss)
│  ├─ win_rate = wins / total
│  ├─ avg_win = AVG(wins)
│  ├─ avg_loss = AVG(losses)
│  └─ current_balance = starting + total_pl
│
└─ Send to frontend
```

## Account Interaction: Edit Account

### Flow: User Edits Account Settings

```
User on ManageAccounts page
    ↓
Clicks "Edit" button on account
    ↓
TradingAccountModal opens with existing data
    ↓
Can update:
├─ Account name
├─ Account type (demo ↔ live)
├─ Leverage
└─ Currency (if no trades)
        ↓
Cannot update (prevents data corruption):
├─ Account number
├─ Broker name
├─ Starting balance
└─ User (RLS enforces)
        ↓
User clicks "Update"
        ↓
UPDATE trading_accounts
SET account_name = '...',
    account_type = '...',
    leverage = '...',
    updated_at = NOW()
WHERE id = account.id
  AND user_id = current_user.id
        ↓
Account updated
        ↓
Changes reflected in UI
```

## Account Interaction: Delete Account

### Flow: User Deletes Account

```
User on ManageAccounts page
    ↓
Clicks delete icon on account
    ↓
Confirmation modal:
"Are you sure? This will delete all trades."
├─ Cancel button
└─ Delete button
        ↓
User clicks "Delete"
        ↓
Option 1: Soft Delete (archive)
├─ SET is_archived = true
├─ Trades remain in database
├─ Account hidden from UI
└─ Can be recovered
        ↓
Option 2: Hard Delete (remove)
├─ DELETE trades WHERE account_id = X
├─ DELETE trading_accounts WHERE id = X
├─ Data permanently removed
└─ Cannot be recovered
        ↓
Success message
        ↓
Account disappears from list
```

## Form Fields & Validation

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| Account Name | text | ✅ | 1-50 chars, not empty |
| Broker | select | ✅ | Choose from list |
| Account Number | text | ✅ | 1-20 chars |
| Account Type | radio | ✅ | demo \| live |
| Starting Balance | number | ✅ | > 0, decimal allowed |
| Currency | select | ✅ | USD, EUR, GBP, etc. |
| Leverage | select | ✅ | 1:10, 1:50, 1:100, 1:500 |

## Error Handling

### Account Name Already Exists
```
Database unique constraint check
Toast: "Account with this name already exists"
User can edit name and retry
```

### Starting Balance Invalid
```
Frontend validation
Toast: "Starting balance must be greater than 0"
Field highlighted
User corrects and retries
```

### Database Error
```
INSERT fails (network, permissions, etc.)
Toast: "Failed to create account. Please try again."
Modal stays open
User can modify and retry
```

### Insufficient Permissions
```
RLS policy denies insert
Toast: "You don't have permission to create accounts"
Contact support message
```

### Account Already Has Trades
```
User tries to delete account with trades
Modal shows warning:
"This account has 15 closed trades and 2 open trades"
"Deleting will remove all associated data"
User must confirm
```

## Security Features

✅ **Row-Level Security (RLS)**
- Users can only access their own accounts
- Database-level enforcement
- Cannot bypass via API

✅ **User Association**
- Every account linked to `user_id`
- Prevents data leakage between users
- Audit trail available

✅ **Data Validation**
- Client-side: user feedback
- Server-side: RLS + constraints
- No invalid data in database

✅ **Immutable Fields**
- Account number can't change
- Broker can't change
- Starting balance can't change
- Prevents profit calculation errors

## Related Files

- [src/pages/ManageAccounts.tsx](../../src/pages/ManageAccounts.tsx) - Account list page
- [src/components/TradingAccountModal.tsx](../../src/components/TradingAccountModal.tsx) - Add/edit form
- [Database schema](../../supabase/migrations/) - trading_accounts table

## Next: Trading & Signals

After creating account → [Create Trade Flow](./05_CREATE_TRADE_FLOW.md)
