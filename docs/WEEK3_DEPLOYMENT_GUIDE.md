# Week 3 Deployment Guide: Payment System Backend

This guide covers deploying the payment verification system and configuring Paystack webhooks.

## Prerequisites

- Supabase project with CLI installed
- Paystack account (test mode for development)
- Access to Supabase Dashboard and Paystack Dashboard

## Step 1: Deploy Edge Functions

### 1.1 Deploy verify-payment Function

```powershell
cd C:\Users\user\Documents\Poscal
supabase functions deploy verify-payment
```

### 1.2 Deploy paystack-webhook Function

```powershell
supabase functions deploy paystack-webhook
```

### 1.3 Verify Deployment

Check that both functions appear in your Supabase Dashboard:
- Go to: **Supabase Dashboard → Edge Functions**
- Should see: `verify-payment` and `paystack-webhook` with status "Active"

---

## Step 2: Configure Supabase Secrets

You need to add 3 secrets to Supabase for the Edge Functions to work.

### 2.1 Get Your Paystack Keys

1. Go to https://dashboard.paystack.com
2. Navigate to **Settings → API Keys & Webhooks**
3. Copy the following keys:
   - **Secret Key** (starts with `sk_test_` for test mode, `sk_live_` for production)
   - **Webhook Secret** (you'll get this after setting up webhook in Step 3)

### 2.2 Add Secrets to Supabase

**Option A: Using Supabase CLI (Recommended)**

```powershell
# Set Paystack Secret Key
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here

# Set Paystack Webhook Secret (do this AFTER Step 3)
supabase secrets set PAYSTACK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

**Option B: Using Supabase Dashboard**

1. Go to: **Supabase Dashboard → Settings → Edge Functions**
2. Scroll to **Secrets** section
3. Click **Add New Secret**
4. Add each secret:
   - Name: `PAYSTACK_SECRET_KEY`, Value: `sk_test_xxxxxxxxxxxxx`
   - Name: `PAYSTACK_WEBHOOK_SECRET`, Value: `whsec_xxxxxxxxxxxxx`

### 2.3 Verify Secrets

```powershell
supabase secrets list
```

Should show:
```
PAYSTACK_SECRET_KEY
PAYSTACK_WEBHOOK_SECRET
SUPABASE_URL (auto-generated)
SUPABASE_SERVICE_ROLE_KEY (auto-generated)
```

---

## Step 3: Configure Paystack Webhook

### 3.1 Get Your Webhook URL

Your webhook URL format:
```
https://ywnmxrpasfikvwdgexdo.supabase.co/functions/v1/paystack-webhook
```

Replace `ywnmxrpasfikvwdgexdo` with your Supabase project reference ID.

To find your project reference:
- **Supabase Dashboard → Settings → API**
- Look for "Project URL": `https://[PROJECT_REF].supabase.co`

### 3.2 Add Webhook in Paystack Dashboard

1. Go to https://dashboard.paystack.com
2. Navigate to **Settings → API Keys & Webhooks**
3. Scroll to **Webhooks** section
4. Click **Add Webhook URL**
5. Enter your webhook URL: `https://[PROJECT_REF].supabase.co/functions/v1/paystack-webhook`
6. Click **Save**

### 3.3 Copy Webhook Secret

After saving:
1. Click on the webhook you just created
2. Copy the **Webhook Secret** (starts with `whsec_`)
3. Add it to Supabase secrets (Step 2.2 above)

### 3.4 Test Webhook

1. In Paystack Dashboard, find your webhook
2. Click **Test Webhook**
3. Select event: `charge.success`
4. Click **Send Test**
5. Check Supabase logs: `supabase functions logs paystack-webhook`
6. Should see: `[webhook] Received event: charge.success`

---

## Step 4: Verify Database Setup

### 4.1 Check Required Tables

Run this SQL in Supabase SQL Editor:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'payments', 'paystack_webhook_logs');
```

Should return 3 rows.

### 4.2 Check SQL Functions

```sql
-- List custom functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'has_active_subscription',
  'get_subscription_details',
  'get_payment_statistics',
  'can_access_feature'
);
```

Should return 4 rows.

### 4.3 Test Subscription Function

```sql
-- Test with a user ID (replace with real user ID)
SELECT * FROM get_subscription_details('user-id-here');
```

Should return user's subscription details.

---

## Step 5: Test Payment Flow (Test Mode)

### 5.1 Get Paystack Test Cards

Use these test cards in Paystack payment modal:

**Successful Payment:**
- Card: `4084 0840 8408 4081`
- CVV: `408`
- Expiry: Any future date
- PIN: `0000`
- OTP: `123456`

**Failed Payment:**
- Card: `5060 6666 6666 6666`
- CVV: Any
- Expiry: Any future date

### 5.2 Test Complete Flow

1. **Start Dev Server:**
   ```powershell
   npm run dev
   ```

2. **Reset Test User to Free:**
   ```sql
   UPDATE profiles 
   SET payment_status = 'free',
       subscription_tier = 'free',
       subscription_expires_at = NULL
   WHERE email = 'your-test-email@example.com';
   ```

3. **Test Payment:**
   - Navigate to http://localhost:8081/pricing
   - Click "Upgrade to Premium"
   - Use test card from 5.1
   - Complete payment

4. **Verify Success:**
   - Should see success toast: "🎉 Payment successful! Welcome to Premium!"
   - Check database:
     ```sql
     SELECT email, payment_status, subscription_tier, subscription_expires_at
     FROM profiles
     WHERE email = 'your-test-email@example.com';
     ```
   - Should show: `payment_status = 'paid'`, `subscription_tier = 'premium'`

5. **Check Payment Record:**
   ```sql
   SELECT * FROM payments 
   WHERE user_id = (
     SELECT id FROM profiles WHERE email = 'your-test-email@example.com'
   )
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

6. **Check Webhook Log:**
   ```sql
   SELECT * FROM paystack_webhook_logs 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

---

## Step 6: Test Feature Gating

### 6.1 Journal Page (Free: 5 trades max)

1. **As Free User:**
   - Go to /journal
   - Add 5 trades
   - Try to add 6th trade → Should show error toast
   - Add Trade button should be disabled
   - Should see upgrade prompt

2. **As Premium User:**
   - Complete payment flow
   - Should be able to add unlimited trades

### 6.2 Signals Page (Free: view-only, 3 signals max)

1. **As Free User:**
   - Go to /signals
   - Should see max 3 signals
   - "Take Signal" button should show "Premium" and be disabled
   - Should see upgrade prompt at bottom

2. **As Premium User:**
   - Should see all signals
   - "Take Signal" button should be enabled

### 6.3 History Page (Free: 10 calculations max)

1. **As Free User:**
   - Go to /calculator
   - Make 15 calculations
   - Go to /history
   - Should see "Showing 10 of 15" in header
   - Should see upgrade prompt

2. **As Premium User:**
   - Should see all 15 calculations
   - No upgrade prompt

---

## Step 7: Monitor and Debug

### 7.1 Check Edge Function Logs

```powershell
# Watch verify-payment logs
supabase functions logs verify-payment --follow

# Watch webhook logs
supabase functions logs paystack-webhook --follow
```

### 7.2 Common Issues

**Issue: "Payment verification failed"**
- Check `PAYSTACK_SECRET_KEY` is set correctly
- Verify secret key matches test/live mode
- Check Supabase function logs for error details

**Issue: Webhook not receiving events**
- Verify webhook URL is correct
- Check webhook is active in Paystack Dashboard
- Test webhook using Paystack Dashboard test feature
- Check `PAYSTACK_WEBHOOK_SECRET` is set

**Issue: Database not updating**
- Check RLS policies allow service role to update profiles
- Verify user ID in payment reference matches database
- Check Supabase function logs for SQL errors

**Issue: "Invalid signature" in webhook**
- Verify `PAYSTACK_WEBHOOK_SECRET` matches Paystack Dashboard
- Check webhook secret is for correct environment (test/live)
- Ensure webhook URL points to correct Supabase project

### 7.3 Debug SQL Queries

```sql
-- Check recent payments
SELECT 
  p.email,
  pmt.amount,
  pmt.status,
  pmt.paystack_reference,
  pmt.created_at
FROM payments pmt
JOIN profiles p ON p.id = pmt.user_id
ORDER BY pmt.created_at DESC
LIMIT 10;

-- Check webhook events
SELECT 
  event_type,
  reference,
  status,
  created_at,
  payload->>'data'->>'amount' as amount
FROM paystack_webhook_logs
ORDER BY created_at DESC
LIMIT 10;

-- Check subscription status
SELECT 
  email,
  payment_status,
  subscription_tier,
  subscription_expires_at,
  payment_date
FROM profiles
WHERE payment_status = 'paid'
ORDER BY payment_date DESC;
```

---

## Step 8: Go Live (Production)

### 8.1 Switch to Live Keys

1. **Get Live Paystack Keys:**
   - Go to Paystack Dashboard
   - Switch from Test Mode to Live Mode (toggle top-right)
   - Copy **Live Secret Key** (`sk_live_xxxxx`)
   - Copy **Live Public Key** (`pk_live_xxxxx`)

2. **Update Supabase Secrets:**
   ```powershell
   supabase secrets set PAYSTACK_SECRET_KEY=sk_live_your_live_key_here
   ```

3. **Update Frontend Environment:**
   - Update `.env`: `VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxxxx`
   - Rebuild: `npm run build`
   - Deploy to Vercel/hosting

4. **Update Live Webhook:**
   - Add production webhook URL in Paystack (Live Mode)
   - Copy new live webhook secret
   - Update Supabase: `supabase secrets set PAYSTACK_WEBHOOK_SECRET=whsec_live_xxxxx`

### 8.2 Production Checklist

- [ ] Live Paystack secret key set in Supabase
- [ ] Live Paystack public key set in frontend env
- [ ] Live webhook URL configured in Paystack
- [ ] Live webhook secret set in Supabase
- [ ] Tested live payment with real card
- [ ] Verified database update after live payment
- [ ] Verified webhook receives live events
- [ ] Tested all feature gates with live premium user

---

## Troubleshooting Commands

```powershell
# View all Supabase secrets
supabase secrets list

# View function logs (last 100 lines)
supabase functions logs verify-payment --limit 100
supabase functions logs paystack-webhook --limit 100

# Redeploy if needed
supabase functions deploy verify-payment --no-verify-jwt
supabase functions deploy paystack-webhook --no-verify-jwt

# Test function locally (optional)
supabase functions serve verify-payment
```

---

## Next Steps

After successful deployment:
1. Monitor payment logs for first few days
2. Set up email notifications for failed payments (Week 4)
3. Build admin payment dashboard (Week 4)
4. Implement subscription expiry reminders
5. Add payment history export feature

---

## Support

If you encounter issues:
1. Check Supabase function logs first
2. Verify all secrets are set correctly
3. Test webhook with Paystack Dashboard test feature
4. Review database queries for errors
5. Check RLS policies aren't blocking updates
