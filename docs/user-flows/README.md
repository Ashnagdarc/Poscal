# PosCal User Flows - Complete Documentation

## Overview
Complete documentation of all user flows in the PosCal trading journal application, from initial signup through account management, trading, and performance analysis.

---

## 📚 Complete Flow Index

### 1. **[Sign Up Flow](./01_SIGN_UP_FLOW.md)** 👤
   - **What:** User registration and email verification
   - **Includes:**
     - Onboarding entry
     - Account creation form
     - Email validation
     - Supabase auth integration
     - Error handling
   - **Key Files:**
     - `src/pages/SignUp.tsx`
     - `src/pages/Welcome.tsx`
     - `src/contexts/AuthContext.tsx`
   - **Duration:** ~2-3 minutes
   - **Outcome:** User account created and email verified

### 2. **[Login Flow](./02_LOGIN_FLOW.md)** 🔐
   - **What:** User authentication and session management
   - **Includes:**
     - Sign in page
     - Credential validation
     - JWT token management
     - Session persistence
     - Protected routes
     - Token refresh & expiration
   - **Key Files:**
     - `src/pages/SignIn.tsx`
     - `src/contexts/AuthContext.tsx`
     - `src/components/ProtectedRoute.tsx`
   - **Duration:** ~30 seconds
   - **Outcome:** User authenticated and can access protected features

### 3. **[Password Reset Flow](./03_PASSWORD_RESET_FLOW.md)** 🔑
   - **What:** Secure password recovery
   - **Includes:**
     - Forgot password request
     - Email verification link
     - Token validation
     - New password entry
     - Session invalidation (security)
   - **Key Files:**
     - `src/pages/SignIn.tsx`
     - `src/pages/ResetPassword.tsx`
     - `src/contexts/AuthContext.tsx`
   - **Duration:** ~5-10 minutes
   - **Outcome:** Password reset and account access restored

### 4. **[Trading Account Creation Flow](./04_TRADING_ACCOUNT_FLOW.md)** 🏦
   - **What:** Create and manage trading accounts
   - **Includes:**
     - Add new trading account
     - Account details (broker, type, balance)
     - Leverage configuration
     - Account editing
     - Account deletion
     - Account performance view
   - **Key Files:**
     - `src/pages/ManageAccounts.tsx`
     - `src/components/TradingAccountModal.tsx`
   - **Duration:** ~2 minutes per account
   - **Outcome:** Trading account created and ready for trades

### 5. **[Real-Time Prices & WebSocket Flow](./05_REALTIME_PRICES_FLOW.md)** 📊
   - **What:** Live market data delivery system
   - **Includes:**
     - Finnhub WebSocket connection
     - Price updates to database
     - Supabase Realtime broadcasting
     - Frontend subscription and rendering
     - Symbol mapping
     - Latency & performance metrics
   - **Key Files:**
     - `push-sender/index.ts` (WebSocket backend)
     - `src/hooks/use-realtime-prices.ts`
     - `src/components/Calculator.tsx`
   - **Duration:** Continuous (background)
   - **Outcome:** Live prices available in all components
   - **Note:** Unlimited updates via WebSocket (replaced rate-limited REST API)

### 6. **[Trading Signals Flow](./06_TRADING_SIGNALS_FLOW.md)** 📈
   - **What:** Create and manage trading signals
   - **Includes:**
     - Create new signal
     - Monitor signal in real-time
     - Take signal (execute)
     - Close signal (manual or auto)
     - Calculate P&L
     - View statistics
   - **Key Files:**
     - `src/pages/Signals.tsx`
     - `src/components/CreateSignalModal.tsx`
     - `src/components/TakeSignalModal.tsx`
   - **Duration:** Variable (seconds to days)
   - **Outcome:** Signal tracked and results recorded

### 7. **[Trading Journal Flow](./07_JOURNAL_FLOW.md)** 📔
   - **What:** Log and track individual trades
   - **Includes:**
     - Add trade manually
     - Close open trades
     - View trade history
     - Calculate metrics (win rate, profit factor, etc.)
     - Analytics dashboard
     - Trade screenshot upload
   - **Key Files:**
     - `src/pages/Journal.tsx`
     - `src/components/PnLInputModal.tsx`
     - `src/components/JournalAnalytics.tsx`
   - **Duration:** ~2 minutes per trade
   - **Outcome:** Trade logged with full analytics

### 8. **[Settings & Preferences Flow](./08_SETTINGS_FLOW.md)** ⚙️
   - **What:** User account and app configuration
   - **Includes:**
     - Profile management
     - Theme & language preferences
     - Notification settings
     - Password change
     - Session management
     - Account deletion
   - **Key Files:**
     - `src/pages/Settings.tsx`
     - `src/contexts/AuthContext.tsx`
   - **Duration:** ~5 minutes
   - **Outcome:** Preferences and account settings updated

---

## 🔄 Flow Relationships

```
START
  ↓
[1] Sign Up ──→ Email Verification ──→ Account Created
  ↓
[2] Login (or auto-login if session exists) ──→ Authenticated
  ↓
  ├─→ [3] Password Reset (forgot password) ──→ Back to Login
  ├─→ [4] Create Trading Account ──→ Account Ready
  │    ↓
  │    ├─→ [6] Create Trading Signals ──→ Monitor & Close
  │    │
  │    └─→ [7] Journal: Log Trades ──→ View Analytics
  │
  └─→ [8] Settings ──→ Update Profile/Preferences
  
CONTINUOUS (Background)
  ↓
[5] Real-Time Prices ──→ Finnhub WebSocket → DB → Frontend
                         (feeds [6] and [7])
```

## 📲 Page Structure

### Public Pages (No Auth Required)
- `/` - Calculator (with onboarding check)
- `/welcome` - Onboarding
- `/signin` - Sign in
- `/signup` - Sign up
- `/reset-password` - Password reset
- `/journal` - Trading journal (public view)
- `/history` - Trade history (public view)
- `/settings` - Settings (accessible)

### Protected Pages (Auth Required)
- `/signals` - Trading signals management
- `/admin/users` - User management (admin only)
- `/admin/updates` - System updates (admin only)
- `/manage-accounts` - Trading account management

## 🔑 Key Technologies

### Authentication
- **Supabase Auth** - User management, JWT tokens, email verification
- **React Context** - Auth state management
- **Row-Level Security (RLS)** - Database access control

### Real-Time Data
- **Finnhub WebSocket API** - Live market prices (unlimited)
- **Supabase Realtime** - Database change broadcasts
- **Custom Hooks** - Frontend subscription (useRealtimePrices)

### Database
- **Supabase PostgreSQL** - User data, trades, signals, prices
- **Migrations** - Schema versioning
- **RLS Policies** - User isolation

### Frontend
- **React + TypeScript** - UI framework
- **React Router** - Client-side routing
- **React Query** - Data fetching & caching
- **Tailwind CSS** - Styling
- **Supabase JS SDK** - Client library

### Backend Service
- **Node.js + TypeScript** - push-sender service
- **WebSocket (ws)** - Finnhub connection
- **Docker** - Container deployment
- **DigitalOcean** - Production hosting

## 📊 Data Model

### Users (Supabase Auth)
- UUID
- Email
- Password (hashed)
- Full name, bio, experience level
- Metadata

### Trading Accounts
- ID, User ID
- Account name, broker, account number
- Account type (live/demo)
- Starting balance, current balance
- Currency, leverage

### Signals
- ID, User ID
- Currency pair, direction (buy/sell)
- Entry price, stop loss
- Take profits (TP1, TP2, TP3)
- Status (active/closed), result (win/loss/breakeven)
- Chart image, notes

### Taken Trades
- ID, User ID, Signal ID, Account ID
- Entry price, position size
- Entry/exit dates
- Profit/loss

### Trades (Journal)
- ID, User ID, Account ID
- Currency pair, direction
- Entry/exit prices and dates
- Position size
- Profit/loss ($ and %)
- Commission fees, notes

### Prices (Cache)
- Symbol (EUR/USD, etc.)
- Bid/ask/mid prices
- Timestamp
- Updated at

## 🎯 User Stories

### Beginner Trader
1. Sign up → Create demo account → Practice with signals → Journal trades → View analytics
2. Use calculator for position sizing
3. Monitor real-time prices
4. Adjust settings and preferences

### Active Trader
1. Login → View live prices → Monitor multiple signals → Close trades → Update journal
2. Review daily/weekly analytics
3. Manage multiple trading accounts
4. Export performance data

### System Administrator
1. Login → Access admin pages
2. View all users
3. System updates & management
4. User support

## 🚀 Getting Started

### For New Users
1. **Sign up** with email ([01_SIGN_UP_FLOW.md](./01_SIGN_UP_FLOW.md))
2. **Create trading account** ([04_TRADING_ACCOUNT_FLOW.md](./04_TRADING_ACCOUNT_FLOW.md))
3. **Monitor prices** ([05_REALTIME_PRICES_FLOW.md](./05_REALTIME_PRICES_FLOW.md))
4. **Log trades** in journal ([07_JOURNAL_FLOW.md](./07_JOURNAL_FLOW.md))

### For Returning Users
1. **Login** ([02_LOGIN_FLOW.md](./02_LOGIN_FLOW.md))
2. **View prices & signals** (auto-updated via WebSocket)
3. **Manage trades** and accounts

### If Forgotten Password
1. **Reset password** ([03_PASSWORD_RESET_FLOW.md](./03_PASSWORD_RESET_FLOW.md))
2. **Login with new password**

## 🔧 Customization

Users can customize via [Settings Flow](./08_SETTINGS_FLOW.md):
- **Theme** - Light/Dark/Auto
- **Currency** - USD/EUR/GBP/JPY
- **Notifications** - Signal alerts, trade alerts, weekly report
- **Preferences** - Default pair, leverage, language

## 🛡️ Security Features

### Authentication
- Secure password hashing
- Email verification
- JWT tokens with expiration
- Token auto-refresh
- Session management

### Data Protection
- Row-Level Security (RLS) policies
- User isolation at database level
- Encrypted passwords
- HTTPS only
- Audit logging

### Account Security
- Password change with current password verification
- Session invalidation after password change
- Multi-session management
- Account deletion with email confirmation

## 📈 Performance

### Price Updates
- **Latency:** ~150ms typical (Finnhub → DB → Frontend)
- **Frequency:** Every tick (~50-100ms from Finnhub)
- **Data:** Unlimited (WebSocket, no rate limits)
- **Improvement:** 129,600 calls/day (OLD) → Unlimited (NEW)

### Database Queries
- Trading accounts: <100ms
- Trades list: <200ms (paginated)
- Analytics calculation: <500ms
- Price updates: <50ms

### Frontend Rendering
- Initial load: ~2-3 seconds
- Route transitions: <500ms
- Real-time updates: <100ms

## 🐛 Troubleshooting

### Can't Login?
- Check email is verified
- Reset password ([03_PASSWORD_RESET_FLOW.md](./03_PASSWORD_RESET_FLOW.md))
- Clear browser cache

### Missing Prices?
- Check WebSocket connection (backend logs)
- Verify Finnhub API key
- Manual refresh prices button

### No Notifications?
- Check notification settings ([08_SETTINGS_FLOW.md](./08_SETTINGS_FLOW.md))
- Verify browser permissions
- Check email inbox

### Trade Data Incorrect?
- Verify entered prices
- Check currency conversions
- Review commission fees included

## 📚 Related Documentation

- [WEBSOCKET_MIGRATION.md](../WEBSOCKET_MIGRATION.md) - Technical migration details
- [README.md](../README.md) - Project overview
- [LIVE_PRICES_INTEGRATION.md](../LIVE_PRICES_INTEGRATION.md) - Price API integration
- [push-sender/README.md](../../push-sender/README.md) - Backend service documentation

## 📞 Support

For issues with specific flows, refer to the detailed documentation:
- Authentication issues → [01_SIGN_UP_FLOW.md](./01_SIGN_UP_FLOW.md) or [02_LOGIN_FLOW.md](./02_LOGIN_FLOW.md)
- Trading issues → [06_TRADING_SIGNALS_FLOW.md](./06_TRADING_SIGNALS_FLOW.md) or [07_JOURNAL_FLOW.md](./07_JOURNAL_FLOW.md)
- Account issues → [04_TRADING_ACCOUNT_FLOW.md](./04_TRADING_ACCOUNT_FLOW.md)
- Settings issues → [08_SETTINGS_FLOW.md](./08_SETTINGS_FLOW.md)
- Price issues → [05_REALTIME_PRICES_FLOW.md](./05_REALTIME_PRICES_FLOW.md)

---

**Last Updated:** January 13, 2026  
**Version:** 1.0  
**Status:** Complete user flow documentation
