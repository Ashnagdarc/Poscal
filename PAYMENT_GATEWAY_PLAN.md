# Plan: Add $1 One-Time Payment Gateway

Integrate Stripe for a simple one-time $1 payment to unlock premium features in the Poscal trading calculator, converting from fully free to a freemium model with basic calculator free and advanced journal/analytics behind the paywall.

## Steps

### 1. Set up database for payment tracking

Add `payment_status`, `payment_date`, and `stripe_customer_id` columns to profiles table in Supabase; create `payments` table to log transactions.

**Database Changes:**

```sql
-- Add columns to profiles table
ALTER TABLE profiles ADD COLUMN payment_status VARCHAR DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN payment_date TIMESTAMP;
ALTER TABLE profiles ADD COLUMN stripe_customer_id VARCHAR;

-- Create payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  stripe_payment_intent_id VARCHAR,
  amount INTEGER NOT NULL,
  currency VARCHAR DEFAULT 'usd',
  status VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Create SubscriptionContext

Build `src/contexts/SubscriptionContext.tsx` to manage `isPaid` boolean, check payment status from profile, and provide `checkFeatureAccess()` helper used throughout the app.

**Files to create:**

- `src/contexts/SubscriptionContext.tsx`

### 3. Implement feature gates in Journal

Modify `src/pages/Journal.tsx` to limit free users to 10 trades, hide CSV import/screenshot uploads, and show "Upgrade for $1" prompt when limits hit; paid users get unlimited access.

**Files to modify:**

- `src/pages/Journal.tsx`

### 4. Build Stripe checkout flow

Create `src/pages/Pricing.tsx` with $1 one-time payment button, integrate `@stripe/stripe-js` and `@stripe/react-stripe-js`, implement checkout session via Supabase Edge Function, and add `src/pages/PaymentSuccess.tsx` confirmation page.

**Files to create:**

- `src/pages/Pricing.tsx`
- `src/pages/PaymentSuccess.tsx`

**Packages to install:**

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 5. Set up Stripe webhook handler

Create Supabase Edge Function at `supabase/functions/stripe-webhook` to listen for `checkout.session.completed` events and update `profiles.payment_status` to 'paid' when payment succeeds.

**Files to create:**

- `supabase/functions/stripe-webhook/index.ts`

### 6. Add payment UI to Profile

Update `src/pages/Profile.tsx` to display payment status badge ("Free" or "Premium"), show "Upgrade to Premium" button for unpaid users linking to `/pricing`, and display payment date for paid users.

**Files to modify:**

- `src/pages/Profile.tsx`

## Further Considerations

### 1. Should we offer a free trial period?

- **Option A:** No trial, keep simple
- **Option B:** 7-day trial before requiring payment
- **Option C:** Free tier with limited features permanently (recommended for better conversion)

### 2. Alternative to Stripe?

Consider Lemon Squeezy or Paddle for simpler tax handling and merchant of record benefits, though Stripe offers more flexibility for future subscription models.

### 3. Refund policy?

Should include clear refund terms and implement refund webhook handling to revert payment_status if refunded.

## Feature Gating Strategy

### Free Tier Includes:

- ✅ Position Size Calculator (unlimited)
- ✅ Basic calculation history (last 10)
- ✅ Limited journal entries (10 trades max)
- ✅ Basic stats (win rate, total trades)

### Premium Tier ($1 one-time) Includes:

- 💎 Unlimited trade journal entries
- 💎 Advanced analytics (profit factor, drawdown, charts)
- 💎 CSV import/export
- 💎 Screenshot uploads for trades
- 💎 Unlimited calculation history
- 💎 Advanced filters and search

## Technical Architecture

### Payment Flow:

1. User clicks "Upgrade to Premium" button
2. Redirected to `/pricing` page
3. Stripe checkout session created via Edge Function
4. User completes payment on Stripe hosted page
5. Stripe webhook fires `checkout.session.completed` event
6. Edge Function updates `profiles.payment_status = 'paid'`
7. User redirected to `/payment-success`
8. App automatically detects paid status via SubscriptionContext

### Supabase Setup:

1. Create Edge Function for checkout session creation
2. Create Edge Function for webhook handling
3. Add RLS policies for payments table
4. Set up Stripe environment variables in Supabase

### Environment Variables Needed:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Implementation Order

1. **Phase 1: Backend Setup** (Database + Edge Functions)
2. **Phase 2: Context & State** (SubscriptionContext)
3. **Phase 3: UI Components** (Pricing page, payment success)
4. **Phase 4: Feature Gates** (Journal limits, upgrade prompts)
5. **Phase 5: Profile Integration** (Display status, manage subscription)
6. **Phase 6: Testing** (Test mode payments, webhook testing)
7. **Phase 7: Production** (Live Stripe keys, deploy)

## Current App Structure (Reference)

- **Authentication:** Supabase Auth via AuthContext
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage (avatars, trade screenshots)
- **Frontend:** React + TypeScript + Vite
- **Routing:** React Router v6
- **UI:** TailwindCSS + Radix UI
- **State:** React Context API

## Notes

- App is already well-structured for adding payments
- Authentication system is robust and ready
- Journal already requires login, making it easy to gate
- ProtectedRoute pattern exists and can be extended
- Supabase Edge Functions available for webhook handling
- Clean component separation allows for easy feature gating
